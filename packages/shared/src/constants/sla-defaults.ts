import type { TicketPriority } from './ticket-priority.js';

export interface SLADefault {
  priority: TicketPriority;
  firstResponseMinutes: number;
  resolutionMinutes: number;
}

export const SLA_DEFAULTS: SLADefault[] = [
  { priority: 'urgent', firstResponseMinutes: 30, resolutionMinutes: 240 },
  { priority: 'high', firstResponseMinutes: 60, resolutionMinutes: 480 },
  { priority: 'medium', firstResponseMinutes: 240, resolutionMinutes: 1440 },
  { priority: 'low', firstResponseMinutes: 480, resolutionMinutes: 2880 },
];
