import crypto from 'node:crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyWebhookSignature } from './webhooks.routes.js';

// Mock logger
vi.mock('../lib/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock db connection (needed by email.service.js imports)
vi.mock('../db/connection.js', () => ({
  getDb: vi.fn(),
}));

const TEST_SECRET = process.env.SENDGRID_WEBHOOK_SECRET ?? 'test-webhook-secret-for-unit-tests';

function generateSignature(body: string, timestamp: string, secret: string): string {
  const payload = timestamp + body;
  return crypto.createHmac('sha256', secret).update(payload).digest('base64');
}

describe('verifyWebhookSignature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true for a valid HMAC signature', () => {
    const body = '{"from":"test@example.com","to":"support@acme.com"}';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = generateSignature(body, timestamp, TEST_SECRET);

    const result = verifyWebhookSignature(signature, timestamp, body);
    expect(result).toBe(true);
  });

  it('should return false when signature is missing', () => {
    const body = '{"from":"test@example.com"}';
    const timestamp = String(Math.floor(Date.now() / 1000));

    const result = verifyWebhookSignature(undefined, timestamp, body);
    expect(result).toBe(false);
  });

  it('should return false when timestamp is missing', () => {
    const body = '{"from":"test@example.com"}';
    const signature = 'some-signature';

    const result = verifyWebhookSignature(signature, undefined, body);
    expect(result).toBe(false);
  });

  it('should return false when both signature and timestamp are missing', () => {
    const body = '{"from":"test@example.com"}';

    const result = verifyWebhookSignature(undefined, undefined, body);
    expect(result).toBe(false);
  });

  it('should return false for an invalid signature', () => {
    const body = '{"from":"test@example.com"}';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const invalidSignature = Buffer.from('wrong-signature').toString('base64');

    const result = verifyWebhookSignature(invalidSignature, timestamp, body);
    expect(result).toBe(false);
  });

  it('should return false when body has been tampered with', () => {
    const originalBody = '{"from":"test@example.com"}';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = generateSignature(originalBody, timestamp, TEST_SECRET);

    const tamperedBody = '{"from":"attacker@evil.com"}';
    const result = verifyWebhookSignature(signature, timestamp, tamperedBody);
    expect(result).toBe(false);
  });

  it('should return false when timestamp has been tampered with', () => {
    const body = '{"from":"test@example.com"}';
    const realTimestamp = String(Math.floor(Date.now() / 1000));
    const signature = generateSignature(body, realTimestamp, TEST_SECRET);

    const fakeTimestamp = String(Math.floor(Date.now() / 1000) - 1000);
    const result = verifyWebhookSignature(signature, fakeTimestamp, body);
    expect(result).toBe(false);
  });

  it('should return false when signed with a different secret', () => {
    const body = '{"from":"test@example.com"}';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const wrongSignature = generateSignature(body, timestamp, 'wrong-secret-key');

    const result = verifyWebhookSignature(wrongSignature, timestamp, body);
    expect(result).toBe(false);
  });

  it('should handle empty body correctly', () => {
    const body = '';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = generateSignature(body, timestamp, TEST_SECRET);

    const result = verifyWebhookSignature(signature, timestamp, body);
    expect(result).toBe(true);
  });
});
