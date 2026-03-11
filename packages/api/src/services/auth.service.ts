import crypto from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/connection.js';
import { users, tenants, slaPolicies } from '../db/schema.js';
import { hashPassword, comparePassword } from '../lib/password.js';
import { signToken } from '../lib/jwt.js';
import { getConfig } from '../config.js';
import {
  AppError,
  AuthenticationError,
  ConflictError,
  NotFoundError,
} from '../lib/errors.js';
import { SLA_DEFAULTS } from '@busybirdies/shared';
import { sendEmail, renderVerificationEmail, renderPasswordResetEmail } from './email.service.js';
import { getLogger } from '../lib/logger.js';
import type { UserRole } from '@busybirdies/shared';
import type { LoginInput, RegisterInput, ForgotPasswordInput, ResetPasswordInput } from '@busybirdies/shared';

const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/** The shape of data returned after a successful login or tenant signup. */
export interface AuthResult {
  user: {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
    is_active: boolean;
    email_verified: boolean;
    created_at: string;
  };
  tenant: {
    id: string;
    name: string;
    subdomain: string;
  };
  token: string;
  expiresAt: string;
}

/**
 * Look up a tenant by its subdomain.
 * Throws NotFoundError if the subdomain is unknown.
 */
async function getTenantBySubdomain(subdomain: string) {
  const db = getDb();
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.subdomain, subdomain))
    .limit(1);

  if (!tenant) {
    throw new NotFoundError('Tenant');
  }
  return tenant;
}

/**
 * Authenticate a user by email and password within a given portal (tenant subdomain).
 * Handles account lockout after 10 failed login attempts.
 */
export async function login(input: LoginInput): Promise<AuthResult> {
  const db = getDb();
  const config = getConfig();

  // Look up tenant
  const tenant = await getTenantBySubdomain(input.portal);

  // Look up user within tenant -- select only the columns needed for login verification
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      isActive: users.isActive,
      emailVerified: users.emailVerified,
      passwordHash: users.passwordHash,
      failedLoginAttempts: users.failedLoginAttempts,
      lockedUntil: users.lockedUntil,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.tenantId, tenant.id), eq(users.email, input.email)))
    .limit(1);

  if (!user) {
    throw new AuthenticationError('Invalid email or password.');
  }

  // Check account lockout
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(
      403,
      'ACCOUNT_LOCKED',
      'Account is temporarily locked due to too many failed login attempts. Please try again later.',
    );
  }

  // Check if account is active
  if (!user.isActive) {
    throw new AppError(
      403,
      'ACCOUNT_DEACTIVATED',
      'Your account has been deactivated. Contact your administrator.',
    );
  }

  // Check if email is verified (for clients)
  if (!user.emailVerified && user.role === 'client') {
    throw new AppError(
      403,
      'EMAIL_NOT_VERIFIED',
      'Please verify your email address before logging in.',
    );
  }

  // Verify password
  if (!user.passwordHash) {
    throw new AuthenticationError('Invalid email or password.');
  }

  const isValid = await comparePassword(input.password, user.passwordHash);

  if (!isValid) {
    // Increment failed attempts
    const newAttempts = user.failedLoginAttempts + 1;
    const updateData: Record<string, unknown> = {
      failedLoginAttempts: newAttempts,
      updatedAt: new Date(),
    };

    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    }

    await db.update(users).set(updateData).where(eq(users.id, user.id));

    throw new AuthenticationError('Invalid email or password.');
  }

  // Reset failed attempts on successful login
  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await db
      .update(users)
      .set({ failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  }

  // Determine token expiry based on role
  const expiresIn =
    user.role === 'client' ? config.JWT_CLIENT_EXPIRY : config.JWT_EMPLOYEE_EXPIRY;

  const token = signToken(
    { sub: user.id, tid: tenant.id, role: user.role as UserRole },
    expiresIn,
  );

  // Compute expiration date
  const expiresInMs = parseExpiryToMs(expiresIn);
  const expiresAt = new Date(Date.now() + expiresInMs).toISOString();

  return {
    user: {
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      role: user.role as UserRole,
      is_active: user.isActive,
      email_verified: user.emailVerified,
      created_at: user.createdAt.toISOString(),
    },
    tenant: {
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
    },
    token,
    expiresAt,
  };
}

/**
 * Register a new client on a given portal (tenant).
 * Creates a client user with email_verified=false.
 * Returns the new user's ID.
 */
