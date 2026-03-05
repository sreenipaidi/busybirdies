import { describe, it, expect, vi } from 'vitest';

// The rate-limit middleware is skipped in test environment (NODE_ENV=test),
// so we test the module exports and structure rather than actual rate limiting.

vi.mock('../db/connection.js', () => ({
  getDb: vi.fn(),
}));

import { registerRateLimit, authRateLimitConfig } from './rate-limit.middleware.js';

describe('rate-limit middleware', () => {
  it('should export registerRateLimit as a function', () => {
    expect(typeof registerRateLimit).toBe('function');
  });

  it('should export authRateLimitConfig with correct structure', () => {
    expect(authRateLimitConfig).toBeDefined();
    expect(authRateLimitConfig.config.rateLimit.max).toBe(10);
    expect(authRateLimitConfig.config.rateLimit.timeWindow).toBe(60000);
    expect(typeof authRateLimitConfig.config.rateLimit.keyGenerator).toBe('function');
  });

  it('should not register rate limit plugin in test environment', async () => {
    // In the test environment, registerRateLimit should return without registering
    const mockApp = {
      register: vi.fn(),
    };

    // Should not throw and should not register anything
    await registerRateLimit(mockApp as never);
    expect(mockApp.register).not.toHaveBeenCalled();
  });
});
