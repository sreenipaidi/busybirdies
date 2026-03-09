import { eq, and, count } from 'drizzle-orm';
import { getDb } from '../db/connection.js';
import { agentGroups, agentGroupMemberships, users } from '../db/schema.js';
import {
  AppError,
  ConflictError,
  NotFoundError,
} from '../lib/errors.js';
import { getLogger } from '../lib/logger.js';
import type { UserRole } from '@busybirdies/shared';
import type { AgentGroup, AgentGroupSummary, UserSummary } from '@busybirdies/shared';

// ---------------------------------------------------------------------------
// Input Types
// ---------------------------------------------------------------------------

/** Input for creating an agent group. */
export interface CreateAgentGroupInput {
  name: string;
  description?: string | null;
}

/** Input for updating an agent group. */
export interface UpdateAgentGroupInput {
  name?: string;
  description?: string | null;
}

/** Input for adding a member to an agent group. */
export interface AddMemberInput {
  user_id: string;
}

// ---------------------------------------------------------------------------
// List Agent Groups
// ---------------------------------------------------------------------------

/**
 * List all agent groups for a tenant, including member count.
 */
export async function listAgentGroups(
  tenantId: string,
): Promise<{ data: AgentGroupSummary[] }> {
  const db = getDb();

  const rows = await db
    .select({
      id: agentGroups.id,
      name: agentGroups.name,
      createdAt: agentGroups.createdAt,
    })
    .from(agentGroups)
    .where(eq(agentGroups.tenantId, tenantId))
    .orderBy(agentGroups.name);

  const data: AgentGroupSummary[] = await Promise.all(
    rows.map(async (row) => {
      const [countResult] = await db
        .select({ total: count() })
        .from(agentGroupMemberships)
        .where(eq(agentGroupMemberships.agentGroupId, row.id));

      return {
        id: row.id,
        name: row.name,
        member_count: countResult?.total ?? 0,
      };
    }),
  );

  return { data };
}

// ---------------------------------------------------------------------------
// Get Agent Group
// ---------------------------------------------------------------------------

/**
 * Get a single agent group by ID, including full member list.
 * Throws NotFoundError if the group does not exist in the tenant.
 */
export async function getAgentGroup(
  tenantId: string,
  groupId: string,
): Promise<AgentGroup> {
  const db = getDb();

  const [group] = await db
    .select({
      id: agentGroups.id,
      name: agentGroups.name,
      description: agentGroups.description,
      createdAt: agentGroups.createdAt,
    })
    .from(agentGroups)
    .where(and(eq(agentGroups.id, groupId), eq(agentGroups.tenantId, tenantId)))
    .limit(1);

  if (!group) {
    throw new NotFoundError('Agent group');
  }

  const members = await getGroupMembers(groupId);

  return {
    id: group.id,
    name: group.name,
    description: group.description ?? null,
    member_count: members.length,
    members,
    created_at: group.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Create Agent Group
// ---------------------------------------------------------------------------

/**
 * Create a new agent group within a tenant.
 * Throws ConflictError if a group with the same name already exists.
 */
export async function createAgentGroup(
  tenantId: string,
  input: CreateAgentGroupInput,
): Promise<AgentGroup> {
  const db = getDb();

  // Check for duplicate name in this tenant
  const [existing] = await db
    .select({ id: agentGroups.id })
    .from(agentGroups)
    .where(and(eq(agentGroups.tenantId, tenantId), eq(agentGroups.name, input.name)))
    .limit(1);

  if (existing) {
    throw new ConflictError('An agent group with this name already exists');
  }

  const [row] = await db
    .insert(agentGroups)
    .values({
      tenantId,
      name: input.name,
      description: input.description ?? null,
    })
    .returning({
      id: agentGroups.id,
      name: agentGroups.name,
      description: agentGroups.description,
      createdAt: agentGroups.createdAt,
    });

  if (!row) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create agent group');
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    member_count: 0,
    members: [],
    created_at: row.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Update Agent Group
// ---------------------------------------------------------------------------

/**
 * Update an existing agent group.
 * Throws NotFoundError if the group does not exist.
 * Throws ConflictError if the new name conflicts with another group.
 */
export async function updateAgentGroup(
  tenantId: string,
  groupId: string,
  input: UpdateAgentGroupInput,
): Promise<AgentGroup> {
  const db = getDb();

  // Verify group exists
  const [existing] = await db
    .select({ id: agentGroups.id, name: agentGroups.name })
    .from(agentGroups)
    .where(and(eq(agentGroups.id, groupId), eq(agentGroups.tenantId, tenantId)))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Agent group');
  }

  // Check for name conflict if name is changing
  if (input.name && input.name !== existing.name) {
    const [duplicate] = await db
      .select({ id: agentGroups.id })
      .from(agentGroups)
      .where(
        and(
          eq(agentGroups.tenantId, tenantId),
          eq(agentGroups.name, input.name),
        ),
      )
      .limit(1);

    if (duplicate) {
      throw new ConflictError('An agent group with this name already exists');
    }
  }

  const updateValues: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updateValues.name = input.name;
  if (input.description !== undefined) updateValues.description = input.description;

  await db
    .update(agentGroups)
    .set(updateValues)
    .where(eq(agentGroups.id, groupId));

  return getAgentGroup(tenantId, groupId);
}

// ---------------------------------------------------------------------------
// Delete Agent Group
// ---------------------------------------------------------------------------

/**
 * Delete an agent group by ID.
 * Memberships are automatically deleted via ON DELETE CASCADE.
 * Throws NotFoundError if the group does not exist.
 */
export async function deleteAgentGroup(
  tenantId: string,
  groupId: string,
): Promise<void> {
  const db = getDb();

  const [existing] = await db
    .select({ id: agentGroups.id })
    .from(agentGroups)
    .where(and(eq(agentGroups.id, groupId), eq(agentGroups.tenantId, tenantId)))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Agent group');
  }

  await db
    .delete(agentGroups)
    .where(eq(agentGroups.id, groupId));
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

/**
 * Fetch all members of an agent group as UserSummary objects.
 */
async function getGroupMembers(groupId: string): Promise<UserSummary[]> {
  const db = getDb();

  const rows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
    })
    .from(agentGroupMemberships)
    .innerJoin(users, eq(agentGroupMemberships.userId, users.id))
    .where(eq(agentGroupMemberships.agentGroupId, groupId))
    .orderBy(users.fullName);

  return rows.map((row) => ({
    id: row.id,
    full_name: row.fullName,
    email: row.email,
    role: row.role as UserRole,
  }));
}

