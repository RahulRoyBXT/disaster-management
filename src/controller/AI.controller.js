import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { PrismaClient } from '../generated/prisma/index.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/logger.js';
import { emitEvent } from '../utils/socket.js';

dotenv.config();

let genAI;

async function fetchImageAsBase64(url) {
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString('base64');
}

export const verifyImage = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params; // Get disaster ID from params
    // const file = req.file;

    // if (!file) {
    //   return res.status(400).json(new ApiResponse(400, null, 'Image file is not found!', false));
    // }

    // Get the report ID if provided
    const { reportId } = req.body;
    if (!reportId) {
      return res.status(400).json(new ApiResponse(400, null, 'Report ID is required', false));
    }

    // const base64Image = file.buffer.toString('base64');

    if (!process.env.GEMINI_API_KEY) {
      return res
        .status(500)
        .json(new ApiResponse(500, null, 'Gemini API key not configured', false));
    }

    // Initialize Gemini API
    if (!genAI) {
      genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }

    // Get disaster details for context
    const prisma = new PrismaClient();

    const disaster = await prisma.disaster.findUnique({
      where: { id },
      select: { title: true, locationName: true, description: true, tags: true },
    });

    if (!disaster) {
      return res.status(404).json(new ApiResponse(404, null, 'Disaster not found', false));
    }

    const report = await prisma.report.findUnique({
      where: { id: reportId },
      select: { content: true, imageUrl: true, verificationStatus: true },
    });

    if (!report) {
      return res.status(404).json(new ApiResponse(404, null, 'Report not found', false));
    }

    // Create a more comprehensive prompt for Gemini
    const prompt = `
      I need a comprehensive analysis of this disaster image. Please evaluate:
      
      1. Authenticity: Does this image show signs of digital manipulation, editing, or AI generation? Look for inconsistencies, unusual lighting, unnatural edges, or other artifacts.
      
      2. Disaster Context: Does this image show a real disaster scene that matches the reported disaster?
      
      3. Relevance: Is the image consistent with the disaster details provided below?
      
      Disaster details:
      - Title: ${disaster.title}
      - Location: ${disaster.locationName}
      - Description: ${disaster.description}
      - Tags: ${disaster.tags.join(', ')}
      - Report content: ${report.content}
      
      Respond with a JSON object containing:
      {
        "authentic": true/false (is the image authentic or likely manipulated),
        "disasterVisible": true/false (is an actual disaster visible),
        "matchesDescription": true/false (does it match the disaster details),
        "confidence": number from 0-1 (your confidence level),
        "verificationStatus": "VERIFIED"/"REJECTED"/"PENDING" (final determination),
        "explanation": "detailed explanation of your analysis",
        "detectedObjects": ["list", "of", "relevant", "objects", "or", "elements", "visible", "in", "the", "image"]
      }
    `;

    const base64Image = await fetchImageAsBase64(report.imageUrl);

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg', // or 'image/png' based on your file
          data: base64Image,
        },
      },
    ]);

    const response = await result.response;

    if (!response) {
      throw new ApiError(500, 'Failed to process the image with AI');
    }

    const text = response.text();
    let verificationResult;

    // Try to parse JSON response
    try {
      // Remove markdown code blocks if they exist
      const jsonText = text.replace(/```json|```/g, '').trim();
      verificationResult = JSON.parse(jsonText);
    } catch (error) {
      // If parsing fails, create a structured result
      logger.error('Failed to parse AI response:', error);
      verificationResult = {
        authentic: false,
        disasterVisible: false,
        matchesDescription: false,
        confidence: 0,
        verificationStatus: 'PENDING',
        explanation: 'Failed to parse AI response',
        detectedObjects: [],
      };
    }

    // Update the report with verification status
    await prisma.report.update({
      where: { id: reportId },
      data: {
        verificationStatus: verificationResult.verificationStatus,
        // Store the full verification results in the database
        metadata: {
          verificationResult,
        },
      },
    });

    // Emit socket event for real-time updates
    emitEvent(req, 'report_verified', {
      disasterId: id,
      reportId,
      verificationStatus: verificationResult.verificationStatus,
      timestamp: new Date().toISOString(),
    });

    // Log the verification
    logger.info(
      `Image verification completed for report ${reportId}: ${verificationResult.verificationStatus}`
    );
    return res
      .status(200)
      .json(new ApiResponse(200, verificationResult, 'Image verification completed'));
  } catch (error) {
    logger.error('Image verification error:', error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, `Image verification failed: ${error.message}`, false));
  }
});

export const Geolocation = asyncHandler(async (req, res) => {
  const { description } = req.body;

  if (!description) {
    return res.status(400).json({ error: 'description is a required field!' });
  }

  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const result = await model.generateContent(`
      Extract location from this sentence: ${description}
    `);
  const response = await result.response;
  const text = response.text();
  const locationName = text.trim();

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    locationName
  )}&format=json&limit=1`;
  const res2 = await fetch(url, {
    headers: { 'User-Agent': 'Disaster-Management/1.0' },
  });

  const data = await res2.json();
  if (!data.length) throw new Error('Location not found');

  const { lat, lon } = data[0];
  res.json({ data: { locationName: locationName, lat: parseFloat(lat), lng: parseFloat(lon) } });
});
