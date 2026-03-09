import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/connection.js';
import { tenants, users, tickets, ticketReplies, ticketAuditEntries } from '../db/schema.js';
import { AppError, NotFoundError } from '../lib/errors.js';
import { getLogger } from '../lib/logger.js';
import { getConfig } from '../config.js';
import { sanitizeRichText } from '../lib/sanitize.js';
import type { UserRole } from '@busybirdies/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parsed representation of an inbound email from SendGrid Inbound Parse. */
export interface ParsedInboundEmail {
  from: string;
  fromName: string;
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  inReplyTo: string | null;
  references: string | null;
  messageId: string | null;
  attachments: InboundAttachment[];
}

/** Attachment metadata from the inbound email payload. */
export interface InboundAttachment {
  fileName: string;
  contentType: string;
  size: number;
}

/** The raw SendGrid Inbound Parse payload fields. */
export interface SendGridInboundPayload {
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  headers?: string;
  envelope?: string;
  attachments?: string;
  'attachment-info'?: string;
}

/** Supported outbound email job types. */
export type EmailJobType =
  | 'ticket_created'
  | 'agent_reply'
  | 'ticket_resolved'
  | 'csat_survey';

/** Data for an outbound email job placed on the BullMQ queue. */
export interface EmailJobData {
  type: EmailJobType;
  to: string;
  subject: string;
  html: string;
  tenantId: string;
  ticketId?: string;
  ticketNumber?: string;
}

// ---------------------------------------------------------------------------
// Inbound Email Parsing
// ---------------------------------------------------------------------------

/**
 * Extract the email address from a "From" header value.
 * Handles formats like "John Doe <john@example.com>" and "john@example.com".
 */
export function extractEmailAddress(from: string): string {
  const match = /<([^>]+)>/.exec(from);
  if (match?.[1]) {
    return match[1].toLowerCase().trim();
  }
  return from.toLowerCase().trim();
}

/**
 * Extract the display name from a "From" header value.
 * Returns the part before the angle-bracket email, or the email itself if no name.
 */
export function extractDisplayName(from: string): string {
  const match = /^"?([^"<]+)"?\s*</.exec(from);
  if (match?.[1]) {
    return match[1].trim();
  }
  return extractEmailAddress(from);
}

/**
 * Extract a specific header value from a raw email headers string.
 */
export function extractHeader(headers: string, headerName: string): string | null {
  const regex = new RegExp(`^${headerName}:\\s*(.+)$`, 'im');
  const match = regex.exec(headers);
  return match?.[1]?.trim() ?? null;
}

/**
 * Parse a SendGrid Inbound Parse webhook payload into a structured
 * ParsedInboundEmail object.
 */
export function parseInboundEmail(payload: SendGridInboundPayload): ParsedInboundEmail {
  const logger = getLogger();

  const from = payload.from ?? '';
  const to = payload.to ?? '';
  const subject = payload.subject ?? '(No Subject)';
  const textBody = payload.text ?? '';
  const htmlBody = payload.html ?? '';

  // Parse headers for In-Reply-To and References
  const headers = payload.headers ?? '';
  const inReplyTo = extractHeader(headers, 'In-Reply-To');
  const references = extractHeader(headers, 'References');
  const messageId = extractHeader(headers, 'Message-ID') ?? extractHeader(headers, 'Message-Id');

  // Parse attachment info
  const attachments: InboundAttachment[] = [];
  if (payload['attachment-info']) {
    try {
      const attachmentInfo = JSON.parse(payload['attachment-info']) as Record<
        string,
        { filename?: string; name?: string; type?: string; 'content-type'?: string; size?: number }
      >;
      for (const key of Object.keys(attachmentInfo)) {
        const info = attachmentInfo[key];
        if (info) {
          attachments.push({
            fileName: info.filename ?? info.name ?? `attachment-${key}`,
            contentType: info.type ?? info['content-type'] ?? 'application/octet-stream',
            size: info.size ?? 0,
          });
        }
      }
    } catch (err) {
      logger.error({ err }, 'Failed to parse attachment-info from inbound email');
    }
  }

  logger.info(
    { from: extractEmailAddress(from), to, subject, attachmentCount: attachments.length },
    'Parsed inbound email',
  );

  return {
    from: extractEmailAddress(from),
    fromName: extractDisplayName(from),
    to,
    subject,
    textBody,
    htmlBody,
    inReplyTo,
    references,
    messageId,
    attachments,
  };
}

// ---------------------------------------------------------------------------
// Ticket Matching
// ---------------------------------------------------------------------------

