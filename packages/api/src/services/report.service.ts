import { eq, and, sql, gte, lte, count, avg, isNotNull } from 'drizzle-orm';
import { getDb } from '../db/connection.js';
import { tickets, users, csatResponses } from '../db/schema.js';
import { getLogger } from '../lib/logger.js';
import { NotFoundError } from '../lib/errors.js';

/** Date range filter used by all report queries. */
export interface DateRange {
  from: Date;
  to: Date;
}

/** Per-day ticket volume entry. */
export interface DayVolume {
  date: string;
  count: number;
}

/** Agent ticket count entry. */
export interface AgentTicketCount {
  agent_id: string;
  agent_name: string;
  count: number;
}

/** CSAT per-day average entry. */
export interface CSATDayAverage {
  date: string;
  average: number;
  count: number;
}

/** SLA compliance rates. */
export interface SLACompliance {
  first_response_rate: number;
  resolution_rate: number;
}

/** CSAT summary data. */
export interface CSATSummary {
  average_score: number;
  response_count: number;
  response_rate: number;
  by_day: CSATDayAverage[];
}

/** Ticket count by status. */
export interface StatusCount { status: string; count: number; }

/** Ticket count by priority. */
export interface PriorityCount { priority: string; count: number; }

/** SLA compliance by day. */
export interface SLADayCompliance { date: string; first_response_rate: number; resolution_rate: number; }

/** CSAT score distribution. */
export interface CSATDistribution { score: number; count: number; }

/** Full dashboard metrics response. */
export interface DashboardMetrics {
  period: { from: string; to: string };
  ticket_volume: {
    total: number;
    by_day: DayVolume[];
  };
  avg_first_response_minutes: number;
  avg_resolution_minutes: number;
  open_tickets_by_agent: AgentTicketCount[];
  tickets_by_status: StatusCount[];
  tickets_by_priority: PriorityCount[];
  sla_compliance: SLACompliance;
  sla_by_day: SLADayCompliance[];
  csat_distribution: CSATDistribution[];
  csat: CSATSummary;
}

/** Agent-specific report metrics. */
export interface AgentMetrics {
  agent: { id: string; full_name: string };
  period: { from: string; to: string };
  tickets_handled: number;
  avg_first_response_minutes: number;
  avg_resolution_minutes: number;
  sla_compliance: SLACompliance;
  csat_average: number;
  tickets_by_status: Record<string, number>;
}

/**
 * Parse a YYYY-MM-DD date string as local midnight.
 * Using T00:00:00 ensures it is parsed as local time, not UTC.
 */
function parseLocalDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

/**
 * Compute the default date range (last 30 days) if not specified.
 */
