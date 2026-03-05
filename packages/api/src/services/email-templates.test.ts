import { describe, it, expect, vi } from 'vitest';

// Mock database and logger
vi.mock('../db/connection.js', () => ({
  getDb: vi.fn(),
}));

vi.mock('../lib/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  escapeHtml,
  renderTicketCreatedEmail,
  renderAgentReplyEmail,
  renderTicketResolvedEmail,
  renderCsatSurveyEmail,
} from './email.service.js';

describe('escapeHtml', () => {
  it('should escape ampersands', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  it('should escape less-than signs', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('should escape greater-than signs', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  it('should escape double quotes', () => {
    expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
  });

  it('should escape single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('should escape all special characters in a mixed string', () => {
    const input = '<img src="x" onerror="alert(\'xss\')" />';
    const result = escapeHtml(input);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).not.toContain('"');
    expect(result).toContain('&lt;');
    expect(result).toContain('&gt;');
    expect(result).toContain('&quot;');
  });

  it('should handle empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('should not alter safe text', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });
});

describe('renderTicketCreatedEmail', () => {
  it('should escape user-controlled content in the HTML body', () => {
    const result = renderTicketCreatedEmail({
      ticketNumber: 'TKT-00001',
      subject: '<script>alert("xss")</script>',
      tenantName: 'Acme & Co',
      supportEmail: 'support@acme.com',
    });

    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('&lt;script&gt;');
    expect(result.html).toContain('Acme &amp; Co');
  });

  it('should use the raw subject in the email subject line (not HTML)', () => {
    const result = renderTicketCreatedEmail({
      ticketNumber: 'TKT-00001',
      subject: 'Normal subject',
      tenantName: 'Acme',
      supportEmail: 'support@acme.com',
    });

    expect(result.subject).toBe('[TKT-00001] Normal subject - Ticket Received');
  });
});

describe('renderAgentReplyEmail', () => {
  it('should escape agent name and ticket number', () => {
    const result = renderAgentReplyEmail({
      ticketNumber: 'TKT-00042',
      subject: 'Test subject',
      agentName: 'Agent <Evil>',
      replyBody: 'Thanks for contacting us.',
      tenantName: 'Acme',
      supportEmail: 'support@acme.com',
    });

    expect(result.html).toContain('Agent &lt;Evil&gt;');
    expect(result.html).not.toContain('Agent <Evil>');
  });

  it('should sanitize the reply body HTML', () => {
    const result = renderAgentReplyEmail({
      ticketNumber: 'TKT-00042',
      subject: 'Test',
      agentName: 'Agent Smith',
      replyBody: '<p>Hello</p><script>alert("xss")</script>',
      tenantName: 'Acme',
      supportEmail: 'support@acme.com',
    });

    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('<p>Hello</p>');
  });
});

describe('renderTicketResolvedEmail', () => {
  it('should escape all user-controlled content', () => {
    const result = renderTicketResolvedEmail({
      ticketNumber: 'TKT-00001',
      subject: 'Issue with "quotes" & <tags>',
      tenantName: 'Acme & Co',
      supportEmail: 'support@acme.com',
    });

    expect(result.html).toContain('&amp;');
    expect(result.html).toContain('&lt;tags&gt;');
    expect(result.html).toContain('&quot;quotes&quot;');
  });
});

describe('renderCsatSurveyEmail', () => {
  it('should escape the survey URL to prevent injection', () => {
    const result = renderCsatSurveyEmail({
      ticketNumber: 'TKT-00001',
      subject: 'Test subject',
      surveyUrl: 'https://example.com/survey?token=abc&param=value',
      tenantName: 'Acme',
      supportEmail: 'support@acme.com',
    });

    // The & in the URL should be escaped
    expect(result.html).toContain('&amp;param=value');
  });

  it('should escape subject containing HTML special characters', () => {
    const result = renderCsatSurveyEmail({
      ticketNumber: 'TKT-00001',
      subject: '<script>xss</script>',
      surveyUrl: 'https://example.com/survey',
      tenantName: 'Acme',
      supportEmail: 'support@acme.com',
    });

    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('&lt;script&gt;');
  });
});
