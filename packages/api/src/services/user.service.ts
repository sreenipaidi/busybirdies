import { eq, and, or, ilike, count } from 'drizzle-orm';
import { getDb } from '../db/connection.js';
import { users } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import {
  AppError,
  ConflictError,
  NotFoundError,
  AuthorizationError,
} from '../lib/errors.js';
import type { UserRole } from '@supportdesk/shared';
import type {
  InviteUserInput,
  ActivateUserInput,
  UpdateUserInput,
  UserListQuery,
} from '@supportdesk/shared';

/** User response shape without sensitive fields. */
export interface UserResponse {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
}

/**
 * List users within a tenant, supporting filtering by role, active status,
 * and search by name or email. Results are paginated.
 */
export async function listUsers(
  tenantId: string,
  query: UserListQuery,
): Promise<{
  data: UserResponse[];
  pagination: { total: number; page: number; per_page: number; total_pages: number };
}> {
  const db = getDb();
  const page = query.page ?? 1;
  const perPage = query.per_page ?? 25;
  const offset = (page - 1) * perPage;

  // Build filter conditions
  const conditions = [eq(users.tenantId, tenantId)];

  if (query.role) {
    conditions.push(eq(users.role, query.role));
  }

  if (query.is_active !== undefined) {
    conditions.push(eq(users.isActive, query.is_active));
  }

  if (query.search) {
    const searchPattern = `%${query.search}%`;
    conditions.push(
      or(
        ilike(users.fullName, searchPattern),
        ilike(users.email, searchPattern),
      )!,
    );
  }

  const whereClause = and(...conditions);

  // Get total count
  const [countResult] = await db
    .select({ total: count() })
    .from(users)
    .where(whereClause);

  const total = countResult?.total ?? 0;

  // Get paginated results -- exclude sensitive columns
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      isActive: users.isActive,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(whereClause)
    .orderBy(users.createdAt)
    .limit(perPage)
    .offset(offset);

  const data: UserResponse[] = rows.map((row) => ({
    id: row.id,
    email: row.email,
    full_name: row.fullName,
    role: row.role as UserRole,
    is_active: row.isActive,
    email_verified: row.emailVerified,
    created_at: row.createdAt.toISOString(),
  }));

  return {
    data,
    pagination: {
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
    },
  };
}

/**
 * Invite a new employee (agent or admin) to a tenant.
 * Creates an inactive user with an activation token. The employee sets
 * their password through the activation link.
 */
export async function inviteUser(
  tenantId: string,
  input: InviteUserInput,
): Promise<UserResponse> {
  const db = getDb();

  // Check for existing user in this tenant
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.email, input.email)))
    .limit(1);

  if (existing) {
    throw new ConflictError('An account with this email already exists.');
  }

  const activationToken = crypto.randomUUID();
  const activationTokenExpires = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

  const [newUser] = await db
    .insert(users)
    .values({
      tenantId,
      email: input.email,
      fullName: input.full_name,
      role: input.role,
      isActive: false,
      emailVerified: false,
      activationToken,
      activationTokenExpires,
    })
    .returning();

  if (!newUser) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create user');
  }

  // TODO: Dispatch invitation email via email service / job queue

  return {
    id: newUser.id,
    email: newUser.email,
    full_name: newUser.fullName,
    role: newUser.role as UserRole,
    is_active: newUser.isActive,
    email_verified: newUser.emailVerified,
    created_at: newUser.createdAt.toISOString(),
  };
}

/**
 * Activate an employee account using the activation token.
 * Sets the user's password, marks them as active and email-verified.
 */
export async function activateUser(
  input: ActivateUserInput,
): Promise<{ message: string }> {
  const db = getDb();

  // Only select columns needed for activation -- exclude passwordHash and other sensitive fields
  const [user] = await db
    .select({
      id: users.id,
      activationTokenExpires: users.activationTokenExpires,
    })
    .from(users)
    .where(eq(users.activationToken, input.token))
    .limit(1);

  if (!user) {
    throw new AppError(
      400,
      'INVALID_TOKEN',
      'This activation link is invalid or has expired.',
    );
  }

  if (
    !user.activationTokenExpires ||
    user.activationTokenExpires < new Date()
  ) {
    throw new AppError(
      400,
      'INVALID_TOKEN',
      'This activation link is invalid or has expired.',
    );
  }

  const passwordHash = await hashPassword(input.password);

  await db
    .update(users)
    .set({
      passwordHash,
      isActive: true,
      emailVerified: true,
      activationToken: null,
      activationTokenExpires: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return { message: 'Account activated successfully.' };
}

/**
 * Get a single user by ID within a tenant.
 */
export async function getUser(
  tenantId: string,
  userId: string,
): Promise<UserResponse> {
  const db = getDb();

  // Select only non-sensitive columns
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      isActive: users.isActive,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .limit(1);

  if (!user) {
    throw new NotFoundError('User');
  }

  return {
    id: user.id,
    email: user.email,
    full_name: user.fullName,
    role: user.role as UserRole,
    is_active: user.isActive,
    email_verified: user.emailVerified,
    created_at: user.createdAt.toISOString(),
  };
}

/**
 * Update a user within a tenant. Admins can update any field;
 * non-admins can only update their own full_name and password.
 * Users cannot change their own role or deactivate themselves.
 */
export async function updateUser(
  tenantId: string,
  userId: string,
  input: UpdateUserInput,
  requestingUserId: string,
  requestingUserRole: UserRole,
): Promise<UserResponse> {
  const db = getDb();

  // Select only non-sensitive columns for authorization checks
  const [user] = await db
    .select({
      id: users.id,
      role: users.role,
    })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .limit(1);

  if (!user) {
    throw new NotFoundError('User');
  }

  const isSelf = requestingUserId === userId;
  const isAdmin = requestingUserRole === 'admin';

  // Non-admins can only edit themselves
  if (!isAdmin && !isSelf) {
    throw new AuthorizationError('Insufficient permissions');
  }

  // Self-service restrictions
  if (isSelf) {
    if (input.role !== undefined) {
      throw new AppError(403, 'FORBIDDEN', 'Cannot change own role');
    }
    if (input.is_active === false) {
      throw new AppError(403, 'FORBIDDEN', 'Cannot deactivate own account');
    }
  }

  // Non-admins can only change name and password
  if (!isAdmin) {
    if (input.role !== undefined || input.is_active !== undefined) {
      throw new AuthorizationError('Insufficient permissions');
    }
  }

  // Build update values
  const updateValues: Record<string, unknown> = { updatedAt: new Date() };

  if (input.full_name !== undefined) {
    updateValues.fullName = input.full_name;
  }

  if (input.role !== undefined) {
    updateValues.role = input.role;
  }

  if (input.is_active !== undefined) {
    updateValues.isActive = input.is_active;
  }

  if (input.password !== undefined) {
    updateValues.passwordHash = await hashPassword(input.password);
  }

  await db
    .update(users)
    .set(updateValues)
    .where(eq(users.id, userId));

  // Fetch updated user
  return getUser(tenantId, userId);
}