export async function register(
  input: RegisterInput,
): Promise<{ userId: string; message: string }> {
  const db = getDb();

  // Look up tenant
  const tenant = await getTenantBySubdomain(input.portal);

  // Check for existing user
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.tenantId, tenant.id), eq(users.email, input.email)))
    .limit(1);

  if (existing) {
    throw new ConflictError('An account with this email already exists.');
  }

  const passwordHash = await hashPassword(input.password);

  const isDevMode = process.env.NODE_ENV !== 'production';
  const activationToken = isDevMode ? null : crypto.randomBytes(32).toString('hex');
  const activationTokenExpires = isDevMode ? null : new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [newUser] = await db
    .insert(users)
    .values({
      tenantId: tenant.id,
      email: input.email,
      fullName: input.full_name,
      passwordHash,
      role: 'client',
      isActive: true,
      emailVerified: isDevMode,
      activationToken,
      activationTokenExpires,
    })
    .returning({ id: users.id });

  if (!newUser) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create user');
  }

  // Send verification email in production
  if (!isDevMode && activationToken) {
    const config = getConfig();
    const verifyUrl = `${config.FRONTEND_URL}/verify-email?token=${activationToken}`;
    const { subject, html } = renderVerificationEmail({
      fullName: input.full_name,
      verifyUrl,
      tenantName: tenant.name,
    });
    try {
      await sendEmail(input.email, subject, html);
    } catch (err) {
      getLogger().error({ err, email: input.email }, 'Failed to send verification email');
    }
  }

  return {
    userId: newUser.id,
    message: isDevMode
      ? 'Registration successful. You can now log in.'
      : 'Registration successful. Please check your email to verify your account.',
  };
}

/**
 * Create a new tenant along with an admin user.
 * Also creates default SLA policies for the tenant.
 * Returns auth credentials so the admin is logged in immediately.
 */
export async function createTenant(input: {
  company_name: string;
  subdomain: string;
  admin_email: string;
  admin_full_name: string;
  admin_password: string;
}): Promise<AuthResult> {
  const db = getDb();
  const config = getConfig();

  // Check subdomain availability
  const [existingTenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.subdomain, input.subdomain))
    .limit(1);

  if (existingTenant) {
    throw new ConflictError('Subdomain already taken.');
  }

  const supportEmail = `support@${input.subdomain}.helpdesk.com`;

  // Create tenant
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: input.company_name,
      subdomain: input.subdomain,
      supportEmail,
    })
    .returning();

  if (!tenant) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create tenant');
  }

  // Create admin user
  const passwordHash = await hashPassword(input.admin_password);

  const [adminUser] = await db
    .insert(users)
    .values({
      tenantId: tenant.id,
      email: input.admin_email,
      fullName: input.admin_full_name,
      passwordHash,
      role: 'admin',
      isActive: true,
      emailVerified: true,
    })
    .returning();

  if (!adminUser) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create admin user');
  }

  // Create default SLA policies
  const slaValues = SLA_DEFAULTS.map((sla) => ({
    tenantId: tenant.id,
    priority: sla.priority,
    firstResponseMinutes: sla.firstResponseMinutes,
    resolutionMinutes: sla.resolutionMinutes,
  }));

  await db.insert(slaPolicies).values(slaValues);

  // Generate token for immediate login
  const expiresIn = config.JWT_EMPLOYEE_EXPIRY;
  const token = signToken(
    { sub: adminUser.id, tid: tenant.id, role: 'admin' },
    expiresIn,
  );

  const expiresInMs = parseExpiryToMs(expiresIn);
  const expiresAt = new Date(Date.now() + expiresInMs).toISOString();

  return {
    user: {
      id: adminUser.id,
      email: adminUser.email,
      full_name: adminUser.fullName,
      role: 'admin',
      is_active: true,
      email_verified: true,
      created_at: adminUser.createdAt.toISOString(),
    },
    tenant: {
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
    },
    token,
    expiresAt,
  };
}

/**
 * Initiate the forgot-password flow.
 * Generates a password reset token and stores it in the database.
 * Always returns the same response regardless of whether the email exists
 * (to prevent user enumeration).
 */
