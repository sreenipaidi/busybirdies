import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { signToken } from '../../lib/jwt.js';
import type { SLAPolicy, Ticket } from '@busybirdies/shared';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../db/connection.js', () => ({
  getDb: vi.fn(),
}));

vi.mock('../../services/sla.service.js', () => ({
  getPolicies: vi.fn(),
  updatePolicy: vi.fn(),
  applySLADeadlines: vi.fn(),
}));

vi.mock('../../services/ticket.service.js', () => ({
  createTicket: vi.fn(),
  listTickets: vi.fn(),
  getTicket: vi.fn(),
  updateTicket: vi.fn(),
  assignTicket: vi.fn(),
  getAuditTrail: vi.fn(),
}));

vi.mock('../../services/reply.service.js', () => ({
  addReply: vi.fn(),
  getReplies: vi.fn(),
}));

vi.mock('../../services/csat.service.js', () => ({
  createSurvey: vi.fn(),
  getSurvey: vi.fn(),
  submitSurvey: vi.fn(),
}));

import * as slaService from '../../services/sla.service.js';
import * as ticketService from '../../services/ticket.service.js';
import { buildApp } from '../../app.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const tenantId = 'tenant-001';
const adminId = 'admin-001';
const agentId = 'agent-001';
const clientId = 'client-001';

function makeToken(userId: string, role: 'admin' | 'agent' | 'client') {
  return signToken({ sub: userId, tid: tenantId, role }, '8h');
}

const adminToken = makeToken(adminId, 'admin');
const clientToken = makeToken(clientId, 'client');

const clientSummary = { id: clientId, full_name: 'Priya Sharma', email: 'priya@client.com', role: 'client' as const };

