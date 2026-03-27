import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { ENDPOINTS } from '../api/endpoints.js';

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

/** Full dashboard metrics response from the API. */
export interface DashboardMetrics {
  period: { from: string; to: string };
  ticket_volume: {
    total: number;
    by_day: DayVolume[];
  };
  avg_first_response_minutes: number;
  avg_resolution_minutes: number;
  tickets_by_status: { status: string; count: number }[];
  tickets_by_priority: { priority: string; count: number }[];
  open_tickets_by_agent: AgentTicketCount[];
  sla_by_day: { date: string; first_response_rate: number; resolution_rate: number }[];
  csat_distribution: { score: number; count: number }[];
  sla_compliance: {
    first_response_rate: number;
    resolution_rate: number;
  };
  csat: {
    average_score: number;
    response_count: number;
    response_rate: number;
    by_day: CSATDayAverage[];
  };
}

/**
 * TanStack Query hook to fetch the reports dashboard metrics.
 * Fetches aggregated metrics from GET /v1/reports/dashboard.
 */
export function useReportsDashboard(dateFrom?: string, dateTo?: string) {
  const params = new URLSearchParams();
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo) params.set('date_to', dateTo);
  const qs = params.toString();
  const url = `${ENDPOINTS.reports.dashboard}${qs ? `?${qs}` : ''}`;

  return useQuery<DashboardMetrics>({
    queryKey: ['reports', 'dashboard', dateFrom, dateTo],
    queryFn: () => api.get<DashboardMetrics>(url),
  });
}

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

export interface TeamMetrics {
  agents: AgentSummaryMetrics[];
  period: { from: string; to: string };
}

export function useReportsTeam(dateFrom?: string, dateTo?: string) {
  const params = new URLSearchParams();
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo) params.set('date_to', dateTo);
  const qs = params.toString();
  const url = `${ENDPOINTS.reports.team}${qs ? `?${qs}` : ''}`;

  return useQuery<TeamMetrics>({
    queryKey: ['reports', 'team', dateFrom, dateTo],
    queryFn: () => api.get<TeamMetrics>(url),
  });
}
