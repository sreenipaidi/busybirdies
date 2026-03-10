import { eq, and, asc, count } from 'drizzle-orm';
import { getDb } from '../db/connection.js';
import {
  tickets,
  ticketTags,
  ticketAuditEntries,
  users,
  agentGroupMemberships,
} from '../db/schema.js';
import { getActiveRules } from './assignment.service.js';
import { evaluateRules } from '../lib/rule-evaluator.js';
import type { TicketContext } from '../lib/rule-evaluator.js';
import type { RuleCondition } from '@busybirdies/shared';
import { getLogger } from '../lib/logger.js';

/**
 * Result of the auto-assignment evaluation.
 */
export interface AutoAssignResult {
  /** Whether a matching rule was found and assignment was made */
  assigned: boolean;
  /** The ID of the rule that matched, if any */
  ruleId: string | null;
  /** The ID of the agent assigned, if any */
  agentId: string | null;
}

/**
 * Evaluate auto-assignment rules for a newly created ticket and assign it if a rule matches.
 *
 * This function:
 * 1. Loads all active rules for the tenant in priority order
 * 2. Builds a ticket context from the ticket's data
 * 3. Evaluates rules in order (first match wins)
 * 4. If a rule matches:
 *    - For assign_agent: assigns the ticket to the specified agent
 *    - For assign_group: picks an agent from the group via round-robin
 * 5. Creates an audit trail entry for the auto-assignment
 *
 * @param tenantId - The tenant ID
 * @param ticketId - The ticket to evaluate
 * @returns The result of the auto-assignment attempt
 */
