import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { signToken } from '../../lib/jwt.js';
import type { AssignmentRule, Ticket } from '@busybirdies/shared';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../db/connection.js', () => ({
  getDb: vi.fn(),
}));

vi.mock('../../services/assignment.service.js', () => ({
  listRules: vi.fn(),
  createRule: vi.fn(),
  updateRule: vi.fn(),
  deleteRule: vi.fn(),
  reorderRules: vi.fn(),
}));

vi.mock('../../services/auto-assign.service.js', () => ({
  evaluateAndAssign: vi.fn(),
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

import * as assignmentService from '../../services/assignment.service.js';
import * as ticketService from '../../services/ticket.service.js';
import { buildApp } from '../../app.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const tenantId = 'tenant-001';
const adminId = 'admin-001';
const agentId = 'a1a1a1a1-b2b2-c3c3-d4d4-e5e5e5e5e5e5';

function makeToken(userId: string, role: 'admin' | 'agent' | 'client') {
  return signToken({ sub: userId, tid: tenantId, role }, '8h');
}

const adminToken = makeToken(adminId, 'admin');
const agentToken = makeToken(agentId, 'agent');

const agentSummary = { id: agentId, full_name: 'Marcus Lee', email: 'marcus@acme.com', role: 'agent' as const };
const clientSummary = { id: 'client-001', full_name: 'Priya Sharma', email: 'priya@client.com', role: 'client' as const };

// UUIDs for rules and groups required by reorderRulesSchema
const ruleId1 = 'aaaa1111-bbbb-cccc-dddd-eeeeeeee0001';
const ruleId2 = 'aaaa1111-bbbb-cccc-dddd-eeeeeeee0002';
const groupId1 = 'aaaa1111-bbbb-cccc-dddd-eeeeeeee0003';

function fakeRule(overrides: Partial<AssignmentRule> = {}): AssignmentRule {
  return {
    id: ruleId1,
    name: 'Route urgent billing to L2',
    is_active: true,
    priority_order: 1,
    condition_logic: 'any' as const,
    conditions: [
      { field: 'priority', operator: 'equals', value: 'urgent' },
      { field: 'tags', operator: 'includes', value: 'billing' },
    ],
    action_type: 'assign_agent',
    target_agent: agentSummary,
    target_group: null,
    created_at: '2026-03-01T10:00:00Z',
    updated_at: '2026-03-01T10:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: Auto-Assignment Flow
// ---------------------------------------------------------------------------

describe('Integration: Auto-Assignment Rules and Ticket Assignment', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it('should create assignment rules and verify ticket auto-assignment flow', async () => {
    // Step 1: Admin creates assignment rules
    const rule1 = fakeRule();
    vi.mocked(assignmentService.createRule).mockResolvedValue(rule1);

    const createRuleRes = await app.inject({
      method: 'POST',
      url: '/v1/assignment-rules',
      headers: { cookie: `session=${adminToken}` },
      payload: {
        name: 'Route urgent billing to L2',
        conditions: [
          { field: 'priority', operator: 'equals', value: 'urgent' },
          { field: 'tags', operator: 'includes', value: 'billing' },
        ],
        condition_logic: 'any',
        action_type: 'assign_agent',
        target_agent_id: agentId,
        is_active: true,
      },
    });

    expect(createRuleRes.statusCode).toBe(201);
    const ruleBody = JSON.parse(createRuleRes.body);
    expect(ruleBody.name).toBe('Route urgent billing to L2');
    expect(ruleBody.conditions).toHaveLength(2);
    expect(ruleBody.is_active).toBe(true);

    // Step 2: Admin creates a second rule
    const rule2 = fakeRule({
      id: ruleId2,
      name: 'Route login issues to L1',
      priority_order: 2,
      conditions: [{ field: 'subject', operator: 'contains', value: 'login' }],
      action_type: 'assign_group',
      target_agent: null,
      target_group: { id: groupId1, name: 'L1 Support', member_count: 3 },
    });
    vi.mocked(assignmentService.createRule).mockResolvedValue(rule2);

    const createRule2Res = await app.inject({
      method: 'POST',
      url: '/v1/assignment-rules',
      headers: { cookie: `session=${adminToken}` },
      payload: {
        name: 'Route login issues to L1',
        conditions: [{ field: 'subject', operator: 'contains', value: 'login' }],
        condition_logic: 'any',
        action_type: 'assign_group',
        target_group_id: groupId1,
        is_active: true,
      },
    });

    expect(createRule2Res.statusCode).toBe(201);
    expect(JSON.parse(createRule2Res.body).action_type).toBe('assign_group');

    // Step 3: List rules to verify they are both present
    vi.mocked(assignmentService.listRules).mockResolvedValue([rule1, rule2]);

    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/assignment-rules',
      headers: { cookie: `session=${adminToken}` },
    });

    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.body);
    expect(listBody.data).toHaveLength(2);
    expect(listBody.data[0].priority_order).toBe(1);
    expect(listBody.data[1].priority_order).toBe(2);

    // Step 4: Create a ticket that matches rule 1 (urgent billing)
    const assignedTicket: Ticket = {
      id: 'ticket-auto-001',
      ticket_number: 'TKT-00050',
      subject: 'Urgent billing discrepancy',
      description: 'Our invoice shows incorrect charges.',
      priority: 'urgent',
      status: 'open',
      client: clientSummary,
      created_by: clientSummary,
      assigned_agent: agentSummary,
      tags: ['billing'],
      source: 'portal',
      jira_issue_key: null,
      jira_issue_url: null,
      sla_first_response_due: '2026-03-04T15:00:00Z',
      sla_resolution_due: '2026-03-04T18:30:00Z',
      sla_first_response_met: null,
      sla_resolution_met: null,
      first_responded_at: null,
      resolved_at: null,
      closed_at: null,
      created_at: '2026-03-04T14:30:00Z',
      updated_at: '2026-03-04T14:30:00Z',
    };
    vi.mocked(ticketService.createTicket).mockResolvedValue(assignedTicket);

    const clientToken = makeToken('client-001', 'client');
    const createTicketRes = await app.inject({
      method: 'POST',
      url: '/v1/tickets',
      headers: { cookie: `session=${clientToken}` },
      payload: {
        subject: 'Urgent billing discrepancy',
        description: 'Our invoice shows incorrect charges.',
        priority: 'urgent',
      },
    });

    expect(createTicketRes.statusCode).toBe(201);
    const ticketBody = JSON.parse(createTicketRes.body);
    // The ticket was created with the agent pre-assigned (via auto-assignment in the service)
    expect(ticketBody.assigned_agent).not.toBeNull();
    expect(ticketBody.assigned_agent.full_name).toBe('Marcus Lee');
  });

  it('should allow admin to reorder rules', async () => {
    const reorderedRules = [
      fakeRule({ id: ruleId2, priority_order: 1, name: 'Second rule now first' }),
      fakeRule({ id: ruleId1, priority_order: 2, name: 'First rule now second' }),
    ];
    vi.mocked(assignmentService.reorderRules).mockResolvedValue(reorderedRules);

    const reorderRes = await app.inject({
      method: 'PUT',
      url: '/v1/assignment-rules/reorder',
      headers: { cookie: `session=${adminToken}` },
      payload: {
        rule_ids: [ruleId2, ruleId1],
      },
    });

    expect(reorderRes.statusCode).toBe(200);
    const reorderBody = JSON.parse(reorderRes.body);
    expect(reorderBody.data[0].id).toBe(ruleId2);
    expect(reorderBody.data[0].priority_order).toBe(1);
    expect(reorderBody.data[1].id).toBe(ruleId1);
    expect(reorderBody.data[1].priority_order).toBe(2);
  });

  it('should allow admin to toggle a rule on and off', async () => {
    const disabledRule = fakeRule({ is_active: false });
    vi.mocked(assignmentService.updateRule).mockResolvedValue(disabledRule);

    const disableRes = await app.inject({
      method: 'PATCH',
      url: `/v1/assignment-rules/${ruleId1}`,
      headers: { cookie: `session=${adminToken}` },
      payload: { is_active: false },
    });

    expect(disableRes.statusCode).toBe(200);
    expect(JSON.parse(disableRes.body).is_active).toBe(false);

    // Re-enable the rule
    const enabledRule = fakeRule({ is_active: true });
    vi.mocked(assignmentService.updateRule).mockResolvedValue(enabledRule);

    const enableRes = await app.inject({
      method: 'PATCH',
      url: `/v1/assignment-rules/${ruleId1}`,
      headers: { cookie: `session=${adminToken}` },
      payload: { is_active: true },
    });

    expect(enableRes.statusCode).toBe(200);
    expect(JSON.parse(enableRes.body).is_active).toBe(true);
  });

  it('should allow admin to delete a rule', async () => {
    vi.mocked(assignmentService.deleteRule).mockResolvedValue(undefined);

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/v1/assignment-rules/${ruleId1}`,
      headers: { cookie: `session=${adminToken}` },
    });

    expect(deleteRes.statusCode).toBe(204);
  });

  it('should deny non-admin users from managing assignment rules', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/assignment-rules',
      headers: { cookie: `session=${agentToken}` },
    });
    // Assignment rules are admin-only
    expect(listRes.statusCode).toBe(403);

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/assignment-rules',
      headers: { cookie: `session=${agentToken}` },
      payload: {
        name: 'Agent trying to create rule',
        conditions: [{ field: 'priority', operator: 'equals', value: 'low' }],
        condition_logic: 'any',
        action_type: 'assign_agent',
        target_agent_id: agentId,
        is_active: true,
      },
    });
    expect(createRes.statusCode).toBe(403);
  });
});
