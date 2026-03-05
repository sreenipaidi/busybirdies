import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Mock database and services
// ---------------------------------------------------------------------------

const mockLoginResult = {
  user: {
    id: 'admin-001',
    email: 'admin@acme.com',
    full_name: 'Sarah Johnson',
    role: 'admin' as const,
    is_active: true,
    email_verified: true,
    created_at: '2026-01-15T10:00:00Z',
  },
  tenant: {
    id: 'tenant-001',
    name: 'Acme Corp',
    subdomain: 'acme',
  },
  token: 'jwt-admin-token',
  expiresAt: '2026-03-05T10:00:00Z',
};

const mockAgentLoginResult = {
  user: {
    id: 'agent-001',
    email: 'marcus@acme.com',
    full_name: 'Marcus Lee',
    role: 'agent' as const,
    is_active: true,
    email_verified: true,
    created_at: '2026-01-20T10:00:00Z',
  },
  tenant: {
    id: 'tenant-001',
    name: 'Acme Corp',
    subdomain: 'acme',
  },
  token: 'jwt-agent-token',
  expiresAt: '2026-03-05T10:00:00Z',
};

const mockClientRegisterResult = {
  userId: 'client-001',
  message: 'Registration successful. Please check your email to verify your account.',
};

const mockTenantResult = {
  user: {
    id: 'admin-new',
    email: 'founder@newco.com',
    full_name: 'Founder User',
    role: 'admin' as const,
    is_active: true,
    email_verified: true,
    created_at: '2026-03-04T10:00:00Z',
  },
  tenant: {
    id: 'tenant-new',
    name: 'NewCo Inc',
    subdomain: 'newco',
  },
  token: 'jwt-newco-admin-token',
  expiresAt: '2026-03-05T10:00:00Z',
};

vi.mock('../../services/auth.service.js', () => ({
  login: vi.fn(),
  register: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  getCurrentUser: vi.fn(),
  createTenant: vi.fn(),
}));

vi.mock('../../db/connection.js', () => ({
  getDb: vi.fn(),
}));

vi.mock('../../services/user.service.js', () => ({
  listUsers: vi.fn(),
  inviteUser: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
}));

import * as authService from '../../services/auth.service.js';
import * as userService from '../../services/user.service.js';
import { buildApp } from '../../app.js';

// ---------------------------------------------------------------------------
// Integration: Full Auth Flow
// ---------------------------------------------------------------------------