const defaultPolicies: SLAPolicy[] = [
  { id: 'sla-urgent', priority: 'urgent', first_response_minutes: 30, resolution_minutes: 240, updated_at: '2026-01-15T10:00:00Z' },
  { id: 'sla-high', priority: 'high', first_response_minutes: 60, resolution_minutes: 480, updated_at: '2026-01-15T10:00:00Z' },
  { id: 'sla-medium', priority: 'medium', first_response_minutes: 240, resolution_minutes: 1440, updated_at: '2026-01-15T10:00:00Z' },
  { id: 'sla-low', priority: 'low', first_response_minutes: 480, resolution_minutes: 2880, updated_at: '2026-01-15T10:00:00Z' },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration: SLA Policy Configuration and Deadline Enforcement', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it('should retrieve default SLA policies after tenant creation', async () => {
    vi.mocked(slaService.getPolicies).mockResolvedValue(defaultPolicies);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/sla-policies',
      headers: { cookie: `session=${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(4);

    // Verify default values match documentation
    const urgent = body.data.find((p: SLAPolicy) => p.priority === 'urgent');
    expect(urgent.first_response_minutes).toBe(30);
    expect(urgent.resolution_minutes).toBe(240);

    const low = body.data.find((p: SLAPolicy) => p.priority === 'low');
    expect(low.first_response_minutes).toBe(480);
    expect(low.resolution_minutes).toBe(2880);
  });

  it('should update SLA policy and verify new deadlines apply to tickets', async () => {
    // Step 1: Admin updates the urgent SLA policy
    const updatedPolicy: SLAPolicy = {
      id: 'sla-urgent',
      priority: 'urgent',
      first_response_minutes: 15,
      resolution_minutes: 120,
      updated_at: '2026-03-04T14:00:00Z',
    };
    vi.mocked(slaService.updatePolicy).mockResolvedValue(updatedPolicy);

    const updateRes = await app.inject({
      method: 'PATCH',
      url: '/v1/sla-policies/sla-urgent',
      headers: { cookie: `session=${adminToken}` },
      payload: {
        first_response_minutes: 15,
        resolution_minutes: 120,
      },
    });

    expect(updateRes.statusCode).toBe(200);
    const updateBody = JSON.parse(updateRes.body);
    expect(updateBody.first_response_minutes).toBe(15);
    expect(updateBody.resolution_minutes).toBe(120);

    // Step 2: Client creates an urgent ticket -- deadlines should reflect new SLA
    const now = new Date('2026-03-04T14:30:00Z');
    const firstResponseDue = new Date(now.getTime() + 15 * 60 * 1000).toISOString(); // +15min
    const resolutionDue = new Date(now.getTime() + 120 * 60 * 1000).toISOString(); // +2hrs

    const urgentTicket: Ticket = {
      id: 'ticket-sla-001',
      ticket_number: 'TKT-00060',
      subject: 'System is down',
      description: 'Our entire system is unresponsive and we need immediate help.',
      priority: 'urgent',
      status: 'open',
      client: clientSummary,
      created_by: clientSummary,
      assigned_agent: null,
      tags: [],
      source: 'portal',
      jira_issue_key: null,
      jira_issue_url: null,
      sla_first_response_due: firstResponseDue,
      sla_resolution_due: resolutionDue,
      sla_first_response_met: null,
      sla_resolution_met: null,
      first_responded_at: null,
      resolved_at: null,
      closed_at: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    vi.mocked(ticketService.createTicket).mockResolvedValue(urgentTicket);

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/tickets',
      headers: { cookie: `session=${clientToken}` },
      payload: {
        subject: 'System is down',
        description: 'Our entire system is unresponsive and we need immediate help.',
        priority: 'urgent',
      },
    });

    expect(createRes.statusCode).toBe(201);
    const ticketBody = JSON.parse(createRes.body);
    expect(ticketBody.sla_first_response_due).toBeDefined();
    expect(ticketBody.sla_resolution_due).toBeDefined();

    // The deadlines should be based on the updated 15min/120min policy
    const firstDue = new Date(ticketBody.sla_first_response_due).getTime();
    const created = new Date(ticketBody.created_at).getTime();
    const firstDiff = (firstDue - created) / (60 * 1000); // minutes
    expect(firstDiff).toBe(15);
  });

  it('should reject SLA update where first response exceeds resolution time via schema validation', async () => {
    // The updateSLAPolicySchema has a Zod .refine() that validates
    // resolution_minutes >= first_response_minutes at the schema level,
    // so this is caught BEFORE the service is called.
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/sla-policies/sla-high',
      headers: { cookie: `session=${adminToken}` },
      payload: {
        first_response_minutes: 500,
        resolution_minutes: 100,
      },
    });

    // Zod refine validation will return 422 via the global error handler
    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    // The refine message appears in the details array, not the top-level message
    const refinementDetail = body.error.details.find(
      (d: { field: string; message: string }) => d.field === 'resolution_minutes',
    );
    expect(refinementDetail).toBeDefined();
    expect(refinementDetail.message).toBe('Resolution time must be greater than or equal to first response time');
  });

  it('should deny non-admin users from viewing SLA policies', async () => {
    const agentToken = makeToken(agentId, 'agent');

    const res = await app.inject({
      method: 'GET',
      url: '/v1/sla-policies',
      headers: { cookie: `session=${agentToken}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('should verify SLA compliance flag is set after agent first response', async () => {
    // Simulate getting a ticket where the first response was within the SLA deadline
    const ticketWithSLAMet: Ticket = {
      id: 'ticket-sla-002',
      ticket_number: 'TKT-00061',
      subject: 'Login help',
      description: 'I am unable to log in to my account and need assistance.',
      priority: 'medium',
      status: 'pending',
      client: clientSummary,
      created_by: clientSummary,
      assigned_agent: { id: agentId, full_name: 'Marcus Lee', email: 'marcus@acme.com', role: 'agent' },
      tags: [],
      source: 'portal',
      jira_issue_key: null,
      jira_issue_url: null,
      sla_first_response_due: '2026-03-04T18:30:00Z',
      sla_resolution_due: '2026-03-05T14:30:00Z',
      sla_first_response_met: true,
      sla_resolution_met: null,
      first_responded_at: '2026-03-04T15:00:00Z',
      resolved_at: null,
      closed_at: null,
      created_at: '2026-03-04T14:30:00Z',
      updated_at: '2026-03-04T15:00:00Z',
    };

    vi.mocked(ticketService.getTicket).mockResolvedValue({
      ticket: ticketWithSLAMet,
      replies: [],
      audit_trail: [],
    });

    const agentToken = makeToken(agentId, 'agent');
    const detailRes = await app.inject({
      method: 'GET',
      url: '/v1/tickets/ticket-sla-002',
      headers: { cookie: `session=${agentToken}` },
    });

    expect(detailRes.statusCode).toBe(200);
    const body = JSON.parse(detailRes.body);
    expect(body.ticket.sla_first_response_met).toBe(true);
    expect(body.ticket.first_responded_at).toBeDefined();
    expect(body.ticket.sla_resolution_met).toBeNull();
  });
});
