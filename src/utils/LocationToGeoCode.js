export const locationToGeoCode = async location => {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    location
  )}&limit=1`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      return { lat, lng };
    } else {
      throw new Error('Geocoding failed');
    }
  } catch (error) {
    console.error('Error fetching geocode:', error);

    if (error instanceof TypeError) {
      throw new Error('Network error or invalid response');
    }
    if (error instanceof SyntaxError) {
      throw new Error('Invalid JSON response from geocoding service');
    }
    // Handle other errors
    console.error('Unexpected error fetching geocode:', error);
    throw error;
  }
};