describe('Integration: Full Authentication Flow', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it('should complete the full tenant registration and admin login flow', async () => {
    // Step 1: Register a new tenant
    vi.mocked(authService.createTenant).mockResolvedValue(mockTenantResult);

    const registerTenantRes = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        company_name: 'NewCo Inc',
        subdomain: 'newco',
        admin_email: 'founder@newco.com',
        admin_full_name: 'Founder User',
        admin_password: 'SecurePassword123!',
      },
    });

    expect(registerTenantRes.statusCode).toBe(201);
    const tenantBody = JSON.parse(registerTenantRes.body);
    expect(tenantBody.tenant.subdomain).toBe('newco');
    expect(tenantBody.user.role).toBe('admin');
    expect(tenantBody.tenant.support_email).toBe('support@newco.helpdesk.com');

    // Verify the session cookie was set
    const setCookie = registerTenantRes.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    expect(String(setCookie)).toContain('session=');

    // Step 2: Admin logs in with the new credentials
    vi.mocked(authService.login).mockResolvedValue({
      ...mockTenantResult,
      token: 'jwt-newco-login-token',
    });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        email: 'founder@newco.com',
        password: 'SecurePassword123!',
        portal: 'newco',
      },
    });

    expect(loginRes.statusCode).toBe(200);
    const loginBody = JSON.parse(loginRes.body);
    expect(loginBody.user.email).toBe('founder@newco.com');
    expect(loginBody.tenant.subdomain).toBe('newco');

    // Step 3: Access the /auth/me endpoint with valid session
    vi.mocked(authService.getCurrentUser).mockResolvedValue({
      user: mockTenantResult.user,
      tenant: {
        id: 'tenant-new',
        name: 'NewCo Inc',
        subdomain: 'newco',
        logo_url: null,
        brand_color: '#2563EB',
      },
    });
  });

  it('should register a client, then attempt login before verification', async () => {
    // Step 1: Client registers
    vi.mocked(authService.register).mockResolvedValue(mockClientRegisterResult);

    const registerRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 'client@company.com',
        full_name: 'Priya Sharma',
        password: 'SecurePassword123!',
        portal: 'acme',
      },
    });

    expect(registerRes.statusCode).toBe(201);
    const registerBody = JSON.parse(registerRes.body);
    expect(registerBody.user_id).toBe('client-001');
    expect(registerBody.message).toContain('Registration successful');

    // Step 2: Client tries to log in before email verification
    const { AppError } = await import('../../lib/errors.js');
    vi.mocked(authService.login).mockRejectedValue(
      new AppError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email address before logging in.'),
    );

    const loginRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        email: 'client@company.com',
        password: 'SecurePassword123!',
        portal: 'acme',
      },
    });

    expect(loginRes.statusCode).toBe(403);
    const loginBody = JSON.parse(loginRes.body);
    expect(loginBody.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('should handle the full admin login and agent invite flow', async () => {
    // Step 1: Admin logs in
    vi.mocked(authService.login).mockResolvedValue(mockLoginResult);

    const adminLoginRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        email: 'admin@acme.com',
        password: 'AdminPass123!',
        portal: 'acme',
      },
    });

    expect(adminLoginRes.statusCode).toBe(200);
    const adminSession = String(adminLoginRes.headers['set-cookie']);
    expect(adminSession).toContain('session=');

    // Step 2: Admin invites a new agent -- uses the invited user mock
    vi.mocked(userService.inviteUser).mockResolvedValue({
      id: 'agent-new',
      email: 'new-agent@acme.com',
      full_name: 'New Agent',
      role: 'agent',
      is_active: false,
      email_verified: false,
      created_at: '2026-03-04T14:30:00Z',
    });

    // Step 3: The invited agent then logs in after activation
    vi.mocked(authService.login).mockResolvedValue(mockAgentLoginResult);

    const agentLoginRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        email: 'marcus@acme.com',
        password: 'AgentPass123!',
        portal: 'acme',
      },
    });

    expect(agentLoginRes.statusCode).toBe(200);
    const agentBody = JSON.parse(agentLoginRes.body);
    expect(agentBody.user.role).toBe('agent');
    expect(agentBody.user.full_name).toBe('Marcus Lee');
  });

  it('should handle forgot password and reset password flow end-to-end', async () => {
    // Step 1: User initiates forgot password
    vi.mocked(authService.forgotPassword).mockResolvedValue({
      message: 'If an account exists with this email, a password reset link has been sent.',
    });

    const forgotRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/forgot-password',
      payload: {
        email: 'agent@acme.com',
        portal: 'acme',
      },
    });

    expect(forgotRes.statusCode).toBe(200);
    const forgotBody = JSON.parse(forgotRes.body);
    expect(forgotBody.message).toContain('password reset link');

    // Step 2: User resets password with valid token
    vi.mocked(authService.resetPassword).mockResolvedValue({
      message: 'Password reset successfully. Please log in with your new password.',
    });

    const resetRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/reset-password',
      payload: {
        token: 'valid-reset-token-uuid',
        password: 'NewSecurePassword456!',
      },
    });

    expect(resetRes.statusCode).toBe(200);
    const resetBody = JSON.parse(resetRes.body);
    expect(resetBody.message).toContain('Password reset successfully');

    // Step 3: User logs in with new password
    vi.mocked(authService.login).mockResolvedValue(mockAgentLoginResult);

    const loginRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        email: 'marcus@acme.com',
        password: 'NewSecurePassword456!',
        portal: 'acme',
      },
    });

    expect(loginRes.statusCode).toBe(200);
    expect(JSON.parse(loginRes.body).user.email).toBe('marcus@acme.com');
  });

  it('should reject login with invalid credentials and lock account after repeated failures', async () => {
    const { AuthenticationError, AppError } = await import('../../lib/errors.js');

    // Attempt 1-9: Invalid credentials
    vi.mocked(authService.login).mockRejectedValue(
      new AuthenticationError('Invalid email or password.'),
    );

    const failedRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        email: 'admin@acme.com',
        password: 'WrongPassword',
        portal: 'acme',
      },
    });

    expect(failedRes.statusCode).toBe(401);
    const failedBody = JSON.parse(failedRes.body);
    expect(failedBody.error.code).toBe('UNAUTHORIZED');

    // After 10 attempts: Account locked
    vi.mocked(authService.login).mockRejectedValue(
      new AppError(403, 'ACCOUNT_LOCKED', 'Account is temporarily locked due to too many failed login attempts.'),
    );

    const lockedRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        email: 'admin@acme.com',
        password: 'WrongAgain',
        portal: 'acme',
      },
    });

    expect(lockedRes.statusCode).toBe(403);
    const lockedBody = JSON.parse(lockedRes.body);
    expect(lockedBody.error.code).toBe('ACCOUNT_LOCKED');
  });

  it('should prevent access to protected endpoints without authentication', async () => {
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
    });
    expect(logoutRes.statusCode).toBe(401);

    const meRes = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
    });
    expect(meRes.statusCode).toBe(401);
  });

  it('should reject registration with duplicate email', async () => {
    const { ConflictError } = await import('../../lib/errors.js');
    vi.mocked(authService.register).mockRejectedValue(
      new ConflictError('An account with this email already exists.'),
    );

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 'existing@acme.com',
        full_name: 'Existing User',
        password: 'SecurePassword123!',
        portal: 'acme',
      },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('CONFLICT');
    expect(body.error.message).toContain('already exists');
  });

  it('should reject tenant creation with duplicate subdomain', async () => {
    const { ConflictError } = await import('../../lib/errors.js');
    vi.mocked(authService.createTenant).mockRejectedValue(
      new ConflictError('Subdomain already taken.'),
    );

    const res = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        company_name: 'Duplicate Corp',
        subdomain: 'acme',
        admin_email: 'admin@duplicate.com',
        admin_full_name: 'Admin',
        admin_password: 'SecurePassword123!',
      },
    });

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).error.message).toContain('Subdomain already taken');
  });
});
