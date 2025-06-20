import { v2 as cloudinary } from 'cloudinary';
import { ApiError } from '../utils/apiError';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const cloudinaryUploader = async imageFile => {
  try {
    if (!imageFile) return null;

    //Upload
    const response = await cloudinary.uploader.upload(imageFile, {
      resource_type: 'auto',
    });

    return response;
  } catch (error) {
    throw new ApiError(500, 'Failed to upload image to Cloudinary', error);
  }
};

export const deleteImageFromCloud = async public_id => {
  cloudinary.uploader.destroy(public_id, (err, res) => {
    if (err) throw new ApiError(400, 'Unable to Delete from Image service', err);
    return res;
  });
};
