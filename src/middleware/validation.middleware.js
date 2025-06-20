import { ApiError } from '../utils/apiError.js';

// Middleware to validate request body against a Zod schema
export const validateRequest = schema => (req, res, next) => {
  try {
    const validationResult = schema.safeParse(req.body);

    if (!validationResult.success) {
      // Format validation errors into a readable message
      const errorMessage = validationResult.error.errors
        .map(error => `${error.path.join('.')}: ${error.message}`)
        .join(', ');

      throw new ApiError(400, errorMessage);
    }

    // Add the validated data to the request object
    req.validatedData = validationResult.data;

    next();
  } catch (error) {
    // Pass the error to the error handling middleware
    next(error);
  }
};

// Middleware to validate request query parameters
export const validateQuery = schema => (req, res, next) => {
  try {
    const validationResult = schema.safeParse(req.query);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors
        .map(error => `${error.path.join('.')}: ${error.message}`)
        .join(', ');

      throw new ApiError(400, errorMessage);
    }

    // Add the validated query to the request object
    req.validatedQuery = validationResult.data;

    next();
  } catch (error) {
    next(error);
  }
};

// Middleware to validate request params
export const validateParams = schema => (req, res, next) => {
  try {
    const validationResult = schema.safeParse(req.params);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors
        .map(error => `${error.path.join('.')}: ${error.message}`)
        .join(', ');

      throw new ApiError(400, errorMessage);
    }

    // Add the validated params to the request object
    req.validatedParams = validationResult.data;

    next();
  } catch (error) {
    next(error);
  }
};
