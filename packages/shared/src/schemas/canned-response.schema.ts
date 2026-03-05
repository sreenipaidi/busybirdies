import { z } from 'zod';

export const createCannedResponseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  body: z.string().min(1, 'Body is required').max(50000),
  category: z.string().max(50).optional(),
});

export const updateCannedResponseSchema = createCannedResponseSchema.partial();

export type CreateCannedResponseInput = z.infer<typeof createCannedResponseSchema>;
export type UpdateCannedResponseInput = z.infer<typeof updateCannedResponseSchema>;
