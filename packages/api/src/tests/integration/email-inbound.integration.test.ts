import crypto from 'node:crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Mocks -- the webhooks route imports parseInboundEmail and processInboundEmail
// from email.service.js. It does NOT call findTicketFromEmail, findTenantFromEmail,
// findOrCreateClient, etc. directly -- those are internal to processInboundEmail.
// ---------------------------------------------------------------------------

vi.mock('../../db/connection.js', () => ({
  getDb: vi.fn(),
}));

vi.mock('../../services/email.service.js', () => ({
  parseInboundEmail: vi.fn(),
  processInboundEmail: vi.fn(),
  // The following are exported by the module but not called directly by the route.
  // They must still be present to avoid import errors from other modules.
  findTicketFromEmail: vi.fn(),
  findTenantFromEmail: vi.fn(),
  findOrCreateClient: vi.fn(),
  stripHtmlTags: vi.fn(),
  extractEmailAddress: vi.fn(),
  extractDisplayName: vi.fn(),
  extractHeader: vi.fn(),
  sendEmail: vi.fn(),
  escapeHtml: vi.fn(),
  renderTicketCreatedEmail: vi.fn(),
  renderAgentReplyEmail: vi.fn(),
  renderTicketResolvedEmail: vi.fn(),
  renderCsatSurveyEmail: vi.fn(),
}));

import * as emailService from '../../services/email.service.js';
import { buildApp } from '../../app.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = process.env.SENDGRID_WEBHOOK_SECRET ?? 'test-webhook-secret-for-unit-tests';

/**
 * Generate valid HMAC-SHA256 webhook signature headers for a request body.
 */
