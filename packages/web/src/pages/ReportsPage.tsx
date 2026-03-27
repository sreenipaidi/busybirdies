import { useState } from 'react';
import { Card } from '../components/ui/Card.js';
import { Spinner } from '../components/ui/Spinner.js';
import { useReportsDashboard, useReportsTeam } from '../hooks/useReportsDashboard.js';
import type { DashboardMetrics, TeamMetrics } from '../hooks/useReportsDashboard.js';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PERIOD_OPTIONS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#E53E3E', high: '#DD6B20', medium: '#D69E2E', low: '#38A169',
};

const STATUS_COLORS: Record<string, string> = {
  open: '#2563EB', pending: '#F59E0B', resolved: '#16A34A', closed: '#6B7280',
};

const TABS = ['Overview', 'Team', 'SLA', 'CSAT'] as const;
type Tab = typeof TABS[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatMinutes(mins: number): string {
  if (mins === 0) return '--';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getDateRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// Shared Components
// ---------------------------------------------------------------------------
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card padding="md">
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-text-primary mt-1">{value}</p>
      {sub && <p className="text-xs text-text-secondary mt-0.5">{sub}</p>}
    </Card>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-text-primary mb-4">{children}</h3>;
}

function EmptyChart({ message }: { message: string }) {
  return <div className="flex items-center justify-center h-48 text-sm text-text-secondary">{message}</div>;
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------
function OverviewTab({ data }: { data: DashboardMetrics }) {
  const statusData = data.tickets_by_status.map((s) => ({
    name: s.status.charAt(0).toUpperCase() + s.status.slice(1),
    value: s.count,
    color: STATUS_COLORS[s.status] ?? '#718096',
  }));

  const priorityData = data.tickets_by_priority.map((p) => ({
    name: p.priority.charAt(0).toUpperCase() + p.priority.slice(1),
    value: p.count,
    color: PRIORITY_COLORS[p.priority] ?? '#718096',
  }));

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Tickets" value={data.ticket_volume.total} />
        <StatCard label="Avg First Response" value={formatMinutes(data.avg_first_response_minutes)} />
        <StatCard label="Avg Resolution" value={formatMinutes(data.avg_resolution_minutes)} />
        <StatCard label="SLA Compliance" value={`${Math.round(data.sla_compliance.first_response_rate * 100)}%`} sub="first response" />
      </div>

      {/* Volume over time */}
      <Card padding="md">
        <SectionTitle>Ticket Volume Over Time</SectionTitle>
        {data.ticket_volume.by_day.length === 0 ? (
          <EmptyChart message="No tickets in this period." />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.ticket_volume.by_day}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip labelFormatter={(l) => `Date: ${String(l)}`} formatter={(v) => [String(v), 'Tickets']} />
                <Bar dataKey="count" fill="#2563EB" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Status + Priority pie charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card padding="md">
          <SectionTitle>Tickets by Status</SectionTitle>
          {statusData.length === 0 ? <EmptyChart message="No data." /> : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                    label={({ name, value }: { name?: string; value?: number }) => `${name}: ${value}`}>
                    {statusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card padding="md">
          <SectionTitle>Tickets by Priority</SectionTitle>
          {priorityData.length === 0 ? <EmptyChart message="No data." /> : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={priorityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                    label={({ name, value }: { name?: string; value?: number }) => `${name}: ${value}`}>
                    {priorityData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Team Tab
// ---------------------------------------------------------------------------
function TeamTab({ data }: { data: TeamMetrics }) {
  if (data.agents.length === 0) {
    return <Card padding="lg"><p className="text-sm text-text-secondary text-center">No agent data available.</p></Card>;
  }

  return (
    <div className="space-y-6">
      <Card padding="none">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary">Agent Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-alt">
                <th className="px-4 py-2 text-left font-medium text-text-secondary">Agent</th>
                <th className="px-4 py-2 text-right font-medium text-text-secondary">Tickets</th>
                <th className="px-4 py-2 text-right font-medium text-text-secondary">Avg First Response</th>
                <th className="px-4 py-2 text-right font-medium text-text-secondary">Avg Resolution</th>
                <th className="px-4 py-2 text-right font-medium text-text-secondary">SLA (1st resp)</th>
                <th className="px-4 py-2 text-right font-medium text-text-secondary">SLA (res)</th>
                <th className="px-4 py-2 text-right font-medium text-text-secondary">CSAT</th>
              </tr>
            </thead>
            <tbody>
              {data.agents.map((agent) => (
                <tr key={agent.agent_id} className="border-b border-border last:border-0 hover:bg-surface-alt transition-colors">
                  <td className="px-4 py-3 font-medium text-text-primary">{agent.agent_name}</td>
                  <td className="px-4 py-3 text-right text-text-primary">{agent.tickets_handled}</td>
                  <td className="px-4 py-3 text-right text-text-secondary">{formatMinutes(agent.avg_first_response_minutes)}</td>
                  <td className="px-4 py-3 text-right text-text-secondary">{formatMinutes(agent.avg_resolution_minutes)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={agent.sla_first_response_rate >= 0.8 ? 'text-success font-medium' : 'text-danger font-medium'}>
                      {agent.sla_first_response_rate > 0 ? `${Math.round(agent.sla_first_response_rate * 100)}%` : '--'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={agent.sla_resolution_rate >= 0.8 ? 'text-success font-medium' : 'text-danger font-medium'}>
                      {agent.sla_resolution_rate > 0 ? `${Math.round(agent.sla_resolution_rate * 100)}%` : '--'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-text-primary">{agent.csat_average > 0 ? agent.csat_average.toFixed(1) : '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Open tickets by agent bar chart */}
      <Card padding="md">
        <SectionTitle>Tickets Handled by Agent</SectionTitle>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.agents} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="agent_name" tick={{ fontSize: 11 }} width={120} />
              <Tooltip formatter={(v) => [String(v), 'Tickets']} />
              <Bar dataKey="tickets_handled" fill="#2563EB" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SLA Tab
// ---------------------------------------------------------------------------
function SLATab({ data }: { data: DashboardMetrics }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Card padding="md">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">First Response SLA</p>
          <p className="text-3xl font-bold text-text-primary mt-1">{Math.round(data.sla_compliance.first_response_rate * 100)}%</p>
          <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round(data.sla_compliance.first_response_rate * 100)}%` }} />
          </div>
        </Card>
        <Card padding="md">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Resolution SLA</p>
          <p className="text-3xl font-bold text-text-primary mt-1">{Math.round(data.sla_compliance.resolution_rate * 100)}%</p>
          <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-success rounded-full" style={{ width: `${Math.round(data.sla_compliance.resolution_rate * 100)}%` }} />
          </div>
        </Card>
      </div>

      <Card padding="md">
        <SectionTitle>SLA Compliance Over Time</SectionTitle>
        {data.sla_by_day.length === 0 ? <EmptyChart message="No SLA data in this period." /> : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.sla_by_day}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} domain={[0, 1]} />
                <Tooltip formatter={(v) => [`${Math.round(Number(v) * 100)}%`]} />
                <Legend />
                <Line type="monotone" dataKey="first_response_rate" name="First Response" stroke="#2563EB" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="resolution_rate" name="Resolution" stroke="#16A34A" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSAT Tab
// ---------------------------------------------------------------------------
function CSATTab({ data }: { data: DashboardMetrics }) {
  const distData = [1, 2, 3, 4, 5].map((score) => ({
    score: `⭐ ${score}`,
    count: data.csat_distribution.find((d) => d.score === score)?.count ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Avg CSAT Score" value={data.csat.average_score > 0 ? data.csat.average_score.toFixed(1) : '--'} sub="out of 5" />
        <StatCard label="Responses" value={data.csat.response_count} />
        <StatCard label="Response Rate" value={`${Math.round(data.csat.response_rate * 100)}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card padding="md">
          <SectionTitle>Score Distribution</SectionTitle>
          {data.csat_distribution.length === 0 ? <EmptyChart message="No CSAT responses yet." /> : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="score" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [String(v), 'Responses']} />
                  <Bar dataKey="count" fill="#F59E0B" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card padding="md">
          <SectionTitle>CSAT Trend Over Time</SectionTitle>
          {data.csat.by_day.length === 0 ? <EmptyChart message="No CSAT data in this period." /> : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.csat.by_day}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 5]} />
                  <Tooltip formatter={(v) => [Number(v).toFixed(1), 'Avg Score']} />
                  <Line type="monotone" dataKey="average" name="CSAT" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [periodDays, setPeriodDays] = useState(30);

  const { from, to } = getDateRange(periodDays);
  const { data, isLoading, error } = useReportsDashboard(from, to);
  const { data: teamData, isLoading: teamLoading } = useReportsTeam(from, to);

  const isTeamTab = activeTab === 'Team';
  const loading = isTeamTab ? teamLoading : isLoading;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Reports</h1>
          <p className="text-sm text-text-secondary mt-1">{from} — {to}</p>
        </div>
        <div className="flex gap-2">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              onClick={() => setPeriodDays(opt.days)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                periodDays === opt.days
                  ? 'bg-primary text-white'
                  : 'bg-surface border border-border text-text-secondary hover:border-primary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner size="lg" label="Loading reports" />
        </div>
      ) : error ? (
        <Card padding="lg">
          <p className="text-sm text-danger text-center">Failed to load report data. Please try again.</p>
        </Card>
      ) : (
        <>
          {activeTab === 'Overview' && data && <OverviewTab data={data} />}
          {activeTab === 'Team' && teamData && <TeamTab data={teamData} />}
          {activeTab === 'SLA' && data && <SLATab data={data} />}
          {activeTab === 'CSAT' && data && <CSATTab data={data} />}
        </>
      )}
    </div>
  );
}
