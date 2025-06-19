import { GoogleGenerativeAI } from '@google/generative-ai';

export const rawLocationToLocationData = async ({ locationName, description = 'no available' }) => {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `
    You are an AI that extracts geographic location data from input text.

    Given the following:
    - Raw location: "${locationName}"
    - Description: "${description}"

    Your task:
    - Extract the full location (from smallest to largest, e.g., area, city/town, district, state, country)
    - Return as a lowercase, comma-separated string.
    - Do not include any extra words, explanation, or punctuation. Just the location string.

    Example output:
    input: "Fire reported at Gariahat, near the bazaar."
    output: gariahat, kolkata, westbengal, india
  `;

  const result = await model.generateContent(prompt, { temperature: 0.5 });
  if (!result || !result.response) {
    throw new Error('Failed to process the location with AI');
  }

  const location = (await result.response.text()).trim().toLowerCase();
  console.log('Processed location:', location);

  // Optional: sanitize formatting (in case Gemini adds unexpected characters)
  const cleanedLocation = location
    .replace(/[^a-z,\s]/g, '')
    .replace(/\s*,\s*/g, ',')
    .trim();

  console.log('Cleaned location:', cleanedLocation);
  return cleanedLocation;
};
