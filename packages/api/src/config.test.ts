import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Config - JWT_SECRET validation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset the config module singleton between tests
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  it('should throw when JWT_SECRET is not set', async () => {
    delete process.env.JWT_SECRET;

    const { getConfig } = await import('./config.js');
    expect(() => getConfig()).toThrow();
  });

  it('should throw when JWT_SECRET is too short (less than 32 characters)', async () => {
    process.env.JWT_SECRET = 'short-secret';

    const { getConfig } = await import('./config.js');
    expect(() => getConfig()).toThrow('JWT_SECRET must be at least 32 characters');
  });

  it('should accept a JWT_SECRET with exactly 32 characters', async () => {
    process.env.JWT_SECRET = 'a'.repeat(32);

    const { getConfig } = await import('./config.js');
    const config = getConfig();
    expect(config.JWT_SECRET).toBe('a'.repeat(32));
  });

  it('should accept a JWT_SECRET longer than 32 characters', async () => {
    process.env.JWT_SECRET = 'a'.repeat(64);

    const { getConfig } = await import('./config.js');
    const config = getConfig();
    expect(config.JWT_SECRET).toBe('a'.repeat(64));
  });

  it('should not have a default fallback for JWT_SECRET', async () => {
    // Remove JWT_SECRET from env entirely
    delete process.env.JWT_SECRET;

    const { getConfig } = await import('./config.js');
    // If JWT_SECRET had a default, getConfig() would succeed.
    // Since we removed the default, it should fail.
    expect(() => getConfig()).toThrow();
  });

  it('should include SENDGRID_WEBHOOK_SECRET as optional config', async () => {
    process.env.SENDGRID_WEBHOOK_SECRET = 'my-webhook-secret';

    const { getConfig } = await import('./config.js');
    const config = getConfig();
    expect(config.SENDGRID_WEBHOOK_SECRET).toBe('my-webhook-secret');
  });

  it('should allow SENDGRID_WEBHOOK_SECRET to be omitted', async () => {
    delete process.env.SENDGRID_WEBHOOK_SECRET;

    const { getConfig } = await import('./config.js');
    const config = getConfig();
    expect(config.SENDGRID_WEBHOOK_SECRET).toBeUndefined();
  });
});
