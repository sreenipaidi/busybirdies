import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  portal: z.string().min(1, 'Portal subdomain is required'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  full_name: z.string().min(1, 'Full name is required').max(100),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  portal: z.string().min(1, 'Portal subdomain is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  portal: z.string().min(1, 'Portal subdomain is required'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const googleAuthSchema = z.object({
  id_token: z.string().min(1, 'ID token is required'),
  portal: z.string().min(1, 'Portal subdomain is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
