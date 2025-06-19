export const geoCodeToLocation = async (lat, lng) => {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK') {
      return data.display_name || 'Location not found';
    } else {
      throw new Error('Reverse geocoding failed');
    }
  } catch (error) {
    console.error('Error fetching location:', error);
    throw error;
  }
};
