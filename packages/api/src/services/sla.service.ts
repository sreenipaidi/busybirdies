import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/connection.js';
import { slaPolicies, tickets, tenants } from '../db/schema.js';
import { NotFoundError, AppError, ValidationError } from '../lib/errors.js';
import { calculateDeadline } from '../lib/sla-calculator.js';
import type { BusinessHours } from '../lib/sla-calculator.js';
import { getLogger } from '../lib/logger.js';
import type {
  SLAPolicy,
  TicketPriority,
  UpdateSLAPolicyInput,
} from '@supportdesk/shared';

/**
 * Convert a DB SLA policy row to the API response shape.
 */
function toSLAPolicy(row: {
  id: string;
  priority: string;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  updatedAt: Date;
}): SLAPolicy {
  return {
    id: row.id,
    priority: row.priority as TicketPriority,
    first_response_minutes: row.firstResponseMinutes,
    resolution_minutes: row.resolutionMinutes,
    updated_at: row.updatedAt.toISOString(),
  };
}

/**
 * Get all SLA policies for a tenant.
 * Returns one policy per priority level, ordered by priority severity.
 */
export async function getPolicies(tenantId: string): Promise<SLAPolicy[]> {
  const db = getDb();

  const rows = await db
    .select()
    .from(slaPolicies)
    .where(eq(slaPolicies.tenantId, tenantId));

  // Sort by priority order: urgent, high, medium, low
  const priorityOrder: Record<string, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return rows
    .map(toSLAPolicy)
    .sort((a, b) => (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99));
}

/**
 * Update an SLA policy for a tenant.
 *
 * @param tenantId - The tenant ID
 * @param policyId - The SLA policy ID
 * @param input - The fields to update (first_response_minutes, resolution_minutes)
 * @returns The updated SLA policy
 */
export async function updatePolicy(
  tenantId: string,
  policyId: string,
  input: UpdateSLAPolicyInput,
): Promise<SLAPolicy> {
  const db = getDb();
  const logger = getLogger();

  // Verify policy exists for this tenant
  const [existing] = await db
    .select()
    .from(slaPolicies)
    .where(and(eq(slaPolicies.id, policyId), eq(slaPolicies.tenantId, tenantId)))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('SLA policy');
  }

  // Validate resolution >= first_response
  const newFirstResponse = input.first_response_minutes;
  const newResolution = input.resolution_minutes;

  if (newResolution < newFirstResponse) {
    throw new ValidationError('resolution_minutes must be >= first_response_minutes', [
      {
        field: 'resolution_minutes',
        message: 'Resolution time must be greater than or equal to first response time',
        code: 'invalid_range',
      },
    ]);
  }

  await db
    .update(slaPolicies)
    .set({
      firstResponseMinutes: newFirstResponse,
      resolutionMinutes: newResolution,
      updatedAt: new Date(),
    })
    .where(eq(slaPolicies.id, policyId));

  const [updated] = await db
    .select()
    .from(slaPolicies)
    .where(eq(slaPolicies.id, policyId))
    .limit(1);

  if (!updated) {
    logger.error({ tenantId, policyId }, 'Failed to retrieve updated SLA policy');
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to retrieve updated SLA policy');
  }

  logger.info(
    { tenantId, policyId, priority: updated.priority },
    'SLA policy updated',
  );

  return toSLAPolicy(updated);
}

/**
 * Calculate and set SLA deadlines on a ticket based on its priority.
 * Looks up the SLA policy for the ticket's priority level,
 * retrieves the tenant's business hours, and calculates the deadlines.
 *
 * @param tenantId - The tenant ID
 * @param ticketId - The ticket to calculate SLA for
 * @param priority - The ticket's priority level
 * @param createdAt - The ticket creation timestamp
 */
