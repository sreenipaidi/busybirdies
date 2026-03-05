import { z } from 'zod';

export const updateSLAPolicySchema = z
  .object({
    first_response_minutes: z.number().int().min(1, 'Must be at least 1 minute'),
    resolution_minutes: z.number().int().min(1, 'Must be at least 1 minute'),
  })
  .refine((data) => data.resolution_minutes >= data.first_response_minutes, {
    message: 'Resolution time must be greater than or equal to first response time',
    path: ['resolution_minutes'],
  });

export type UpdateSLAPolicyInput = z.infer<typeof updateSLAPolicySchema>;