/**
 * Add a user as a member of an agent group.
 * The user must be an agent or admin within the same tenant.
 * Throws NotFoundError if the group or user does not exist.
 * Throws ConflictError if the user is already a member.
 */
export async function addMember(
  tenantId: string,
  groupId: string,
  input: AddMemberInput,
): Promise<AgentGroup> {
  const logger = getLogger();
  const db = getDb();

  // Verify group exists
  const [group] = await db
    .select({ id: agentGroups.id })
    .from(agentGroups)
    .where(and(eq(agentGroups.id, groupId), eq(agentGroups.tenantId, tenantId)))
    .limit(1);

  if (!group) {
    throw new NotFoundError('Agent group');
  }

  // Verify user exists and is an agent or admin in this tenant
  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(and(eq(users.id, input.user_id), eq(users.tenantId, tenantId)))
    .limit(1);

  if (!user) {
    throw new NotFoundError('User');
  }

  if (user.role !== 'agent' && user.role !== 'admin') {
    throw new AppError(422, 'VALIDATION_ERROR', 'Only agents and admins can be added to groups');
  }

  // Check if already a member
  const [existingMember] = await db
    .select({ id: agentGroupMemberships.id })
    .from(agentGroupMemberships)
    .where(
      and(
        eq(agentGroupMemberships.agentGroupId, groupId),
        eq(agentGroupMemberships.userId, input.user_id),
      ),
    )
    .limit(1);

  if (existingMember) {
    throw new ConflictError('User is already a member of this group');
  }

  await db
    .insert(agentGroupMemberships)
    .values({
      agentGroupId: groupId,
      userId: input.user_id,
    });

  logger.info(
    { tenantId, groupId, userId: input.user_id },
    'Added member to agent group',
  );

  return getAgentGroup(tenantId, groupId);
}

/**
 * Remove a user from an agent group.
 * Throws NotFoundError if the group does not exist or the user is not a member.
 */
export async function removeMember(
  tenantId: string,
  groupId: string,
  userId: string,
): Promise<AgentGroup> {
  const logger = getLogger();
  const db = getDb();

  // Verify group exists in this tenant
  const [group] = await db
    .select({ id: agentGroups.id })
    .from(agentGroups)
    .where(and(eq(agentGroups.id, groupId), eq(agentGroups.tenantId, tenantId)))
    .limit(1);

  if (!group) {
    throw new NotFoundError('Agent group');
  }

  // Verify membership exists
  const [membership] = await db
    .select({ id: agentGroupMemberships.id })
    .from(agentGroupMemberships)
    .where(
      and(
        eq(agentGroupMemberships.agentGroupId, groupId),
        eq(agentGroupMemberships.userId, userId),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new NotFoundError('Group membership');
  }

  await db
    .delete(agentGroupMemberships)
    .where(eq(agentGroupMemberships.id, membership.id));

  logger.info(
    { tenantId, groupId, userId },
    'Removed member from agent group',
  );

  return getAgentGroup(tenantId, groupId);
}
