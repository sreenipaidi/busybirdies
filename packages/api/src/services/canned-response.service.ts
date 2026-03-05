import { eq, and, ilike, count } from 'drizzle-orm';
import { getDb } from '../db/connection.js';
import { cannedResponses, users } from '../db/schema.js';
import { AppError, NotFoundError, AuthorizationError } from '../lib/errors.js';
import { getLogger } from '../lib/logger.js';
import type {
  CannedResponse,
  UserSummary,
  UserRole,
  PaginatedResponse,
  CreateCannedResponseInput,
  UpdateCannedResponseInput,
} from '@supportdesk/shared';

/**
 * Convert a DB canned response row to the API response shape.
 */
async function buildResponse(
  tenantId: string,
  row: {
    id: string;
    title: string;
    body: string;
    category: string | null;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
  },
): Promise<CannedResponse> {
  const db = getDb();

  const [creator] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(and(eq(users.id, row.createdById), eq(users.tenantId, tenantId)))
    .limit(1);

  const createdBy: UserSummary = creator
    ? {
        id: creator.id,
        full_name: creator.fullName,
        email: creator.email,
        role: creator.role as UserRole,
      }
    : {
        id: row.createdById,
        full_name: 'Unknown',
        email: '',
        role: 'agent' as UserRole,
      };

  return {
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category,
    created_by: createdBy,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

/**
 * List canned responses for a tenant with optional filtering and pagination.
 *
 * @param tenantId - The tenant ID
 * @param options - Filter and pagination options
 * @returns Paginated list of canned responses
 */
export async function listCannedResponses(
  tenantId: string,
  options: {
    category?: string;
    search?: string;
    page?: number;
    per_page?: number;
  } = {},
): Promise<PaginatedResponse<CannedResponse>> {
  const db = getDb();
  const page = options.page ?? 1;
  const perPage = options.per_page ?? 25;
  const offset = (page - 1) * perPage;

  // Build conditions
  const conditions = [eq(cannedResponses.tenantId, tenantId)];

  if (options.category) {
    conditions.push(eq(cannedResponses.category, options.category));
  }

  if (options.search) {
    conditions.push(
      ilike(cannedResponses.title, `%${options.search}%`),
    );
  }

  const whereClause = and(...conditions);

  // Get total count
  const [countResult] = await db
    .select({ total: count() })
    .from(cannedResponses)
    .where(whereClause);

  const total = countResult?.total ?? 0;

  // Get paginated results
  const rows = await db
    .select()
    .from(cannedResponses)
    .where(whereClause)
    .limit(perPage)
    .offset(offset);

  const data = await Promise.all(
    rows.map((row) => buildResponse(tenantId, row)),
  );

  return {
    data,
    pagination: {
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage) || 1,
    },
  };
}

/**
 * Create a new canned response.
 *
 * @param tenantId - The tenant ID
 * @param input - The canned response data
 * @param createdById - The ID of the user creating the response
 * @returns The created canned response
 */
export async function createCannedResponse(
  tenantId: string,
  input: CreateCannedResponseInput,
  createdById: string,
): Promise<CannedResponse> {
  const db = getDb();
  const logger = getLogger();

  const [row] = await db
    .insert(cannedResponses)
    .values({
      tenantId,
      title: input.title,
      body: input.body,
      category: input.category ?? null,
      createdById,
    })
    .returning();

  if (!row) {
    logger.error({ tenantId }, 'Failed to create canned response');
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create canned response');
  }

  logger.info({ tenantId, responseId: row.id }, 'Canned response created');

  return buildResponse(tenantId, row);
}

/**
 * Update an existing canned response.
 * Admins can update any response. Agents can only update their own.
 *
 * @param tenantId - The tenant ID
 * @param responseId - The ID of the canned response to update
 * @param input - The fields to update
 * @param requestUser - The user making the request
 * @returns The updated canned response
 */
export async function updateCannedResponse(
  tenantId: string,
  responseId: string,
  input: UpdateCannedResponseInput,
  requestUser: { id: string; role: UserRole },
): Promise<CannedResponse> {
  const db = getDb();
  const logger = getLogger();

  // Find existing response
  const [existing] = await db
    .select()
    .from(cannedResponses)
    .where(and(eq(cannedResponses.id, responseId), eq(cannedResponses.tenantId, tenantId)))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Canned response');
  }

  // Authorization: agents can only update their own
  if (requestUser.role === 'agent' && existing.createdById !== requestUser.id) {
    throw new AuthorizationError('Agents can only edit their own canned responses');
  }

  const updateValues: Record<string, unknown> = { updatedAt: new Date() };

  if (input.title !== undefined) {
    updateValues.title = input.title;
  }
  if (input.body !== undefined) {
    updateValues.body = input.body;
  }
  if (input.category !== undefined) {
    updateValues.category = input.category ?? null;
  }

  await db
    .update(cannedResponses)
    .set(updateValues)
    .where(eq(cannedResponses.id, responseId));

  const [updated] = await db
    .select()
    .from(cannedResponses)
    .where(eq(cannedResponses.id, responseId))
    .limit(1);

  if (!updated) {
    logger.error({ tenantId, responseId }, 'Failed to retrieve updated canned response');
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to retrieve updated canned response');
  }

  logger.info({ tenantId, responseId }, 'Canned response updated');

  return buildResponse(tenantId, updated);
}

/**
 * Delete a canned response.
 * Admins can delete any response. Agents can only delete their own.
 *
 * @param tenantId - The tenant ID
 * @param responseId - The ID of the canned response to delete
 * @param requestUser - The user making the request
 */
export async function deleteCannedResponse(
  tenantId: string,
  responseId: string,
  requestUser: { id: string; role: UserRole },
): Promise<void> {
  const db = getDb();
  const logger = getLogger();

  // Find existing response
  const [existing] = await db
    .select()
    .from(cannedResponses)
    .where(and(eq(cannedResponses.id, responseId), eq(cannedResponses.tenantId, tenantId)))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Canned response');
  }

  // Authorization: agents can only delete their own
  if (requestUser.role === 'agent' && existing.createdById !== requestUser.id) {
    throw new AuthorizationError('Agents can only delete their own canned responses');
  }

  await db.delete(cannedResponses).where(eq(cannedResponses.id, responseId));

  logger.info({ tenantId, responseId }, 'Canned response deleted');
}
