import { eq, and, asc, count } from 'drizzle-orm';
import { getDb } from '../db/connection.js';
import {
  assignmentRules,
  agentGroups,
  agentGroupMemberships,
  users,
} from '../db/schema.js';
import { AppError, NotFoundError, ValidationError } from '../lib/errors.js';
import { getLogger } from '../lib/logger.js';
import type {
  AssignmentRule,
  RuleCondition,
  AgentGroupSummary,
  UserSummary,
  UserRole,
  CreateAssignmentRuleInput,
  UpdateAssignmentRuleInput,
  ReorderRulesInput,
} from '@busybirdies/shared';

/**
 * Convert a DB assignment rule row into the API response shape.
 */
async function buildRuleResponse(
  tenantId: string,
  row: {
    id: string;
    name: string;
    isActive: boolean;
    priorityOrder: number;
    conditions: unknown;
    actionType: string;
    targetAgentId: string | null;
    targetGroupId: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
): Promise<AssignmentRule> {
  let targetAgent: UserSummary | null = null;
  let targetGroup: AgentGroupSummary | null = null;

  const db = getDb();

  if (row.targetAgentId) {
    const [agent] = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(and(eq(users.id, row.targetAgentId), eq(users.tenantId, tenantId)))
      .limit(1);

    if (agent) {
      targetAgent = {
        id: agent.id,
        full_name: agent.fullName,
        email: agent.email,
        role: agent.role as UserRole,
      };
    }
  }

  if (row.targetGroupId) {
    const [group] = await db
      .select({
        id: agentGroups.id,
        name: agentGroups.name,
      })
      .from(agentGroups)
      .where(and(eq(agentGroups.id, row.targetGroupId), eq(agentGroups.tenantId, tenantId)))
      .limit(1);

    if (group) {
      const [memberCountRow] = await db
        .select({ count: count() })
        .from(agentGroupMemberships)
        .where(eq(agentGroupMemberships.agentGroupId, group.id));

      targetGroup = {
        id: group.id,
        name: group.name,
        member_count: memberCountRow?.count ?? 0,
      };
    }
  }

  return {
    id: row.id,
    name: row.name,
    is_active: row.isActive,
    priority_order: row.priorityOrder,
    conditions: row.conditions as RuleCondition[],
    action_type: row.actionType as AssignmentRule['action_type'],
    target_agent: targetAgent,
    target_group: targetGroup,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

/**
 * List all assignment rules for a tenant, ordered by priority_order ascending.
 */
export async function listRules(tenantId: string): Promise<AssignmentRule[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(assignmentRules)
    .where(eq(assignmentRules.tenantId, tenantId))
    .orderBy(asc(assignmentRules.priorityOrder));

  return Promise.all(rows.map((row) => buildRuleResponse(tenantId, row)));
}

/**
 * Create a new assignment rule for a tenant.
 * The rule is automatically assigned to the end of the priority order.
 *
 * Validates that target_agent_id or target_group_id is provided based on action_type.
 */
export async function createRule(
  tenantId: string,
  input: CreateAssignmentRuleInput,
): Promise<AssignmentRule> {
  const db = getDb();
  const logger = getLogger();

  // Validate action target
  if (input.action_type === 'assign_agent') {
    if (!input.target_agent_id) {
      throw new ValidationError('target_agent_id is required for assign_agent action', [
        { field: 'target_agent_id', message: 'Required for assign_agent action', code: 'required' },
      ]);
    }
    // Verify the agent exists
    const [agent] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(and(eq(users.id, input.target_agent_id), eq(users.tenantId, tenantId)))
      .limit(1);
    if (!agent) {
      throw new NotFoundError('Target agent');
    }
    if (agent.role === 'client') {
      throw new ValidationError('Cannot assign to a client user');
    }
  }

  if (input.action_type === 'assign_group') {
    if (!input.target_group_id) {
      throw new ValidationError('target_group_id is required for assign_group action', [
        { field: 'target_group_id', message: 'Required for assign_group action', code: 'required' },
      ]);
    }
    // Verify the group exists
    const [group] = await db
      .select({ id: agentGroups.id })
      .from(agentGroups)
      .where(and(eq(agentGroups.id, input.target_group_id), eq(agentGroups.tenantId, tenantId)))
      .limit(1);
    if (!group) {
      throw new NotFoundError('Target group');
    }
  }

  // Count existing rules to determine next priority order
  const [countRow] = await db
    .select({ total: count() })
    .from(assignmentRules)
    .where(eq(assignmentRules.tenantId, tenantId));

  const nextOrder = countRow?.total ?? 0;

  const [rule] = await db
    .insert(assignmentRules)
    .values({
      tenantId,
      name: input.name,
      isActive: input.is_active ?? true,
      priorityOrder: nextOrder,
      conditions: input.conditions,
      actionType: input.action_type,
      targetAgentId: input.action_type === 'assign_agent' ? input.target_agent_id ?? null : null,
      targetGroupId: input.action_type === 'assign_group' ? input.target_group_id ?? null : null,
    })
    .returning();

  if (!rule) {
    logger.error({ tenantId }, 'Failed to create assignment rule');
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create assignment rule');
  }

  logger.info({ tenantId, ruleId: rule.id, ruleName: input.name }, 'Assignment rule created');

  return buildRuleResponse(tenantId, rule);
}

/**
 * Update an existing assignment rule.
 */
export async function updateRule(
  tenantId: string,
  ruleId: string,
  input: UpdateAssignmentRuleInput,
): Promise<AssignmentRule> {
  const db = getDb();
  const logger = getLogger();

  // Find existing rule
  const [existing] = await db
    .select()
    .from(assignmentRules)
    .where(and(eq(assignmentRules.id, ruleId), eq(assignmentRules.tenantId, tenantId)))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Assignment rule');
  }

  const updateValues: Record<string, unknown> = { updatedAt: new Date() };

  if (input.name !== undefined) {
    updateValues.name = input.name;
  }
  if (input.is_active !== undefined) {
    updateValues.isActive = input.is_active;
  }
  if (input.priority_order !== undefined) {
    updateValues.priorityOrder = input.priority_order;
  }
  if (input.conditions !== undefined) {
    updateValues.conditions = input.conditions;
  }

  // Handle action_type and target updates
  const newActionType = input.action_type ?? existing.actionType;

  if (input.action_type !== undefined) {
    updateValues.actionType = input.action_type;
  }

  if (input.target_agent_id !== undefined || input.action_type !== undefined) {
    if (newActionType === 'assign_agent') {
      const agentId = input.target_agent_id ?? existing.targetAgentId;
      if (!agentId) {
        throw new ValidationError('target_agent_id is required for assign_agent action');
      }
      // Verify agent
      const [agent] = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(and(eq(users.id, agentId), eq(users.tenantId, tenantId)))
        .limit(1);
      if (!agent) {
        throw new NotFoundError('Target agent');
      }
      if (agent.role === 'client') {
        throw new ValidationError('Cannot assign to a client user');
      }
      updateValues.targetAgentId = agentId;
      updateValues.targetGroupId = null;
    }
  }

  if (input.target_group_id !== undefined || input.action_type !== undefined) {
    if (newActionType === 'assign_group') {
      const groupId = input.target_group_id ?? existing.targetGroupId;
      if (!groupId) {
        throw new ValidationError('target_group_id is required for assign_group action');
      }
      // Verify group
      const [group] = await db
        .select({ id: agentGroups.id })
        .from(agentGroups)
        .where(and(eq(agentGroups.id, groupId), eq(agentGroups.tenantId, tenantId)))
        .limit(1);
      if (!group) {
        throw new NotFoundError('Target group');
      }
      updateValues.targetGroupId = groupId;
      updateValues.targetAgentId = null;
    }
  }

  await db
    .update(assignmentRules)
    .set(updateValues)
    .where(eq(assignmentRules.id, ruleId));

  // Fetch updated rule
  const [updated] = await db
    .select()
    .from(assignmentRules)
    .where(eq(assignmentRules.id, ruleId))
    .limit(1);

  if (!updated) {
    logger.error({ tenantId, ruleId }, 'Failed to retrieve updated assignment rule');
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to retrieve updated assignment rule');
  }

  logger.info({ tenantId, ruleId }, 'Assignment rule updated');

  return buildRuleResponse(tenantId, updated);
}

/**
 * Delete an assignment rule.
 */
export async function deleteRule(tenantId: string, ruleId: string): Promise<void> {
  const db = getDb();
  const logger = getLogger();

  // Verify rule exists in tenant
  const [existing] = await db
    .select({ id: assignmentRules.id })
    .from(assignmentRules)
    .where(and(eq(assignmentRules.id, ruleId), eq(assignmentRules.tenantId, tenantId)))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Assignment rule');
  }

  await db.delete(assignmentRules).where(eq(assignmentRules.id, ruleId));

  logger.info({ tenantId, ruleId }, 'Assignment rule deleted');
}

/**
 * Reorder all assignment rules for a tenant.
 * The rule_ids array defines the new order (index = new priority_order).
 */
export async function reorderRules(
  tenantId: string,
  input: ReorderRulesInput,
): Promise<AssignmentRule[]> {
  const db = getDb();
  const logger = getLogger();

  // Verify all provided rule IDs belong to this tenant
  const existingRules = await db
    .select({ id: assignmentRules.id })
    .from(assignmentRules)
    .where(eq(assignmentRules.tenantId, tenantId));

  const existingIds = new Set(existingRules.map((r) => r.id));

  for (const ruleId of input.rule_ids) {
    if (!existingIds.has(ruleId)) {
      throw new NotFoundError(`Assignment rule ${ruleId}`);
    }
  }

  // Update priority_order for each rule in the new order
  for (let i = 0; i < input.rule_ids.length; i++) {
    const ruleId = input.rule_ids[i]!;
    await db
      .update(assignmentRules)
      .set({ priorityOrder: i, updatedAt: new Date() })
      .where(eq(assignmentRules.id, ruleId));
  }

  logger.info({ tenantId, ruleCount: input.rule_ids.length }, 'Assignment rules reordered');

  return listRules(tenantId);
}

/**
 * Get the list of active assignment rules for a tenant, ordered by priority.
 * Used internally by the auto-assign engine.
 */
export async function getActiveRules(tenantId: string): Promise<Array<{
  id: string;
  conditions: RuleCondition[];
  actionType: string;
  targetAgentId: string | null;
  targetGroupId: string | null;
}>> {
  const db = getDb();

  const rows = await db
    .select({
      id: assignmentRules.id,
      conditions: assignmentRules.conditions,
      actionType: assignmentRules.actionType,
      targetAgentId: assignmentRules.targetAgentId,
      targetGroupId: assignmentRules.targetGroupId,
    })
    .from(assignmentRules)
    .where(
      and(
        eq(assignmentRules.tenantId, tenantId),
        eq(assignmentRules.isActive, true),
      ),
    )
    .orderBy(asc(assignmentRules.priorityOrder));

  return rows.map((row) => ({
    id: row.id,
    conditions: row.conditions as RuleCondition[],
    actionType: row.actionType,
    targetAgentId: row.targetAgentId,
    targetGroupId: row.targetGroupId,
  }));
}