export function buildDateRange(dateFrom?: string, dateTo?: string): DateRange {
  const to = dateTo ? parseLocalDate(dateTo) : new Date();
  const from = dateFrom ? parseLocalDate(dateFrom) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  // Set to end of day for the 'to' date
  to.setHours(23, 59, 59, 999);
  // Set to start of day for the 'from' date
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

/**
 * Format a Date as an ISO date string (YYYY-MM-DD).
 */
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Get aggregated dashboard metrics for a tenant within a date range.
 *
 * Includes ticket volume, response times, SLA compliance, agent stats, and CSAT data.
 */
export async function getDashboardMetrics(
  tenantId: string,
  dateRange: DateRange,
): Promise<DashboardMetrics> {
  const db = getDb();
  const logger = getLogger();

  try {
    // 1. Total ticket volume in period
    const [volumeResult] = await db
      .select({ total: count() })
      .from(tickets)
      .where(
        and(
          eq(tickets.tenantId, tenantId),
          gte(tickets.createdAt, dateRange.from),
          lte(tickets.createdAt, dateRange.to),
        ),
      );
    const totalVolume = volumeResult?.total ?? 0;

    // 2. Ticket volume by day
    const byDayRows = await db
      .select({
        date: sql<string>`to_char(${tickets.createdAt}::date, 'YYYY-MM-DD')`,
        count: count(),
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.tenantId, tenantId),
          gte(tickets.createdAt, dateRange.from),
          lte(tickets.createdAt, dateRange.to),
        ),
      )
      .groupBy(sql`${tickets.createdAt}::date`)
      .orderBy(sql`${tickets.createdAt}::date`);

    const byDay: DayVolume[] = byDayRows.map((r) => ({
      date: r.date,
      count: r.count,
    }));

    // 3. Average first response time in minutes (for tickets that have a first response)
    const [avgFirstResponse] = await db
      .select({
        avg_minutes: avg(
          sql<number>`EXTRACT(EPOCH FROM (${tickets.firstRespondedAt} - ${tickets.createdAt})) / 60`,
        ),
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.tenantId, tenantId),
          isNotNull(tickets.firstRespondedAt),
          gte(tickets.createdAt, dateRange.from),
          lte(tickets.createdAt, dateRange.to),
        ),
      );
    const avgFirstResponseMinutes = Math.round(Number(avgFirstResponse?.avg_minutes ?? 0));

    // 4. Average resolution time in minutes (for resolved tickets)
    const [avgResolution] = await db
      .select({
        avg_minutes: avg(
          sql<number>`EXTRACT(EPOCH FROM (${tickets.resolvedAt} - ${tickets.createdAt})) / 60`,
        ),
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.tenantId, tenantId),
          isNotNull(tickets.resolvedAt),
          gte(tickets.createdAt, dateRange.from),
          lte(tickets.createdAt, dateRange.to),
        ),
      );
    const avgResolutionMinutes = Math.round(Number(avgResolution?.avg_minutes ?? 0));

    // 5. Open tickets by agent
    const agentRows = await db
      .select({
        agentId: tickets.assignedAgentId,
        agentName: users.fullName,
        count: count(),
      })
      .from(tickets)
      .innerJoin(users, eq(tickets.assignedAgentId, users.id))
      .where(
        and(
          eq(tickets.tenantId, tenantId),
          eq(tickets.status, 'open'),
        ),
      )
      .groupBy(tickets.assignedAgentId, users.fullName);

    const openTicketsByAgent: AgentTicketCount[] = agentRows
      .filter((r) => r.agentId !== null)
      .map((r) => ({
        agent_id: r.agentId!,
        agent_name: r.agentName,
        count: r.count,
      }));

    // 6. SLA compliance rates
    const [slaFirstResponse] = await db
      .select({
        total: count(),
        met: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaFirstResponseMet} = true)`,
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.tenantId, tenantId),
          isNotNull(tickets.slaFirstResponseMet),
          gte(tickets.createdAt, dateRange.from),
          lte(tickets.createdAt, dateRange.to),
        ),
      );

    const [slaResolution] = await db
      .select({
        total: count(),
        met: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaResolutionMet} = true)`,
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.tenantId, tenantId),
          isNotNull(tickets.slaResolutionMet),
          gte(tickets.createdAt, dateRange.from),
          lte(tickets.createdAt, dateRange.to),
        ),
      );

    const firstResponseRate =
      slaFirstResponse && slaFirstResponse.total > 0
        ? Number(slaFirstResponse.met) / slaFirstResponse.total
        : 0;
    const resolutionRate =
      slaResolution && slaResolution.total > 0
        ? Number(slaResolution.met) / slaResolution.total
        : 0;

    // 7. CSAT data
    const [csatAgg] = await db
      .select({
        average_score: avg(csatResponses.rating),
        response_count: count(),
      })
      .from(csatResponses)
      .where(
        and(
          eq(csatResponses.tenantId, tenantId),
          isNotNull(csatResponses.respondedAt),
          gte(csatResponses.createdAt, dateRange.from),
          lte(csatResponses.createdAt, dateRange.to),
        ),
      );

    // Total CSAT surveys sent in the period
    const [csatTotal] = await db
      .select({ total: count() })
      .from(csatResponses)
      .where(
        and(
          eq(csatResponses.tenantId, tenantId),
          gte(csatResponses.createdAt, dateRange.from),
          lte(csatResponses.createdAt, dateRange.to),
        ),
      );

    const csatResponseCount = csatAgg?.response_count ?? 0;
    const csatTotalSent = csatTotal?.total ?? 0;
    const csatResponseRate = csatTotalSent > 0 ? csatResponseCount / csatTotalSent : 0;

    // CSAT by day
    const csatByDayRows = await db
      .select({
        date: sql<string>`to_char(${csatResponses.respondedAt}::date, 'YYYY-MM-DD')`,
        average: avg(csatResponses.rating),
        count: count(),
      })
      .from(csatResponses)
      .where(
        and(
          eq(csatResponses.tenantId, tenantId),
          isNotNull(csatResponses.respondedAt),
          gte(csatResponses.createdAt, dateRange.from),
          lte(csatResponses.createdAt, dateRange.to),
        ),
      )
      .groupBy(sql`${csatResponses.respondedAt}::date`)
      .orderBy(sql`${csatResponses.respondedAt}::date`);

    const csatByDay: CSATDayAverage[] = csatByDayRows.map((r) => ({
      date: r.date,
      average: Number(Number(r.average ?? 0).toFixed(1)),
      count: r.count,
    }));

    // 8. Tickets by status
    const statusRows = await db
      .select({ status: tickets.status, count: count() })
      .from(tickets)
      .where(and(eq(tickets.tenantId, tenantId), gte(tickets.createdAt, dateRange.from), lte(tickets.createdAt, dateRange.to)))
      .groupBy(tickets.status);
    const ticketsByStatus: StatusCount[] = statusRows.map((r) => ({ status: r.status, count: r.count }));

    // 9. Tickets by priority
    const priorityRows = await db
      .select({ priority: tickets.priority, count: count() })
      .from(tickets)
      .where(and(eq(tickets.tenantId, tenantId), gte(tickets.createdAt, dateRange.from), lte(tickets.createdAt, dateRange.to)))
      .groupBy(tickets.priority);
    const ticketsByPriority: PriorityCount[] = priorityRows.map((r) => ({ priority: r.priority, count: r.count }));

    // 10. SLA compliance by day
    const slaByDayRows = await db
      .select({
        date: sql<string>`to_char(${tickets.createdAt}::date, 'YYYY-MM-DD')`,
        total_first: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaFirstResponseMet} IS NOT NULL)`,
        met_first: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaFirstResponseMet} = true)`,
        total_res: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaResolutionMet} IS NOT NULL)`,
        met_res: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaResolutionMet} = true)`,
      })
      .from(tickets)
      .where(and(eq(tickets.tenantId, tenantId), gte(tickets.createdAt, dateRange.from), lte(tickets.createdAt, dateRange.to)))
      .groupBy(sql`${tickets.createdAt}::date`)
      .orderBy(sql`${tickets.createdAt}::date`);
    const slaByDay: SLADayCompliance[] = slaByDayRows.map((r) => ({
      date: r.date,
      first_response_rate: r.total_first > 0 ? Number((r.met_first / r.total_first).toFixed(2)) : 0,
      resolution_rate: r.total_res > 0 ? Number((r.met_res / r.total_res).toFixed(2)) : 0,
    }));

    // 11. CSAT score distribution
    const csatDistRows = await db
      .select({ score: csatResponses.rating, count: count() })
      .from(csatResponses)
      .where(and(eq(csatResponses.tenantId, tenantId), isNotNull(csatResponses.respondedAt), gte(csatResponses.createdAt, dateRange.from), lte(csatResponses.createdAt, dateRange.to)))
      .groupBy(csatResponses.rating)
      .orderBy(csatResponses.rating);
    const csatDistribution: CSATDistribution[] = csatDistRows.map((r) => ({ score: r.score ?? 0, count: r.count }));

    return {
      period: {
        from: formatDate(dateRange.from),
        to: formatDate(dateRange.to),
      },
      ticket_volume: {
        total: totalVolume,
        by_day: byDay,
      },
      avg_first_response_minutes: avgFirstResponseMinutes,
      avg_resolution_minutes: avgResolutionMinutes,
      open_tickets_by_agent: openTicketsByAgent,
      tickets_by_status: ticketsByStatus,
      tickets_by_priority: ticketsByPriority,
      sla_compliance: {
        first_response_rate: Number(firstResponseRate.toFixed(2)),
        resolution_rate: Number(resolutionRate.toFixed(2)),
      },
      sla_by_day: slaByDay,
      csat_distribution: csatDistribution,
      csat: {
        average_score: Number(Number(csatAgg?.average_score ?? 0).toFixed(1)),
        response_count: csatResponseCount,
        response_rate: Number(csatResponseRate.toFixed(2)),
        by_day: csatByDay,
      },
    };
  } catch (err) {
    logger.error({ err, tenantId }, 'Failed to compute dashboard metrics');
    throw err;
  }
}

