import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/connection.js';
import { tenantIntegrations } from '../db/schema.js';
import { getLogger } from '../lib/logger.js';

interface SlackConfig {
  webhookUrl: string;
  channel?: string;
  notifyOnPriorities: string[];
}

interface TicketNotificationPayload {
  ticketNumber: string;
  subject: string;
  priority: string;
  status: string;
  createdBy: string;
  ticketUrl: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#E53E3E',
  high: '#DD6B20',
  medium: '#D69E2E',
  low: '#38A169',
};

const PRIORITY_EMOJI: Record<string, string> = {
  urgent: '🚨',
  high: '🔴',
  medium: '🟡',
  low: '🟢',
};

/**
 * Send a Slack notification for a new ticket.
 * Checks tenant integration config and only sends if priority matches.
 */
export async function notifySlackNewTicket(
  tenantId: string,
  payload: TicketNotificationPayload,
): Promise<void> {
  const logger = getLogger();
  const db = getDb();

  const [integration] = await db
    .select()
    .from(tenantIntegrations)
    .where(
      and(
        eq(tenantIntegrations.tenantId, tenantId),
        eq(tenantIntegrations.type, 'slack'),
        eq(tenantIntegrations.enabled, true),
      ),
    )
    .limit(1);

  if (!integration) return;

  const config = integration.config as SlackConfig;
  if (!config.webhookUrl) return;

  const notifyOn = config.notifyOnPriorities ?? ['urgent', 'high'];
  if (!notifyOn.includes(payload.priority)) return;

  const color = PRIORITY_COLORS[payload.priority] ?? '#718096';
  const emoji = PRIORITY_EMOJI[payload.priority] ?? '🎫';

  const message = {
    text: `${emoji} New ${payload.priority} priority ticket: ${payload.subject}`,
    attachments: [
      {
        color,
        fields: [
          { title: 'Ticket', value: payload.ticketNumber, short: true },
          { title: 'Priority', value: payload.priority.charAt(0).toUpperCase() + payload.priority.slice(1), short: true },
          { title: 'Status', value: payload.status.charAt(0).toUpperCase() + payload.status.slice(1), short: true },
          { title: 'Created by', value: payload.createdBy, short: true },
        ],
        actions: [
          {
            type: 'button',
            text: 'View Ticket',
            url: payload.ticketUrl,
          },
        ],
        footer: 'BusyBirdies Helpdesk',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
    ...(config.channel ? { channel: config.channel } : {}),
  };

  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      logger.warn({ status: response.status, tenantId }, 'Slack notification failed');
    } else {
      logger.info({ ticketNumber: payload.ticketNumber, tenantId }, 'Slack notification sent');
    }
  } catch (err) {
    logger.error({ err, tenantId }, 'Slack notification error');
  }
}
