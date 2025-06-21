import FormData from 'form-data';
import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration - Replace with actual values
const SERVER_URL = 'http://localhost:8000';
const IMAGE_PATH = path.join(__dirname, '../test-images/disaster-image.jpg'); // Adjust path to your test image
const AUTH_TOKEN = 'your-auth-token'; // Replace with a valid token
const DISASTER_ID = 'sample-disaster-id'; // Replace with a valid disaster ID
const REPORT_ID = 'sample-report-id'; // Replace with a valid report ID

async function testImageVerification() {
  try {
    // Check if the image exists
    if (!fs.existsSync(IMAGE_PATH)) {
      console.error(`Image not found at ${IMAGE_PATH}`);
      console.log(
        'Please make sure you have a test image available or update the IMAGE_PATH variable.'
      );
      process.exit(1);
    }

    // Create form data with the image
    const formData = new FormData();
    formData.append('image', fs.createReadStream(IMAGE_PATH));
    formData.append('reportId', REPORT_ID);

    console.log(
      `Testing image verification for disaster ID: ${DISASTER_ID}, report ID: ${REPORT_ID}`
    );

    // Make the API request
    const response = await fetch(`${SERVER_URL}/api/disasters/${DISASTER_ID}/verify-image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        // Don't set Content-Type header as form-data will set it automatically with boundary
      },
      body: formData,
    });

    const result = await response.json();

    console.log('API Response Status:', response.status);
    console.log('API Response:', JSON.stringify(result, null, 2));

    if (response.status === 200) {
      console.log('✅ Image verification test successful!');
      console.log('Verification Status:', result.data.verificationStatus);
      console.log('Explanation:', result.data.explanation);
    } else {
      console.log('❌ Image verification test failed!');
    }
  } catch (error) {
    console.error('Error during test:', error.message);
  }
}

testImageVerification();