/** Pattern to match ticket numbers like TKT-00042 in the email subject. */
const TICKET_NUMBER_PATTERN = /TKT-\d{5}/;

/**
 * Attempt to find an existing ticket from the email subject or message references.
 *
 * Checks:
 * 1. Subject line for a ticket number pattern (e.g. "Re: TKT-00042 Cannot login")
 * 2. In-Reply-To / References headers (future: match against stored message IDs)
 *
 * Returns the ticket ID and tenant ID if a match is found, or null otherwise.
 */
export async function findTicketFromEmail(
  subject: string,
  inReplyTo: string | null,
  _references: string | null,
): Promise<{ ticketId: string; tenantId: string; ticketNumber: string } | null> {
  const logger = getLogger();
  const db = getDb();

  // Strategy 1: Match ticket number in subject
  const match = TICKET_NUMBER_PATTERN.exec(subject);
  if (match?.[0]) {
    const ticketNumber = match[0];
    logger.info({ ticketNumber }, 'Found ticket number in email subject');

    const [ticket] = await db
      .select({
        id: tickets.id,
        tenantId: tickets.tenantId,
        ticketNumber: tickets.ticketNumber,
      })
      .from(tickets)
      .where(eq(tickets.ticketNumber, ticketNumber))
      .limit(1);

    if (ticket) {
      return {
        ticketId: ticket.id,
        tenantId: ticket.tenantId,
        ticketNumber: ticket.ticketNumber,
      };
    }

    logger.warn({ ticketNumber }, 'Ticket number found in subject but no matching ticket exists');
  }

  // Strategy 2: In-Reply-To header (stub -- would match against stored message IDs)
  if (inReplyTo) {
    logger.info({ inReplyTo }, 'In-Reply-To header present but message ID matching is not yet implemented');
  }

  return null;
}

// ---------------------------------------------------------------------------
// Tenant Resolution
// ---------------------------------------------------------------------------

/**
 * Determine the tenant from the "to" email address.
 * Looks up the tenant whose support_email matches the "to" address.
 *
 * For example: support@acme.helpdesk.com -> find tenant with support_email = "support@acme.helpdesk.com"
 *
 * Also supports matching by subdomain extracted from the "to" address
 * (e.g., anything@acme.helpdesk.com -> tenant with subdomain "acme").
 */
export async function findTenantFromEmail(
  toAddress: string,
): Promise<{ tenantId: string; tenantName: string; subdomain: string } | null> {
  const logger = getLogger();
  const db = getDb();

  // Normalize: extract the first email address from the "to" field
  const emailAddress = extractEmailAddress(toAddress);

  // Strategy 1: Exact match on support_email
  const [tenantByEmail] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      subdomain: tenants.subdomain,
    })
    .from(tenants)
    .where(eq(tenants.supportEmail, emailAddress))
    .limit(1);

  if (tenantByEmail) {
    return {
      tenantId: tenantByEmail.id,
      tenantName: tenantByEmail.name,
      subdomain: tenantByEmail.subdomain,
    };
  }

  // Strategy 2: Extract subdomain from the to-address domain
  // e.g., anything@acme.helpdesk.com -> subdomain = "acme"
  const domainMatch = /@([^.]+)\./.exec(emailAddress);
  if (domainMatch?.[1]) {
    const subdomain = domainMatch[1];
    const [tenantBySubdomain] = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        subdomain: tenants.subdomain,
      })
      .from(tenants)
      .where(eq(tenants.subdomain, subdomain))
      .limit(1);

    if (tenantBySubdomain) {
      return {
        tenantId: tenantBySubdomain.id,
        tenantName: tenantBySubdomain.name,
        subdomain: tenantBySubdomain.subdomain,
      };
    }
  }

  logger.warn({ toAddress: emailAddress }, 'Could not determine tenant from email address');
  return null;
}

// ---------------------------------------------------------------------------
// Client Resolution
// ---------------------------------------------------------------------------

/**
 * Find an existing client user in a tenant by email address, or create a new
 * client user if one does not exist.
 *
 * When creating a new client, the user is marked as active with email verified
 * (since they sent the email from that address). No password is set -- the
 * user can use the "forgot password" flow to gain portal access.
 */