/**
 * Get per-agent performance metrics within a date range.
 *
 * Admins can view any agent's metrics. Agents can only view their own.
 */
export async function getAgentMetrics(
  tenantId: string,
  agentId: string,
  dateRange: DateRange,
): Promise<AgentMetrics> {
  const db = getDb();
  const logger = getLogger();

  try {
    // Verify agent exists
    const [agent] = await db
      .select({
        id: users.id,
        fullName: users.fullName,
      })
      .from(users)
      .where(and(eq(users.id, agentId), eq(users.tenantId, tenantId)))
      .limit(1);

    if (!agent) {
      throw new NotFoundError('Agent');
    }

    // Total tickets handled (assigned to this agent in the date range)
    const [ticketsHandled] = await db
      .select({ total: count() })
      .from(tickets)
      .where(
        and(
          eq(tickets.tenantId, tenantId),
          eq(tickets.assignedAgentId, agentId),
          gte(tickets.createdAt, dateRange.from),
          lte(tickets.createdAt, dateRange.to),
        ),
      );

    // Average first response time
    const [avgFirst] = await db
      .select({
        avg_minutes: avg(
          sql<number>`EXTRACT(EPOCH FROM (${tickets.firstRespondedAt} - ${tickets.createdAt})) / 60`,
        ),
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.tenantId, tenantId),
          eq(tickets.assignedAgentId, agentId),
          isNotNull(tickets.firstRespondedAt),
          gte(tickets.createdAt, dateRange.from),
          lte(tickets.createdAt, dateRange.to),
        ),
      );

    // Average resolution time
    const [avgRes] = await db
      .select({
        avg_minutes: avg(
          sql<number>`EXTRACT(EPOCH FROM (${tickets.resolvedAt} - ${tickets.createdAt})) / 60`,
        ),
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.tenantId, tenantId),
          eq(tickets.assignedAgentId, agentId),
          isNotNull(tickets.resolvedAt),
          gte(tickets.createdAt, dateRange.from),
          lte(tickets.createdAt, dateRange.to),
        ),
      );

    // SLA compliance for this agent
    const [slaFirst] = await db
      .select({
        total: count(),
        met: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaFirstResponseMet} = true)`,
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.tenantId, tenantId),
          eq(tickets.assignedAgentId, agentId),
          isNotNull(tickets.slaFirstResponseMet),
          gte(tickets.createdAt, dateRange.from),
          lte(tickets.createdAt, dateRange.to),
        ),
      );

    const [slaRes] = await db
      .select({
        total: count(),
        met: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaResolutionMet} = true)`,
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.tenantId, tenantId),
          eq(tickets.assignedAgentId, agentId),
          isNotNull(tickets.slaResolutionMet),
          gte(tickets.createdAt, dateRange.from),
          lte(tickets.createdAt, dateRange.to),
        ),
      );

    const firstResponseRate =
      slaFirst && slaFirst.total > 0 ? Number(slaFirst.met) / slaFirst.total : 0;
    const resolutionRate =
      slaRes && slaRes.total > 0 ? Number(slaRes.met) / slaRes.total : 0;

    // CSAT average for tickets assigned to this agent
    const [csatAvg] = await db
      .select({
        avg_score: avg(csatResponses.rating),
      })
      .from(csatResponses)
      .innerJoin(tickets, eq(csatResponses.ticketId, tickets.id))
      .where(
        and(
          eq(csatResponses.tenantId, tenantId),
          eq(tickets.assignedAgentId, agentId),
          isNotNull(csatResponses.respondedAt),
          gte(csatResponses.createdAt, dateRange.from),
          lte(csatResponses.createdAt, dateRange.to),
        ),
      );

    // Tickets by status for this agent
    const statusRows = await db
      .select({
        status: tickets.status,
        count: count(),
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.tenantId, tenantId),
          eq(tickets.assignedAgentId, agentId),
          gte(tickets.createdAt, dateRange.from),
          lte(tickets.createdAt, dateRange.to),
        ),
      )
      .groupBy(tickets.status);

    const ticketsByStatus: Record<string, number> = {
      open: 0,
      pending: 0,
      resolved: 0,
      closed: 0,
    };
    for (const row of statusRows) {
      ticketsByStatus[row.status] = row.count;
    }

    return {
      agent: {
        id: agent.id,
        full_name: agent.fullName,
      },
      period: {
        from: formatDate(dateRange.from),
        to: formatDate(dateRange.to),
      },
      tickets_handled: ticketsHandled?.total ?? 0,
      avg_first_response_minutes: Math.round(Number(avgFirst?.avg_minutes ?? 0)),
      avg_resolution_minutes: Math.round(Number(avgRes?.avg_minutes ?? 0)),
      sla_compliance: {
        first_response_rate: Number(firstResponseRate.toFixed(2)),
        resolution_rate: Number(resolutionRate.toFixed(2)),
      },
      csat_average: Number(Number(csatAvg?.avg_score ?? 0).toFixed(1)),
      tickets_by_status: ticketsByStatus,
    };
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    logger.error({ err, tenantId, agentId }, 'Failed to compute agent metrics');
    throw err;
  }
}

