import crypto from 'node:crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

// -------------------------------------------------------------------
// Mocks
// -------------------------------------------------------------------

vi.mock('../services/email.service.js', () => ({
  parseInboundEmail: vi.fn(),
  processInboundEmail: vi.fn(),
}));

vi.mock('../db/connection.js', () => ({
  getDb: vi.fn(),
}));

import * as emailService from '../services/email.service.js';

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

const WEBHOOK_SECRET = process.env.SENDGRID_WEBHOOK_SECRET ?? 'test-webhook-secret-for-unit-tests';

/**
 * Generate a valid HMAC-SHA256 webhook signature for the given body.
 * Returns the signature and timestamp headers.
 */
function generateWebhookHeaders(body: string): {
  'x-twilio-email-event-webhook-signature': string;
  'x-twilio-email-event-webhook-timestamp': string;
} {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const payload = timestamp + body;
  const signature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('base64');
  return {
    'x-twilio-email-event-webhook-signature': signature,
    'x-twilio-email-event-webhook-timestamp': timestamp,
  };
}

function validInboundPayload() {
  return {
    from: 'John Doe <john@example.com>',
    to: 'support@acme.helpdesk.com',
    subject: 'Need help with login',
    text: 'I cannot log in to my account.',
    html: '<p>I cannot log in to my account.</p>',
    headers: 'Message-ID: <msg123@example.com>',
    envelope: '{}',
    attachments: '0',
  };
}

/**
 * Helper to inject a webhook request with valid signature.
 */
async function injectWebhook(
  app: FastifyInstance,
  payload: Record<string, unknown>,
  options?: { omitSignature?: boolean; invalidSignature?: boolean },
) {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  if (!options?.omitSignature) {
    const webhookHeaders = generateWebhookHeaders(body);
    if (options?.invalidSignature) {
      webhookHeaders['x-twilio-email-event-webhook-signature'] = 'invalid-sig';
    }
    Object.assign(headers, webhookHeaders);
  }

  return app.inject({
    method: 'POST',
    url: '/v1/webhooks/inbound-email',
    payload,
    headers,
  });
}

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------