export async function findOrCreateClient(
  tenantId: string,
  email: string,
  name: string,
): Promise<{ id: string; email: string; fullName: string; role: UserRole; isNew: boolean }> {
  const logger = getLogger();
  const db = getDb();

  const normalizedEmail = email.toLowerCase().trim();

  // Try to find existing user by email in this tenant
  const [existingUser] = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
    })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.email, normalizedEmail)))
    .limit(1);

  if (existingUser) {
    return {
      id: existingUser.id,
      email: existingUser.email,
      fullName: existingUser.fullName,
      role: existingUser.role as UserRole,
      isNew: false,
    };
  }

  // Create a new client user
  const displayName = name !== normalizedEmail ? name : normalizedEmail.split('@')[0] ?? name;

  const [newUser] = await db
    .insert(users)
    .values({
      tenantId,
      email: normalizedEmail,
      fullName: displayName,
      role: 'client',
      isActive: true,
      emailVerified: true, // Email is implicitly verified since they sent from it
    })
    .returning({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
    });

  if (!newUser) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create client user from email');
  }

  logger.info(
    { tenantId, email: normalizedEmail, userId: newUser.id },
    'Created new client user from inbound email',
  );

  return {
    id: newUser.id,
    email: newUser.email,
    fullName: newUser.fullName,
    role: newUser.role as UserRole,
    isNew: true,
  };
}

// ---------------------------------------------------------------------------
// HTML Escaping Utility
// ---------------------------------------------------------------------------

/**
 * Escape HTML special characters in a string to prevent injection
 * when embedding user-controlled content in email templates.
 *
 * @param str - The untrusted string to escape
 * @returns The HTML-escaped string safe for embedding in templates
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Email Templates
// ---------------------------------------------------------------------------

/**
 * Render the "ticket created" confirmation email template.
 */