/** Summary metrics for a single agent in the team report. */
export interface AgentSummaryMetrics {
  agent_id: string;
  agent_name: string;
  tickets_handled: number;
  avg_first_response_minutes: number;
  avg_resolution_minutes: number;
  sla_first_response_rate: number;
  sla_resolution_rate: number;
  csat_average: number;
  tickets_by_status: Record<string, number>;
}

/**
 * Get team-wide per-agent metrics for all agents in a tenant.
 */
export async function getTeamMetrics(
  tenantId: string,
  dateRange: DateRange,
): Promise<{ agents: AgentSummaryMetrics[]; period: { from: string; to: string } }> {
  const db = getDb();

  // Get all agents in tenant
  const agentRows = await db
    .select({ id: users.id, fullName: users.fullName })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), sql`${users.role} IN ('agent', 'admin')`, eq(users.isActive, true)));

  const agents: AgentSummaryMetrics[] = await Promise.all(
    agentRows.map(async (agent) => {
      const metrics = await getAgentMetrics(tenantId, agent.id, dateRange);
      return {
        agent_id: agent.id,
        agent_name: agent.fullName,
        tickets_handled: metrics.tickets_handled,
        avg_first_response_minutes: metrics.avg_first_response_minutes,
        avg_resolution_minutes: metrics.avg_resolution_minutes,
        sla_first_response_rate: metrics.sla_compliance.first_response_rate,
        sla_resolution_rate: metrics.sla_compliance.resolution_rate,
        csat_average: metrics.csat_average,
        tickets_by_status: metrics.tickets_by_status,
      };
    })
  );

  return {
    agents: agents.sort((a, b) => b.tickets_handled - a.tickets_handled),
    period: { from: formatDate(dateRange.from), to: formatDate(dateRange.to) },
  };
}
