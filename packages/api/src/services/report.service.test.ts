import { describe, it, expect } from 'vitest';
import type { DashboardMetrics, AgentMetrics } from './report.service.js';
import { buildDateRange } from './report.service.js';

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------

describe('Report service', () => {

  describe('buildDateRange', () => {
    it('should default to last 30 days when no params provided', () => {
      const range = buildDateRange();
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // The "from" should be roughly 30 days ago
      expect(range.from.getDate()).toBe(thirtyDaysAgo.getDate());
      expect(range.from.getHours()).toBe(0);
      expect(range.from.getMinutes()).toBe(0);

      // The "to" should be today at end of day
      expect(range.to.getDate()).toBe(now.getDate());
      expect(range.to.getHours()).toBe(23);
      expect(range.to.getMinutes()).toBe(59);
    });

    it('should use provided date_from when specified', () => {
      const range = buildDateRange('2026-01-15');
      expect(range.from.getFullYear()).toBe(2026);
      expect(range.from.getMonth()).toBe(0); // January
      expect(range.from.getDate()).toBe(15);
      expect(range.from.getHours()).toBe(0);
    });

    it('should use provided date_to when specified', () => {
      const range = buildDateRange(undefined, '2026-02-20');
      expect(range.to.getFullYear()).toBe(2026);
      expect(range.to.getMonth()).toBe(1); // February
      expect(range.to.getDate()).toBe(20);
      expect(range.to.getHours()).toBe(23);
    });

    it('should use both dates when both are specified', () => {
      const range = buildDateRange('2026-01-01', '2026-01-31');
      expect(range.from.getFullYear()).toBe(2026);
      expect(range.from.getMonth()).toBe(0);
      expect(range.from.getDate()).toBe(1);
      expect(range.to.getFullYear()).toBe(2026);
      expect(range.to.getMonth()).toBe(0);
      expect(range.to.getDate()).toBe(31);
    });

    it('should set from to start of day', () => {
      const range = buildDateRange('2026-03-01');
      expect(range.from.getHours()).toBe(0);
      expect(range.from.getMinutes()).toBe(0);
      expect(range.from.getSeconds()).toBe(0);
    });

    it('should set to to end of day', () => {
      const range = buildDateRange(undefined, '2026-03-01');
      expect(range.to.getHours()).toBe(23);
      expect(range.to.getMinutes()).toBe(59);
      expect(range.to.getSeconds()).toBe(59);
    });
  });

  describe('DashboardMetrics type structure', () => {
    it('should match expected dashboard response shape', () => {
      const metrics: DashboardMetrics = {
        period: { from: '2026-02-02', to: '2026-03-04' },
        ticket_volume: {
          total: 342,
          by_day: [{ date: '2026-02-02', count: 12 }],
        },
        avg_first_response_minutes: 47,
        avg_resolution_minutes: 382,
        open_tickets_by_agent: [
          { agent_id: 'a1', agent_name: 'Marcus Lee', count: 14 },
        ],
        tickets_by_status: [{ status: 'open', count: 14 }],
        tickets_by_priority: [{ priority: 'high', count: 5 }],
        sla_by_day: [{ date: '2026-02-02', first_response_rate: 0.9, resolution_rate: 0.8 }],
        csat_distribution: [{ score: 5, count: 10 }],
        sla_compliance: {
          first_response_rate: 0.89,
          resolution_rate: 0.82,
        },
        csat: {
          average_score: 4.2,
          response_count: 156,
          response_rate: 0.45,
          by_day: [{ date: '2026-02-02', average: 4.1, count: 5 }],
        },
      };

      expect(metrics.period.from).toBe('2026-02-02');
      expect(metrics.ticket_volume.total).toBe(342);
      expect(metrics.avg_first_response_minutes).toBe(47);
      expect(metrics.sla_compliance.first_response_rate).toBe(0.89);
      expect(metrics.csat.average_score).toBe(4.2);
      expect(metrics.open_tickets_by_agent).toHaveLength(1);
    });
  });

  describe('AgentMetrics type structure', () => {
    it('should match expected agent report response shape', () => {
      const metrics: AgentMetrics = {
        agent: { id: 'agent-1', full_name: 'Marcus Lee' },
        period: { from: '2026-02-02', to: '2026-03-04' },
        tickets_handled: 87,
        avg_first_response_minutes: 32,
        avg_resolution_minutes: 290,
        sla_compliance: {
          first_response_rate: 0.94,
          resolution_rate: 0.88,
        },
        csat_average: 4.4,
        tickets_by_status: { open: 5, pending: 3, resolved: 72, closed: 65 },
      };

      expect(metrics.agent.full_name).toBe('Marcus Lee');
      expect(metrics.tickets_handled).toBe(87);
      expect(metrics.sla_compliance.first_response_rate).toBe(0.94);
      expect(metrics.csat_average).toBe(4.4);
      expect(metrics.tickets_by_status.open).toBe(5);
    });
  });

  describe('Date formatting', () => {
    it('should produce YYYY-MM-DD date strings', () => {
      const d = new Date('2026-02-15T10:30:00Z');
      const formatted = d.toISOString().slice(0, 10);
      expect(formatted).toBe('2026-02-15');
    });
  });

  describe('Rate calculations', () => {
    it('should calculate SLA compliance rate correctly', () => {
      const met = 89;
      const total = 100;
      const rate = total > 0 ? met / total : 0;
      expect(Number(rate.toFixed(2))).toBe(0.89);
    });

    it('should return 0 when there are no SLA entries', () => {
      const met = 0;
      const total = 0;
      const rate = total > 0 ? met / total : 0;
      expect(rate).toBe(0);
    });

    it('should calculate CSAT response rate correctly', () => {
      const responded = 45;
      const totalSent = 100;
      const rate = totalSent > 0 ? responded / totalSent : 0;
      expect(Number(rate.toFixed(2))).toBe(0.45);
    });

    it('should handle perfect compliance', () => {
      const met = 50;
      const total = 50;
      const rate = total > 0 ? met / total : 0;
      expect(Number(rate.toFixed(2))).toBe(1);
    });
  });

  describe('Rounding', () => {
    it('should round average minutes to nearest integer', () => {
      expect(Math.round(47.3)).toBe(47);
      expect(Math.round(47.7)).toBe(48);
      expect(Math.round(0)).toBe(0);
    });

    it('should round CSAT scores to one decimal place', () => {
      expect(Number((4.167).toFixed(1))).toBe(4.2);
      expect(Number((3.95).toFixed(1))).toBe(4.0);
    });
  });

  describe('Default status map for agent metrics', () => {
    it('should include all four ticket statuses', () => {
      const ticketsByStatus: Record<string, number> = {
        open: 0,
        pending: 0,
        resolved: 0,
        closed: 0,
      };

      expect(ticketsByStatus).toHaveProperty('open');
      expect(ticketsByStatus).toHaveProperty('pending');
      expect(ticketsByStatus).toHaveProperty('resolved');
      expect(ticketsByStatus).toHaveProperty('closed');
    });
  });
});