export function renderTicketCreatedEmail(params: {
  ticketNumber: string;
  subject: string;
  tenantName: string;
  supportEmail: string;
}): { subject: string; html: string } {
  const safeTicketNumber = escapeHtml(params.ticketNumber);
  const safeSubject = escapeHtml(params.subject);
  const safeTenantName = escapeHtml(params.tenantName);
  const safeSupportEmail = escapeHtml(params.supportEmail);

  return {
    subject: `[${params.ticketNumber}] ${params.subject} - Ticket Received`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your request has been received</h2>
        <p>Hi,</p>
        <p>We have received your support request and created ticket <strong>${safeTicketNumber}</strong>.</p>
        <p><strong>Subject:</strong> ${safeSubject}</p>
        <p>Our team will review your request and get back to you as soon as possible.</p>
        <p>You can reply to this email to add more information to your ticket.</p>
        <hr />
        <p style="color: #666; font-size: 12px;">
          ${safeTenantName} Support | ${safeSupportEmail}
        </p>
      </div>
    `.trim(),
  };
}

/**
 * Render the "agent reply" notification email template.
 */
export function renderAgentReplyEmail(params: {
  ticketNumber: string;
  subject: string;
  agentName: string;
  replyBody: string;
  tenantName: string;
  supportEmail: string;
}): { subject: string; html: string } {
  const safeTicketNumber = escapeHtml(params.ticketNumber);
  const safeSubject = escapeHtml(params.subject);
  const safeAgentName = escapeHtml(params.agentName);
  const safeReplyBody = sanitizeRichText(params.replyBody);
  const safeTenantName = escapeHtml(params.tenantName);
  const safeSupportEmail = escapeHtml(params.supportEmail);

  return {
    subject: `Re: [${params.ticketNumber}] ${params.subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New reply on your ticket</h2>
        <p><strong>${safeAgentName}</strong> replied to your ticket <strong>${safeTicketNumber}</strong> (${safeSubject}):</p>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 4px; margin: 16px 0;">
          ${safeReplyBody}
        </div>
        <p>You can reply to this email to respond.</p>
        <hr />
        <p style="color: #666; font-size: 12px;">
          ${safeTenantName} Support | ${safeSupportEmail}
        </p>
      </div>
    `.trim(),
  };
}

/**
 * Render the "ticket resolved" notification email template.
 */
export function renderTicketResolvedEmail(params: {
  ticketNumber: string;
  subject: string;
  tenantName: string;
  supportEmail: string;
}): { subject: string; html: string } {
  const safeTicketNumber = escapeHtml(params.ticketNumber);
  const safeSubject = escapeHtml(params.subject);
  const safeTenantName = escapeHtml(params.tenantName);
  const safeSupportEmail = escapeHtml(params.supportEmail);

  return {
    subject: `[${params.ticketNumber}] ${params.subject} - Resolved`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your ticket has been resolved</h2>
        <p>Hi,</p>
        <p>Your ticket <strong>${safeTicketNumber}</strong> has been marked as resolved.</p>
        <p><strong>Subject:</strong> ${safeSubject}</p>
        <p>If you still need help, you can reply to this email to reopen the ticket.</p>
        <hr />
        <p style="color: #666; font-size: 12px;">
          ${safeTenantName} Support | ${safeSupportEmail}
        </p>
      </div>
    `.trim(),
  };
}

/**
 * Render the CSAT survey email template.
 */
export function renderCsatSurveyEmail(params: {
  ticketNumber: string;
  subject: string;
  surveyUrl: string;
  tenantName: string;
  supportEmail: string;
}): { subject: string; html: string } {
  const safeTicketNumber = escapeHtml(params.ticketNumber);
  const safeSubject = escapeHtml(params.subject);
  const safeSurveyUrl = escapeHtml(params.surveyUrl);
  const safeTenantName = escapeHtml(params.tenantName);
  const safeSupportEmail = escapeHtml(params.supportEmail);

  return {
    subject: `How was your experience? [${params.ticketNumber}]`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>How did we do?</h2>
        <p>Hi,</p>
        <p>Your ticket <strong>${safeTicketNumber}</strong> ("${safeSubject}") was recently resolved.</p>
        <p>We would love to hear your feedback. Please take a moment to rate your experience:</p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${safeSurveyUrl}" style="background: #2563EB; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-weight: bold;">
            Rate Your Experience
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">Your feedback helps us improve our support.</p>
        <hr />
        <p style="color: #666; font-size: 12px;">
          ${safeTenantName} Support | ${safeSupportEmail}
        </p>
      </div>
    `.trim(),
  };
}

// ---------------------------------------------------------------------------
// Outbound Email (Stub)
// ---------------------------------------------------------------------------

/**
 * Send an email. This is a stub implementation that logs the email
 * instead of actually sending it.
 *
 * TODO: Integrate with SendGrid API or nodemailer + SMTP transport
 * for production email delivery.
 */
/**
 * Render the email verification template.
 */
export function renderVerificationEmail(params: {
  fullName: string;
  verifyUrl: string;
  tenantName: string;
}): { subject: string; html: string } {
  const safeName = escapeHtml(params.fullName);
  const safeUrl = escapeHtml(params.verifyUrl);
  const safeTenantName = escapeHtml(params.tenantName);

  return {
    subject: `Verify your email address - ${params.tenantName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Verify your email address</h2>
        <p>Hi ${safeName},</p>
        <p>Thanks for registering with ${safeTenantName}. Please verify your email address by clicking the button below:</p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${safeUrl}" style="background: #2563EB; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-weight: bold;">
            Verify Email Address
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">This link expires in 24 hours. If you did not register, you can ignore this email.</p>
        <p style="color: #666; font-size: 12px;">Or copy this link: ${safeUrl}</p>
      </div>
    `.trim(),
  };
}

/**
 * Send an email via SendGrid if API key is configured, otherwise log (dev mode).
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const logger = getLogger();
  const config = getConfig();

  if (config.SENDGRID_API_KEY && config.SENDGRID_API_KEY !== 'SG.xxx') {
    const sgMail = await import('@sendgrid/mail');
    sgMail.default.setApiKey(config.SENDGRID_API_KEY);
    await sgMail.default.send({
      to,
      from: config.SENDGRID_FROM_EMAIL,
      subject,
      html,
    });
    logger.info({ to, subject }, 'Email sent via SendGrid');
  } else {
    // Dev mode: log the email instead of sending
    logger.info(
      { to, subject, htmlLength: html.length },
      '[DEV] Email send requested (no SendGrid key -- not actually sent)',
    );
  }
}

// ---------------------------------------------------------------------------
// Inbound Email Processing (Orchestrator)
// ---------------------------------------------------------------------------

/**
 * Process a complete inbound email: determine tenant, match or create ticket,
 * find or create the client user, and add the email content as a reply or
 * new ticket.
 *
 * Returns a summary of the action taken.
 */
export async function processInboundEmail(
  parsed: ParsedInboundEmail,
): Promise<{
  action: 'reply_added' | 'ticket_created';
  ticketId: string;
  ticketNumber: string;
  tenantId: string;
  clientId: string;
}> {
  const logger = getLogger();
  const db = getDb();

  // 1. Determine tenant from the "to" address
  const tenant = await findTenantFromEmail(parsed.to);
  if (!tenant) {
    throw new NotFoundError('Tenant');
  }

  // 2. Find or create the client user
  const client = await findOrCreateClient(
    tenant.tenantId,
    parsed.from,
    parsed.fromName,
  );

  // 3. Check if this is a reply to an existing ticket
  const existingTicket = await findTicketFromEmail(
    parsed.subject,
    parsed.inReplyTo,
    parsed.references,
  );

  if (existingTicket && existingTicket.tenantId === tenant.tenantId) {
    // This is a reply to an existing ticket
    logger.info(
      { ticketId: existingTicket.ticketId, ticketNumber: existingTicket.ticketNumber },
      'Adding email as reply to existing ticket',
    );

    // Determine the body to use: prefer text, fall back to sanitized HTML stripped of tags
    const rawBody = parsed.textBody || stripHtmlTags(parsed.htmlBody) || '(Empty reply)';
    const body = sanitizeRichText(rawBody);

    // Insert as a reply
    const [reply] = await db
      .insert(ticketReplies)
      .values({
        ticketId: existingTicket.ticketId,
        userId: client.id,
        body,
        isInternal: false,
        source: 'email',
      })
      .returning({ id: ticketReplies.id });

    if (!reply) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create reply from email');
    }

    // Update ticket timestamps
    await db
      .update(tickets)
      .set({ updatedAt: new Date() })
      .where(eq(tickets.id, existingTicket.ticketId));

    // If the ticket is resolved and a client replies, reopen it
    const [ticketRow] = await db
      .select({ status: tickets.status })
      .from(tickets)
      .where(eq(tickets.id, existingTicket.ticketId))
      .limit(1);

    if (ticketRow?.status === 'resolved') {
      await db
        .update(tickets)
        .set({ status: 'open', resolvedAt: null, updatedAt: new Date() })
        .where(eq(tickets.id, existingTicket.ticketId));

      await db.insert(ticketAuditEntries).values({
        ticketId: existingTicket.ticketId,
        userId: client.id,
        action: 'field_changed',
        fieldName: 'status',
        oldValue: 'resolved',
        newValue: 'open',
        metadata: { reason: 'client_email_reply' },
      });
    }

    return {
      action: 'reply_added',
      ticketId: existingTicket.ticketId,
      ticketNumber: existingTicket.ticketNumber,
      tenantId: tenant.tenantId,
      clientId: client.id,
    };
  }

  // 4. Create a new ticket
  logger.info({ tenantId: tenant.tenantId }, 'Creating new ticket from inbound email');

  // Generate ticket number using atomic increment
  const { sql } = await import('drizzle-orm');
  const [incrementResult] = await db
    .update(tenants)
    .set({
      ticketCounter: sql`${tenants.ticketCounter} + 1`,
    })
    .where(eq(tenants.id, tenant.tenantId))
    .returning({ counter: tenants.ticketCounter });

  if (!incrementResult) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to generate ticket number');
  }

  const ticketNumber = `TKT-${String(incrementResult.counter).padStart(5, '0')}`;

  const subject = parsed.subject || '(No Subject)';
  const rawDescription = parsed.textBody || stripHtmlTags(parsed.htmlBody) || '(No content)';
  const description = sanitizeRichText(rawDescription);

  const [newTicket] = await db
    .insert(tickets)
    .values({
      tenantId: tenant.tenantId,
      ticketNumber,
      subject,
      description,
      priority: 'medium',
      status: 'open',
      clientId: client.id,
      createdById: client.id,
      source: 'email',
    })
    .returning({
      id: tickets.id,
      ticketNumber: tickets.ticketNumber,
    });

  if (!newTicket) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create ticket from email');
  }

  // Create audit entry for ticket creation
  await db.insert(ticketAuditEntries).values({
    ticketId: newTicket.id,
    userId: null,
    action: 'created',
    metadata: { source: 'email', from: parsed.from },
  });

  // Run auto-assignment for the new ticket
  try {
    const { evaluateAndAssign } = await import('./auto-assign.service.js');
    await evaluateAndAssign(tenant.tenantId, newTicket.id);
  } catch (err) {
    logger.error(
      { err, tenantId: tenant.tenantId, ticketId: newTicket.id },
      'Failed to auto-assign email ticket',
    );
  }

  // Calculate SLA deadlines
  try {
    const { calculateAndSetDeadlines } = await import('./sla.service.js');
    await calculateAndSetDeadlines(tenant.tenantId, newTicket.id, 'medium', new Date());
  } catch (err) {
    logger.error(
      { err, tenantId: tenant.tenantId, ticketId: newTicket.id },
      'Failed to calculate SLA deadlines for email ticket',
    );
  }

  return {
    action: 'ticket_created',
    ticketId: newTicket.id,
    ticketNumber: newTicket.ticketNumber,
    tenantId: tenant.tenantId,
    clientId: client.id,
  };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Strip HTML tags from a string, leaving only the text content.
 * This is a simple implementation for extracting plain text from HTML email bodies.
 */
export function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
