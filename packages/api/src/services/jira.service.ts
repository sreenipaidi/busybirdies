import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/connection.js';
import { tenantIntegrations, tickets } from '../db/schema.js';
import { getLogger } from '../lib/logger.js';

export interface JiraConfig {
  baseUrl: string;       // e.g. https://yourcompany.atlassian.net
  email: string;         // Atlassian account email
  apiToken: string;      // Atlassian API token
  projectKey: string;    // e.g. SUP
  issueType: string;     // e.g. Task, Bug, Story
  enabled: boolean;
}

interface CreatedJiraIssue {
  key: string;           // e.g. SUP-42
  url: string;           // e.g. https://yourcompany.atlassian.net/browse/SUP-42
}

/**
 * Get Jira config for a tenant. Returns null if not configured.
 */
export async function getJiraConfig(tenantId: string): Promise<JiraConfig | null> {
  const db = getDb();
  const [integration] = await db
    .select()
    .from(tenantIntegrations)
    .where(and(
      eq(tenantIntegrations.tenantId, tenantId),
      eq(tenantIntegrations.type, 'jira'),
      eq(tenantIntegrations.enabled, true),
    ))
    .limit(1);

  if (!integration) return null;
  const config = integration.config as JiraConfig;
  if (!config.baseUrl || !config.email || !config.apiToken || !config.projectKey) return null;
  return { ...config, enabled: integration.enabled };
}

/**
 * Create a Jira issue and return the key + browse URL.
 */
export async function createJiraIssue(
  config: JiraConfig,
  payload: { summary: string; description: string; priority: string },
): Promise<CreatedJiraIssue> {
  const PRIORITY_MAP: Record<string, string> = {
    urgent: 'Highest',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };

  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
  const baseUrl = config.baseUrl.replace(/\/$/, '');

  const body = {
    fields: {
      project: { key: config.projectKey },
      summary: payload.summary,
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: payload.description || payload.summary }],
          },
        ],
      },
      issuetype: { name: config.issueType || 'Task' },
      priority: { name: PRIORITY_MAP[payload.priority] ?? 'Medium' },
    },
  };

  const response = await fetch(`${baseUrl}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Jira API error ${response.status}: ${error}`);
  }

  const data = await response.json() as { id: string; key: string; self: string };
  return {
    key: data.key,
    url: `${baseUrl}/browse/${data.key}`,
  };
}

/**
 * Create a Jira issue for a new ticket and update the ticket with the Jira link.
 * Fire-and-forget safe — errors are logged but do not block ticket creation.
 */
export async function syncTicketToJira(
  tenantId: string,
  ticketId: string,
  payload: { ticketNumber: string; subject: string; description: string; priority: string },
): Promise<void> {
  const logger = getLogger();
  const db = getDb();

  const config = await getJiraConfig(tenantId);
  if (!config) return;

  try {
    const issue = await createJiraIssue(config, {
      summary: `[${payload.ticketNumber}] ${payload.subject}`,
      description: payload.description,
      priority: payload.priority,
    });

    await db
      .update(tickets)
      .set({ jiraIssueKey: issue.key, jiraIssueUrl: issue.url })
      .where(eq(tickets.id, ticketId));

    logger.info({ ticketId, jiraKey: issue.key }, 'Jira issue created');
  } catch (err) {
    logger.error({ err, ticketId, tenantId }, 'Failed to create Jira issue');
  }
}
