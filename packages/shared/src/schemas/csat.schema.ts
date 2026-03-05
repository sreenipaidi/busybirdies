import { z } from 'zod';

export const submitCSATSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export type SubmitCSATInput = z.infer<typeof submitCSATSchema>;
