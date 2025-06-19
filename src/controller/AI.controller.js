import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

dotenv.config();

let genAI;

export const verifyImage = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'Image file is not found!' });
  }

  const base64Image = file.buffer.toString('base64');

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API key not configured' });
  }

  // Loading the Env
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const result = await model.generateContent([
    'Does this image show a disaster (like flood, fire, or earthquake)?',
    {
      inlineData: {
        mimeType: 'image/jpeg', // or "image/png"
        data: base64Image,
      },
    },
  ]);


  const response = await result.response;

  if (!response) {
    throw new ApiError(500, 'Failed to process the Image with AI');
  }
  const text = response.text();

  res.status(200).json(new ApiResponse(200, text));
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
