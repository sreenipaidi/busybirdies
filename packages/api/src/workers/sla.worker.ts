import { getLogger } from '../lib/logger.js';
import { findBreachingTickets } from '../services/sla.service.js';

/**
 * SLA breach detection worker.
 * Checks for tickets approaching or past their SLA deadlines.
 * Logs breach alerts; in future, this would trigger email notifications.
 *
 * Designed to be called periodically (every 5 minutes) via BullMQ repeatable job.
 */
export async function checkSLABreaches(): Promise<void> {
  const logger = getLogger();

  try {
    logger.info('SLA breach check: starting');

    const breachingTickets = await findBreachingTickets();

    if (breachingTickets.length === 0) {
      logger.info('SLA breach check: no breaches detected');
      return;
    }

    for (const ticket of breachingTickets) {
      logger.warn(
        {
          ticketId: ticket.ticketId,
          tenantId: ticket.tenantId,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          assignedAgentId: ticket.assignedAgentId,
          breachType: ticket.breachType,
          slaFirstResponseDue: ticket.slaFirstResponseDue?.toISOString() ?? null,
          slaResolutionDue: ticket.slaResolutionDue?.toISOString() ?? null,
        },
        `SLA breach alert: ${ticket.breachType} for ticket ${ticket.ticketNumber}`,
      );

      // TODO: Send email notification to assigned agent and team lead
      // For now, we just log the breach. Future implementation would:
      // 1. Queue a breach notification email
      // 2. Mark the breach as notified to avoid duplicate alerts
    }

    logger.info(
      { count: breachingTickets.length },
      'SLA breach check: completed',
    );
  } catch (error) {
    logger.error({ err: error }, 'SLA breach check: failed');
  }
}
