import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_URL: z.string().default('http://localhost:3000'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  DATABASE_URL: z
    .string()
    .default('postgresql://supportdesk:supportdesk@localhost:5432/supportdesk'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters for adequate security'),
  JWT_ISSUER: z.string().default('supportdesk'),
  JWT_EMPLOYEE_EXPIRY: z.string().default('8h'),
  JWT_CLIENT_EXPIRY: z.string().default('24h'),
  LOG_LEVEL: z.string().default('info'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  SENDGRID_WEBHOOK_SECRET: z.string().optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

let config: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!config) {
    config = envSchema.parse(process.env);
  }
  return config;
}
