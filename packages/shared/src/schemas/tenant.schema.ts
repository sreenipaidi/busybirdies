import { z } from 'zod';

export const createTenantSchema = z.object({
  company_name: z.string().min(1, 'Company name is required').max(100),
  subdomain: z
    .string()
    .min(3, 'Subdomain must be at least 3 characters')
    .max(63)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Invalid subdomain format'),
  admin_email: z.string().email('Invalid email address'),
  admin_full_name: z.string().min(1, 'Admin name is required').max(100),
  admin_password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  brand_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color')
    .optional(),
  business_hours_start: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Invalid time format')
    .optional(),
  business_hours_end: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Invalid time format')
    .optional(),
  business_hours_timezone: z.string().max(50).optional(),
  business_hours_days: z
    .string()
    .regex(/^[0-6](,[0-6])*$/, 'Invalid days format')
    .optional(),
  team_lead_email: z.string().email().nullable().optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