export async function calculateAndSetDeadlines(
  tenantId: string,
  ticketId: string,
  priority: string,
  createdAt: Date,
): Promise<void> {
  const db = getDb();
  const logger = getLogger();

  // Get the SLA policy for this priority
  const [policy] = await db
    .select()
    .from(slaPolicies)
    .where(
      and(
        eq(slaPolicies.tenantId, tenantId),
        eq(slaPolicies.priority, priority),
      ),
    )
    .limit(1);

  if (!policy) {
    logger.info(
      { tenantId, ticketId, priority },
      'No SLA policy found for priority, skipping deadline calculation',
    );
    return;
  }

  // Get the tenant's business hours
  const [tenant] = await db
    .select({
      businessHoursStart: tenants.businessHoursStart,
      businessHoursEnd: tenants.businessHoursEnd,
      businessHoursTimezone: tenants.businessHoursTimezone,
      businessHoursDays: tenants.businessHoursDays,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    logger.error({ tenantId }, 'Tenant not found when calculating SLA deadlines');
    return;
  }

  const businessHours: BusinessHours = {
    start: tenant.businessHoursStart,
    end: tenant.businessHoursEnd,
    timezone: tenant.businessHoursTimezone,
    days: tenant.businessHoursDays,
  };

  const firstResponseDue = calculateDeadline(
    createdAt,
    policy.firstResponseMinutes,
    businessHours,
  );

  const resolutionDue = calculateDeadline(
    createdAt,
    policy.resolutionMinutes,
    businessHours,
  );

  await db
    .update(tickets)
    .set({
      slaFirstResponseDue: firstResponseDue,
      slaResolutionDue: resolutionDue,
    })
    .where(eq(tickets.id, ticketId));

  logger.info(
    {
      tenantId,
      ticketId,
      firstResponseDue: firstResponseDue.toISOString(),
      resolutionDue: resolutionDue.toISOString(),
    },
    'SLA deadlines set on ticket',
  );
}

/**
 * Check for tickets approaching SLA breach across all tenants.
 * Returns tickets that are within 30 minutes of breaching their SLA
 * or have already breached.
 *
 * Used by the SLA breach worker.
 */
export async function findBreachingTickets(): Promise<Array<{
  ticketId: string;
  tenantId: string;
  ticketNumber: string;
  subject: string;
  assignedAgentId: string | null;
  slaFirstResponseDue: Date | null;
  slaResolutionDue: Date | null;
  slaFirstResponseMet: boolean | null;
  slaResolutionMet: boolean | null;
  firstRespondedAt: Date | null;
  breachType: 'first_response_warning' | 'first_response_breach' | 'resolution_warning' | 'resolution_breach';
}>> {
  const db = getDb();
  const now = new Date();
  const warningThreshold = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now

  // Find open/pending tickets with upcoming or breached SLA deadlines
  const openTickets = await db
    .select({
      id: tickets.id,
      tenantId: tickets.tenantId,
      ticketNumber: tickets.ticketNumber,
      subject: tickets.subject,
      assignedAgentId: tickets.assignedAgentId,
      slaFirstResponseDue: tickets.slaFirstResponseDue,
      slaResolutionDue: tickets.slaResolutionDue,
      slaFirstResponseMet: tickets.slaFirstResponseMet,
      slaResolutionMet: tickets.slaResolutionMet,
      firstRespondedAt: tickets.firstRespondedAt,
      status: tickets.status,
    })
    .from(tickets)
    .where(
      and(
        // Only check non-resolved tickets
        eq(tickets.status, 'open'),
      ),
    );

  const pendingTickets = await db
    .select({
      id: tickets.id,
      tenantId: tickets.tenantId,
      ticketNumber: tickets.ticketNumber,
      subject: tickets.subject,
      assignedAgentId: tickets.assignedAgentId,
      slaFirstResponseDue: tickets.slaFirstResponseDue,
      slaResolutionDue: tickets.slaResolutionDue,
      slaFirstResponseMet: tickets.slaFirstResponseMet,
      slaResolutionMet: tickets.slaResolutionMet,
      firstRespondedAt: tickets.firstRespondedAt,
      status: tickets.status,
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.status, 'pending'),
      ),
    );

  const allTickets = [...openTickets, ...pendingTickets];

  const results: Array<{
    ticketId: string;
    tenantId: string;
    ticketNumber: string;
    subject: string;
    assignedAgentId: string | null;
    slaFirstResponseDue: Date | null;
    slaResolutionDue: Date | null;
    slaFirstResponseMet: boolean | null;
    slaResolutionMet: boolean | null;
    firstRespondedAt: Date | null;
    breachType: 'first_response_warning' | 'first_response_breach' | 'resolution_warning' | 'resolution_breach';
  }> = [];

  for (const t of allTickets) {
    // Check first response SLA
    if (
      t.slaFirstResponseDue &&
      t.firstRespondedAt === null &&
      t.slaFirstResponseMet === null
    ) {
      if (t.slaFirstResponseDue <= now) {
        results.push({
          ticketId: t.id,
          tenantId: t.tenantId,
          ticketNumber: t.ticketNumber,
          subject: t.subject,
          assignedAgentId: t.assignedAgentId,
          slaFirstResponseDue: t.slaFirstResponseDue,
          slaResolutionDue: t.slaResolutionDue,
          slaFirstResponseMet: t.slaFirstResponseMet,
          slaResolutionMet: t.slaResolutionMet,
          firstRespondedAt: t.firstRespondedAt,
          breachType: 'first_response_breach',
        });
      } else if (t.slaFirstResponseDue <= warningThreshold) {
        results.push({
          ticketId: t.id,
          tenantId: t.tenantId,
          ticketNumber: t.ticketNumber,
          subject: t.subject,
          assignedAgentId: t.assignedAgentId,
          slaFirstResponseDue: t.slaFirstResponseDue,
          slaResolutionDue: t.slaResolutionDue,
          slaFirstResponseMet: t.slaFirstResponseMet,
          slaResolutionMet: t.slaResolutionMet,
          firstRespondedAt: t.firstRespondedAt,
          breachType: 'first_response_warning',
        });
      }
    }

    // Check resolution SLA
    if (
      t.slaResolutionDue &&
      t.slaResolutionMet === null &&
      t.status !== 'resolved' &&
      t.status !== 'closed'
    ) {
      if (t.slaResolutionDue <= now) {
        results.push({
          ticketId: t.id,
          tenantId: t.tenantId,
          ticketNumber: t.ticketNumber,
          subject: t.subject,
          assignedAgentId: t.assignedAgentId,
          slaFirstResponseDue: t.slaFirstResponseDue,
          slaResolutionDue: t.slaResolutionDue,
          slaFirstResponseMet: t.slaFirstResponseMet,
          slaResolutionMet: t.slaResolutionMet,
          firstRespondedAt: t.firstRespondedAt,
          breachType: 'resolution_breach',
        });
      } else if (t.slaResolutionDue <= warningThreshold) {
        results.push({
          ticketId: t.id,
          tenantId: t.tenantId,
          ticketNumber: t.ticketNumber,
          subject: t.subject,
          assignedAgentId: t.assignedAgentId,
          slaFirstResponseDue: t.slaFirstResponseDue,
          slaResolutionDue: t.slaResolutionDue,
          slaFirstResponseMet: t.slaFirstResponseMet,
          slaResolutionMet: t.slaResolutionMet,
          firstRespondedAt: t.firstRespondedAt,
          breachType: 'resolution_warning',
        });
      }
    }
  }

  return results;
}