export async function forgotPassword(
  input: ForgotPasswordInput,
): Promise<{ message: string }> {
  const db = getDb();

  // Look up tenant (silently ignore if not found)
  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.subdomain, input.portal))
    .limit(1);

  if (!tenant) {
    // Return success message to prevent tenant enumeration
    return {
      message: 'If an account exists with this email, a password reset link has been sent.',
    };
  }

  // Look up user (silently continue if not found) -- only need id for update
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.tenantId, tenant.id), eq(users.email, input.email)))
    .limit(1);

  if (user) {
    // Generate reset token (use crypto random UUID)
    const resetToken = crypto.randomUUID();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db
      .update(users)
      .set({
        passwordResetToken: resetToken,
        passwordResetTokenExpires: expires,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    const [tenantRow] = await db.select({ name: tenants.name, subdomain: tenants.subdomain }).from(tenants).where(eq(tenants.id, tenant.id)).limit(1);
    const [userRow] = await db.select({ fullName: users.fullName }).from(users).where(eq(users.id, user.id)).limit(1);
    const config = getConfig();
    const resetUrl = `${config.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const { subject, html } = renderPasswordResetEmail({
      fullName: userRow?.fullName ?? 'there',
      resetUrl,
      tenantName: tenantRow?.name ?? 'Support',
    });
    await sendEmail(input.email, subject, html);
  }

  return {
    message: 'If an account exists with this email, a password reset link has been sent.',
  };
}

/**
 * Reset a user's password using a valid password reset token.
 * Invalidates the token after use.
 */
export async function resetPassword(
  input: ResetPasswordInput,
): Promise<{ message: string }> {
  const db = getDb();

  // Find user with the given reset token -- only select columns needed for reset
  const [user] = await db
    .select({
      id: users.id,
      passwordResetTokenExpires: users.passwordResetTokenExpires,
    })
    .from(users)
    .where(eq(users.passwordResetToken, input.token))
    .limit(1);

  if (!user) {
    throw new AppError(
      400,
      'INVALID_TOKEN',
      'This reset link is invalid or has expired.',
    );
  }

  // Check token expiry
  if (
    !user.passwordResetTokenExpires ||
    user.passwordResetTokenExpires < new Date()
  ) {
    throw new AppError(
      400,
      'INVALID_TOKEN',
      'This reset link is invalid or has expired.',
    );
  }

  const passwordHash = await hashPassword(input.password);

  await db
    .update(users)
    .set({
      passwordHash,
      passwordResetToken: null,
      passwordResetTokenExpires: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return {
    message: 'Password reset successfully. Please log in with your new password.',
  };
}

/**
 * Get the current user's profile information including their tenant.
 */
export async function getCurrentUser(
  userId: string,
  tenantId: string,
): Promise<{
  user: {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
    is_active: boolean;
    email_verified: boolean;
    created_at: string;
  };
  tenant: {
    id: string;
    name: string;
    subdomain: string;
    logo_url: string | null;
    brand_color: string | null;
  };
}> {
  const db = getDb();

  // Select only non-sensitive user columns
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

  const [tenant] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      subdomain: tenants.subdomain,
      logoUrl: tenants.logoUrl,
      brandColor: tenants.brandColor,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new NotFoundError('Tenant');
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      role: user.role as UserRole,
      is_active: user.isActive,
      email_verified: user.emailVerified,
      created_at: user.createdAt.toISOString(),
    },
    tenant: {
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      logo_url: tenant.logoUrl,
      brand_color: tenant.brandColor,
    },
  };
}

/**
 * Parse a time duration string (e.g., '8h', '24h', '30m') into milliseconds.
 */
function parseExpiryToMs(expiry: string): number {
  const match = expiry.match(/^(\d+)([hms])$/);
  if (!match) {
    // Default to 8 hours
    return 8 * 60 * 60 * 1000;
  }
  const value = parseInt(match[1] ?? '8', 10);
  const unit = match[2];
  switch (unit) {
    case 'h':
      return value * 60 * 60 * 1000;
    case 'm':
      return value * 60 * 1000;
    case 's':
      return value * 1000;
    default:
      return 8 * 60 * 60 * 1000;
  }
}

/**
 * Verify a user's email address using an activation token.
 */
export async function verifyEmail(token: string): Promise<{ message: string }> {
  const db = getDb();

  const [user] = await db
    .select({
      id: users.id,
      emailVerified: users.emailVerified,
      activationTokenExpires: users.activationTokenExpires,
    })
    .from(users)
    .where(eq(users.activationToken, token))
    .limit(1);

  if (!user) {
    throw new AppError(400, 'INVALID_TOKEN', 'Invalid or expired verification link.');
  }

  if (user.emailVerified) {
    return { message: 'Email already verified. You can now log in.' };
  }

  if (user.activationTokenExpires && user.activationTokenExpires < new Date()) {
    throw new AppError(400, 'TOKEN_EXPIRED', 'Verification link has expired. Please register again.');
  }

  await db
    .update(users)
    .set({
      emailVerified: true,
      activationToken: null,
      activationTokenExpires: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return { message: 'Email verified successfully. You can now log in.' };
}
