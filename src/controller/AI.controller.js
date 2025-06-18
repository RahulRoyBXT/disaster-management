import { GoogleGenerativeAI } from '@google/generative-ai';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const genAI = new GoogleGenerativeAI(process.env.GoogleGenerativeAI);

export const verifyImage = asyncHandler(async (req, res) => {
  const { imageBase64 } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'Image data is required!' });
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const result = await model.generateContent([
    'Does this image show a disaster (like flood, fire, or earthquake)?',
    {
      inlineData: {
        mimeType: 'image/jpeg', // or "image/png"
        data: imageBase64,
      },
    },
  ]);

  const response = await result.response;
  const text = response.text();

  res.status(200).json(new ApiResponse(200, text));
});
