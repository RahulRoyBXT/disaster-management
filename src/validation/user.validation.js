import { z } from 'zod';

// Schema for user ID validation
export const userIdSchema = z.object({
  id: z.string().uuid({ message: 'Invalid user ID format' }),
});

// Schema for user registration
export const registerUserSchema = z
  .object({
    email: z.string().email({ message: 'Invalid email format' }).optional(),
    username: z
      .string()
      .min(3, { message: 'Username must be at least 3 characters' })
      .max(50, { message: 'Username must be at most 50 characters' })
      .optional(),
    password: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters' })
      .max(100, { message: 'Password must be at most 100 characters' })
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
        message:
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      }),
  })
  .refine(data => data.email || data.username, {
    message: 'Either email or username must be provided',
    path: ['email', 'username'],
  });

// Schema for user login
export const loginUserSchema = z.object({
  username: z.string().min(1, { message: 'Username is required' }),
  password: z.string().min(1, { message: 'Password is required' }),
});

// Schema for password update (if needed in the future)
export const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: 'Current password is required' }),
    newPassword: z
      .string()
      .min(8, { message: 'New password must be at least 8 characters' })
      .max(100, { message: 'New password must be at most 100 characters' })
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
        message:
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      }),
    confirmPassword: z.string().min(1, { message: 'Confirm password is required' }),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

// Schema for user profile update (if needed in the future)
export const updateUserProfileSchema = z.object({
  email: z.string().email({ message: 'Invalid email format' }).optional(),
  username: z
    .string()
    .min(3, { message: 'Username must be at least 3 characters' })
    .max(50, { message: 'Username must be at most 50 characters' })
    .optional(),
  // Add other profile fields as needed
});
