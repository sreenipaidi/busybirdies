import { z } from 'zod';
import { USER_ROLES } from '../constants/roles.js';

export const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  full_name: z.string().min(1, 'Full name is required').max(100),
  role: z.enum(['admin', 'agent'] as const),
});

export const activateUserSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const updateUserSchema = z.object({
  full_name: z.string().min(1).max(100).optional(),
  role: z.enum(USER_ROLES).optional(),
  is_active: z.boolean().optional(),
  password: z.string().min(8).max(128).optional(),
});

export const userListQuerySchema = z.object({
  role: z.enum(USER_ROLES).optional(),
  is_active: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  per_page: z.coerce.number().int().min(1).max(100).optional().default(25),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type ActivateUserInput = z.infer<typeof activateUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserListQuery = z.infer<typeof userListQuerySchema>;