export async function evaluateAndAssign(
  tenantId: string,
  ticketId: string,
): Promise<AutoAssignResult> {
  const db = getDb();
  const logger = getLogger();

  // Fetch ticket details
  const [ticket] = await db
    .select({
      id: tickets.id,
      priority: tickets.priority,
      subject: tickets.subject,
      clientId: tickets.clientId,
      assignedAgentId: tickets.assignedAgentId,
    })
    .from(tickets)
    .where(and(eq(tickets.id, ticketId), eq(tickets.tenantId, tenantId)))
    .limit(1);

  if (!ticket) {
    logger.warn({ tenantId, ticketId }, 'Auto-assign: ticket not found');
    return { assigned: false, ruleId: null, agentId: null };
  }

  // If ticket is already assigned, skip
  if (ticket.assignedAgentId) {
    logger.info({ tenantId, ticketId }, 'Auto-assign: ticket already assigned, skipping');
    return { assigned: false, ruleId: null, agentId: null };
  }

  // Get client email
  const [client] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, ticket.clientId))
    .limit(1);

  const clientEmail = client?.email ?? '';

  // Get ticket tags
  const tagRows = await db
    .select({ tag: ticketTags.tag })
    .from(ticketTags)
    .where(eq(ticketTags.ticketId, ticketId));

  const tags = tagRows.map((r) => r.tag);

  // Build ticket context
  const ticketContext: TicketContext = {
    priority: ticket.priority,
    subject: ticket.subject,
    client_email: clientEmail,
    tags,
  };

  // Get active rules
  const activeRules = await getActiveRules(tenantId);

  if (activeRules.length === 0) {
    logger.info({ tenantId, ticketId }, 'Auto-assign: no active rules found');
    return { assigned: false, ruleId: null, agentId: null };
  }

  // Evaluate rules using the rule evaluator
  const evalRules = activeRules.map((r) => ({
    id: r.id,
    condition_logic: r.conditionLogic as 'all' | 'any' | undefined,
    conditions: r.conditions as Array<{ field: RuleCondition['field']; operator: RuleCondition['operator']; value: string }>,
  }));

  const matchedEvalRule = evaluateRules(evalRules, ticketContext);

  if (!matchedEvalRule) {
    logger.info({ tenantId, ticketId }, 'Auto-assign: no rule matched');
    return { assigned: false, ruleId: null, agentId: null };
  }

  // Find the full rule details
  const matchedRule = activeRules.find((r) => r.id === matchedEvalRule.id);
  if (!matchedRule) {
    logger.error({ tenantId, ticketId, ruleId: matchedEvalRule.id }, 'Auto-assign: matched rule not found in active rules');
    return { assigned: false, ruleId: null, agentId: null };
  }

  let assignedAgentId: string | null = null;

  if (matchedRule.actionType === 'assign_agent' && matchedRule.targetAgentId) {
    // Verify agent is active
    const [agent] = await db
      .select({ id: users.id, isActive: users.isActive, fullName: users.fullName })
      .from(users)
      .where(and(eq(users.id, matchedRule.targetAgentId), eq(users.tenantId, tenantId)))
      .limit(1);

    if (agent && agent.isActive) {
      assignedAgentId = agent.id;
    } else {
      logger.warn(
        { tenantId, ticketId, ruleId: matchedRule.id, agentId: matchedRule.targetAgentId },
        'Auto-assign: target agent not active or not found',
      );
    }
  } else if (matchedRule.actionType === 'assign_group' && matchedRule.targetGroupId) {
    // Round-robin: pick the group member with fewest assigned open tickets
    assignedAgentId = await pickGroupAgent(tenantId, matchedRule.targetGroupId);

    if (!assignedAgentId) {
      logger.warn(
        { tenantId, ticketId, ruleId: matchedRule.id, groupId: matchedRule.targetGroupId },
        'Auto-assign: no available agents in target group',
      );
    }
  }

  if (!assignedAgentId) {
    return { assigned: false, ruleId: matchedRule.id, agentId: null };
  }

  // Assign the ticket
  await db
    .update(tickets)
    .set({
      assignedAgentId,
      assignedByRuleId: matchedRule.id,
      updatedAt: new Date(),
    })
    .where(eq(tickets.id, ticketId));

  // Get agent name for audit
  const [assignedAgent] = await db
    .select({ fullName: users.fullName })
    .from(users)
    .where(eq(users.id, assignedAgentId))
    .limit(1);

  // Create audit entry
  await db.insert(ticketAuditEntries).values({
    ticketId,
    userId: null,
    action: 'auto_assigned',
    fieldName: 'assigned_agent_id',
    oldValue: null,
    newValue: assignedAgent?.fullName ?? assignedAgentId,
    metadata: { rule_id: matchedRule.id, rule_action: matchedRule.actionType },
  });

  logger.info(
    { tenantId, ticketId, ruleId: matchedRule.id, agentId: assignedAgentId },
    'Auto-assign: ticket assigned successfully',
  );

  return { assigned: true, ruleId: matchedRule.id, agentId: assignedAgentId };
}

/**
 * Pick an agent from a group using a simple round-robin strategy.
 * Selects the group member with the fewest assigned open/pending tickets.
 *
 * @returns The selected agent's user ID, or null if no agents are available.
 */
async function pickGroupAgent(
  tenantId: string,
  groupId: string,
): Promise<string | null> {
  const db = getDb();

  // Get all active agents in the group
  const members = await db
    .select({
      userId: agentGroupMemberships.userId,
    })
    .from(agentGroupMemberships)
    .innerJoin(users, eq(agentGroupMemberships.userId, users.id))
    .where(
      and(
        eq(agentGroupMemberships.agentGroupId, groupId),
        eq(users.isActive, true),
        eq(users.tenantId, tenantId),
      ),
    )
    .orderBy(asc(agentGroupMemberships.createdAt));

  if (members.length === 0) {
    return null;
  }

  // For each member, count their open/pending tickets
  let leastLoaded: { userId: string; ticketCount: number } | null = null;

  for (const member of members) {
    const [result] = await db
      .select({ ticketCount: count() })
      .from(tickets)
      .where(
        and(
          eq(tickets.assignedAgentId, member.userId),
          eq(tickets.tenantId, tenantId),
        ),
      );

    const ticketCount = result?.ticketCount ?? 0;

    if (!leastLoaded || ticketCount < leastLoaded.ticketCount) {
      leastLoaded = { userId: member.userId, ticketCount };
    }
  }

  return leastLoaded?.userId ?? null;
}