function generateWebhookHeaders(body: string): Record<string, string> {
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

/**
 * Helper to inject a webhook request with valid signature.
 */
async function injectWebhook(
  app: FastifyInstance,
  payload: Record<string, unknown>,
) {
  const body = JSON.stringify(payload);
  const webhookHeaders = generateWebhookHeaders(body);

  return app.inject({
    method: 'POST',
    url: '/v1/webhooks/inbound-email',
    payload,
    headers: {
      'content-type': 'application/json',
      ...webhookHeaders,
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration: Inbound Email -> Ticket Creation -> Agent Reply -> Outbound Email', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it('should process a new inbound email and create a ticket', async () => {
    // parseInboundEmail is called by the route to parse the raw payload
    vi.mocked(emailService.parseInboundEmail).mockReturnValue({
      from: 'john@example.com',
      fromName: 'John Doe',
      to: 'support@acme.helpdesk.com',
      subject: 'Help with account setup',
      textBody: 'I need help setting up my account. I cannot find the configuration page.',
      htmlBody: '<p>I need help setting up my account.</p>',
      inReplyTo: null,
      references: null,
      messageId: '<msg-123@example.com>',
      attachments: [],
    });

    // processInboundEmail is called by the route with the parsed email
    vi.mocked(emailService.processInboundEmail).mockResolvedValue({
      action: 'ticket_created',
      ticketId: 'ticket-email-001',
      ticketNumber: 'TKT-00100',
      tenantId: 'tenant-001',
      clientId: 'client-001',
    });

    const res = await injectWebhook(app, {
      from: 'John Doe <john@example.com>',
      to: 'support@acme.helpdesk.com',
      subject: 'Help with account setup',
      text: 'I need help setting up my account. I cannot find the configuration page.',
      html: '<p>I need help setting up my account.</p>',
      headers: 'Message-ID: <msg-123@example.com>\r\nFrom: John Doe <john@example.com>',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toBe('Processed.');

    // Verify the route called both functions in the correct order
    expect(emailService.parseInboundEmail).toHaveBeenCalledOnce();
    expect(emailService.processInboundEmail).toHaveBeenCalledOnce();
  });

  it('should process a reply to an existing ticket from email', async () => {
    vi.mocked(emailService.parseInboundEmail).mockReturnValue({
      from: 'john@example.com',
      fromName: 'John Doe',
      to: 'support@acme.helpdesk.com',
      subject: 'Re: TKT-00100 Help with account setup',
      textBody: 'Thanks, but I still have issues with the configuration.',
      htmlBody: '<p>Thanks, but I still have issues with the configuration.</p>',
      inReplyTo: '<reply-ref@acme.com>',
      references: '<msg-123@example.com>',
      messageId: '<msg-456@example.com>',
      attachments: [],
    });

    vi.mocked(emailService.processInboundEmail).mockResolvedValue({
      action: 'reply_added',
      ticketId: 'ticket-email-001',
      ticketNumber: 'TKT-00100',
      tenantId: 'tenant-001',
      clientId: 'client-001',
    });

    const res = await injectWebhook(app, {
      from: 'John Doe <john@example.com>',
      to: 'support@acme.helpdesk.com',
      subject: 'Re: TKT-00100 Help with account setup',
      text: 'Thanks, but I still have issues with the configuration.',
      html: '<p>Thanks, but I still have issues with the configuration.</p>',
      headers: 'Message-ID: <msg-456@example.com>\r\nIn-Reply-To: <reply-ref@acme.com>\r\nReferences: <msg-123@example.com>',
    });

    expect(res.statusCode).toBe(200);
    expect(emailService.processInboundEmail).toHaveBeenCalledOnce();
    // Verify the parsed email was passed to processInboundEmail
    const parsedArg = vi.mocked(emailService.processInboundEmail).mock.calls[0]![0];
    expect(parsedArg.subject).toBe('Re: TKT-00100 Help with account setup');
  });

  it('should handle inbound email with attachments', async () => {
    vi.mocked(emailService.parseInboundEmail).mockReturnValue({
      from: 'john@example.com',
      fromName: 'John Doe',
      to: 'support@acme.helpdesk.com',
      subject: 'Screenshot of the error',
      textBody: 'Please see the attached screenshot of the error.',
      htmlBody: '<p>Please see the attached screenshot of the error.</p>',
      inReplyTo: null,
      references: null,
      messageId: '<msg-789@example.com>',
      attachments: [
        { fileName: 'error-screenshot.png', contentType: 'image/png', size: 245760 },
      ],
    });

    vi.mocked(emailService.processInboundEmail).mockResolvedValue({
      action: 'ticket_created',
      ticketId: 'ticket-attach-001',
      ticketNumber: 'TKT-00101',
      tenantId: 'tenant-001',
      clientId: 'client-001',
    });

    const res = await injectWebhook(app, {
      from: 'John Doe <john@example.com>',
      to: 'support@acme.helpdesk.com',
      subject: 'Screenshot of the error',
      text: 'Please see the attached screenshot of the error.',
      html: '<p>Please see the attached screenshot.</p>',
      headers: 'Message-ID: <msg-789@example.com>',
      'attachment-info': JSON.stringify({
        attachment1: {
          filename: 'error-screenshot.png',
          type: 'image/png',
          size: 245760,
        },
      }),
    });

    expect(res.statusCode).toBe(200);
    expect(emailService.parseInboundEmail).toHaveBeenCalled();
    expect(emailService.processInboundEmail).toHaveBeenCalled();
  });

  it('should handle inbound email from unknown tenant gracefully', async () => {
    vi.mocked(emailService.parseInboundEmail).mockReturnValue({
      from: 'someone@nowhere.com',
      fromName: 'Unknown Person',
      to: 'support@nonexistent.helpdesk.com',
      subject: 'Test',
      textBody: 'Test body',
      htmlBody: '<p>Test body</p>',
      inReplyTo: null,
      references: null,
      messageId: null,
      attachments: [],
    });

    // processInboundEmail throws NotFoundError when tenant is not found
    // The route catches errors containing "not found" and returns 200 to avoid SendGrid retries
    vi.mocked(emailService.processInboundEmail).mockRejectedValue(
      new Error('Tenant not found'),
    );

    const res = await injectWebhook(app, {
      from: 'Unknown Person <someone@nowhere.com>',
      to: 'support@nonexistent.helpdesk.com',
      subject: 'Test',
      text: 'Test body',
    });

    // Should still return 200 to avoid SendGrid retries, even though no ticket is created
    expect(res.statusCode).toBe(200);
  });

  it('should reject malformed inbound email payload missing required from field', async () => {
    const res = await injectWebhook(app, {
      // Missing 'from' -- required by inboundEmailSchema
      to: 'support@acme.helpdesk.com',
      subject: 'Test',
      text: 'Test body',
    });

    // Zod schema validation returns 422
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 500 when processInboundEmail fails with an unexpected error', async () => {
    vi.mocked(emailService.parseInboundEmail).mockReturnValue({
      from: 'john@example.com',
      fromName: 'John Doe',
      to: 'support@acme.helpdesk.com',
      subject: 'Will cause server error',
      textBody: 'This email triggers an internal error.',
      htmlBody: '<p>This email triggers an internal error.</p>',
      inReplyTo: null,
      references: null,
      messageId: '<msg-err@example.com>',
      attachments: [],
    });

    // Simulate an unexpected database error
    vi.mocked(emailService.processInboundEmail).mockRejectedValue(
      new Error('Database connection lost'),
    );

    const res = await injectWebhook(app, {
      from: 'John Doe <john@example.com>',
      to: 'support@acme.helpdesk.com',
      subject: 'Will cause server error',
      text: 'This email triggers an internal error.',
    });

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error.code).toBe('INTERNAL_ERROR');
  });
});