describe('Webhook routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  // ==========================================
  // POST /v1/webhooks/inbound-email
  // ==========================================
  describe('POST /v1/webhooks/inbound-email', () => {
    it('should return 200 when email is processed successfully for a new ticket', async () => {
      vi.mocked(emailService.parseInboundEmail).mockReturnValue({
        from: 'john@example.com',
        fromName: 'John Doe',
        to: 'support@acme.helpdesk.com',
        subject: 'Need help with login',
        textBody: 'I cannot log in to my account.',
        htmlBody: '<p>I cannot log in to my account.</p>',
        inReplyTo: null,
        references: null,
        messageId: '<msg123@example.com>',
        attachments: [],
      });

      vi.mocked(emailService.processInboundEmail).mockResolvedValue({
        action: 'ticket_created',
        ticketId: 'ticket-uuid',
        ticketNumber: 'TKT-00001',
        tenantId: 'tenant-uuid',
        clientId: 'client-uuid',
      });

      const response = await injectWebhook(app, validInboundPayload());

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Processed.');
    });

    it('should return 200 when email is a reply to an existing ticket', async () => {
      vi.mocked(emailService.parseInboundEmail).mockReturnValue({
        from: 'john@example.com',
        fromName: 'John Doe',
        to: 'support@acme.helpdesk.com',
        subject: 'Re: TKT-00042 Cannot login',
        textBody: 'Thanks for looking into this.',
        htmlBody: '<p>Thanks for looking into this.</p>',
        inReplyTo: '<prev-msg@example.com>',
        references: null,
        messageId: '<msg456@example.com>',
        attachments: [],
      });

      vi.mocked(emailService.processInboundEmail).mockResolvedValue({
        action: 'reply_added',
        ticketId: 'ticket-uuid',
        ticketNumber: 'TKT-00042',
        tenantId: 'tenant-uuid',
        clientId: 'client-uuid',
      });

      const payload = {
        ...validInboundPayload(),
        subject: 'Re: TKT-00042 Cannot login',
      };
      const response = await injectWebhook(app, payload);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Processed.');
    });

    it('should not require session cookie authentication (uses webhook signature instead)', async () => {
      vi.mocked(emailService.parseInboundEmail).mockReturnValue({
        from: 'john@example.com',
        fromName: 'John Doe',
        to: 'support@acme.helpdesk.com',
        subject: 'Test',
        textBody: 'Test body',
        htmlBody: '<p>Test body</p>',
        inReplyTo: null,
        references: null,
        messageId: null,
        attachments: [],
      });

      vi.mocked(emailService.processInboundEmail).mockResolvedValue({
        action: 'ticket_created',
        ticketId: 'ticket-uuid',
        ticketNumber: 'TKT-00001',
        tenantId: 'tenant-uuid',
        clientId: 'client-uuid',
      });

      // No session cookie -- should still work with valid webhook signature
      const response = await injectWebhook(app, validInboundPayload());

      expect(response.statusCode).toBe(200);
    });

    it('should return 401 when signature is missing', async () => {
      const response = await injectWebhook(app, validInboundPayload(), { omitSignature: true });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 when signature is invalid', async () => {
      const response = await injectWebhook(app, validInboundPayload(), { invalidSignature: true });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 422 when "from" is missing', async () => {
      const payload = {
        to: 'support@acme.helpdesk.com',
        subject: 'Test',
        text: 'Test body',
      };
      const response = await injectWebhook(app, payload);

      expect(response.statusCode).toBe(422);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 422 when "to" is missing', async () => {
      const payload = {
        from: 'user@example.com',
        subject: 'Test',
        text: 'Test body',
      };
      const response = await injectWebhook(app, payload);

      expect(response.statusCode).toBe(422);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 200 even when tenant is not found (to avoid SendGrid retries)', async () => {
      vi.mocked(emailService.parseInboundEmail).mockReturnValue({
        from: 'john@example.com',
        fromName: 'John Doe',
        to: 'support@unknown.helpdesk.com',
        subject: 'Test',
        textBody: 'Test body',
        htmlBody: '<p>Test body</p>',
        inReplyTo: null,
        references: null,
        messageId: null,
        attachments: [],
      });

      vi.mocked(emailService.processInboundEmail).mockRejectedValue(
        new Error('Tenant not found'),
      );

      const response = await injectWebhook(app, validInboundPayload());

      // Returns 200 to prevent SendGrid from retrying
      expect(response.statusCode).toBe(200);
    });

    it('should return 500 when an unexpected error occurs', async () => {
      vi.mocked(emailService.parseInboundEmail).mockReturnValue({
        from: 'john@example.com',
        fromName: 'John Doe',
        to: 'support@acme.helpdesk.com',
        subject: 'Test',
        textBody: 'Test body',
        htmlBody: '<p>Test body</p>',
        inReplyTo: null,
        references: null,
        messageId: null,
        attachments: [],
      });

      vi.mocked(emailService.processInboundEmail).mockRejectedValue(
        new Error('Database connection failed'),
      );

      const response = await injectWebhook(app, validInboundPayload());

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('should handle payload with optional fields omitted', async () => {
      vi.mocked(emailService.parseInboundEmail).mockReturnValue({
        from: 'john@example.com',
        fromName: 'john',
        to: 'support@acme.helpdesk.com',
        subject: '',
        textBody: '',
        htmlBody: '',
        inReplyTo: null,
        references: null,
        messageId: null,
        attachments: [],
      });

      vi.mocked(emailService.processInboundEmail).mockResolvedValue({
        action: 'ticket_created',
        ticketId: 'ticket-uuid',
        ticketNumber: 'TKT-00001',
        tenantId: 'tenant-uuid',
        clientId: 'client-uuid',
      });

      const payload = {
        from: 'john@example.com',
        to: 'support@acme.helpdesk.com',
      };
      const response = await injectWebhook(app, payload);

      expect(response.statusCode).toBe(200);
    });

    it('should call parseInboundEmail with the validated payload', async () => {
      vi.mocked(emailService.parseInboundEmail).mockReturnValue({
        from: 'john@example.com',
        fromName: 'John Doe',
        to: 'support@acme.helpdesk.com',
        subject: 'Need help',
        textBody: 'Help me please',
        htmlBody: '<p>Help me please</p>',
        inReplyTo: null,
        references: null,
        messageId: null,
        attachments: [],
      });

      vi.mocked(emailService.processInboundEmail).mockResolvedValue({
        action: 'ticket_created',
        ticketId: 'ticket-uuid',
        ticketNumber: 'TKT-00001',
        tenantId: 'tenant-uuid',
        clientId: 'client-uuid',
      });

      await injectWebhook(app, validInboundPayload());

      expect(emailService.parseInboundEmail).toHaveBeenCalledTimes(1);
      expect(emailService.processInboundEmail).toHaveBeenCalledTimes(1);
    });
  });
});
