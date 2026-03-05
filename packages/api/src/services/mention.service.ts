import { eq, and, inArray } from 'drizzle-orm';
import { getDb } from '../db/connection.js';
import { users } from '../db/schema.js';
import { getLogger } from '../lib/logger.js';
import type { UserRole } from '@supportdesk/shared';

/** Regex pattern to match @[agent_name] mentions in text. */
const MENTION_PATTERN = /@\[([^\]]+)\]/g;

/** Represents a parsed mention with the matched name. */
export interface ParsedMention {
  fullName: string;
}

/** Represents a resolved mention with user details. */
export interface ResolvedMention {
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
}

/**
 * Parse @[agent_name] mentions from a text body.
 * Returns an array of unique mentioned names.
 *
 * @param body - The text to parse for mentions
 * @returns Array of parsed mentions with full names
 */
export function parseMentions(body: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  // Reset lastIndex to ensure we start from the beginning
  MENTION_PATTERN.lastIndex = 0;
  while ((match = MENTION_PATTERN.exec(body)) !== null) {
    const fullName = match[1];
    if (fullName && !seen.has(fullName)) {
      seen.add(fullName);
      mentions.push({ fullName });
    }
  }

  return mentions;
}

/**
 * Resolve parsed mentions to actual user records within a tenant.
 * Only matches agents and admins (not clients).
 *
 * @param tenantId - The tenant to search within
 * @param mentions - Array of parsed mentions to resolve
 * @returns Array of resolved mentions with user details
 */
export async function resolveMentions(
  tenantId: string,
  mentions: ParsedMention[],
): Promise<ResolvedMention[]> {
  if (mentions.length === 0) {
    return [];
  }

  const db = getDb();
  const logger = getLogger();
  const names = mentions.map((m) => m.fullName);

  try {
    const matchedUsers = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          inArray(users.fullName, names),
          eq(users.isActive, true),
        ),
      );

    // Filter to only agents and admins
    return matchedUsers
      .filter((u) => u.role === 'agent' || u.role === 'admin')
      .map((u) => ({
        userId: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role as UserRole,
      }));
  } catch (err) {
    logger.error({ err, tenantId, names }, 'Failed to resolve mentions');
    return [];
  }
}

/**
 * Process mentions in an internal note body.
 * Parses mentions, resolves them to user records, and logs notifications.
 * In the future, this will send email notifications to mentioned agents.
 *
 * @param tenantId - The tenant context
 * @param ticketId - The ticket the note belongs to
 * @param body - The internal note body text
 * @param authorId - The user who wrote the note
 * @returns Array of resolved mentions that were notified
 */
export async function processMentions(
  tenantId: string,
  ticketId: string,
  body: string,
  authorId: string,
): Promise<ResolvedMention[]> {
  const logger = getLogger();

  const parsed = parseMentions(body);
  if (parsed.length === 0) {
    return [];
  }

  logger.info(
    { ticketId, authorId, mentionCount: parsed.length },
    'Processing mentions in internal note',
  );

  const resolved = await resolveMentions(tenantId, parsed);

  // Filter out self-mentions (author mentioning themselves)
  const toNotify = resolved.filter((m) => m.userId !== authorId);

  // Stub: log notification for each mentioned user
  // Future: send email notification to each mentioned agent
  for (const mention of toNotify) {
    logger.info(
      {
        ticketId,
        mentionedUserId: mention.userId,
        mentionedUserName: mention.fullName,
        mentionedUserEmail: mention.email,
        authorId,
      },
      'Mention notification stub: would send email to mentioned agent',
    );
  }

  return toNotify;
}
