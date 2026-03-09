import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { heartbeatSchema } from '@supportdesk/shared';
import * as collisionService from '../services/collision.service.js';
import { getDb } from '../db/connection.js';
import { users } from '../db/schema.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { tenantScope } from '../middleware/tenant.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { getLogger } from '../lib/logger.js';

/** Schema for validating the ticket ID path parameter. */
const ticketIdParamSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

/**
 * Register all collision-detection routes under the /tickets/:id prefix.
 * These endpoints manage real-time awareness of which agents are viewing a ticket.
 */
export async function collisionRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /v1/tickets/:id/heartbeat
   * Send a heartbeat to indicate the current user is viewing a ticket.
   * Returns the list of other agents currently viewing the same ticket.
   * Called every 10 seconds by the frontend.
   * Auth: Admin, Agent only.
   */
  app.post(
    '/tickets/:id/heartbeat',
    { preHandler: [authenticate, tenantScope] },
    async (request, reply) => {
      const logger = getLogger();
      const { id: ticketId } = ticketIdParamSchema.parse(request.params);
      const body = heartbeatSchema.parse(request.body);
      const user = request.user!;

      // Look up the user's full name for display to other viewers
      let fullName = 'Unknown';
      try {
        const db = getDb();
        const [userRow] = await db
          .select({ fullName: users.fullName })
          .from(users)
          .where(and(eq(users.id, user.id), eq(users.tenantId, request.tenantId!)))
          .limit(1);

        if (userRow) {
          fullName = userRow.fullName;
        }
      } catch (err) {
        logger.error({ err, userId: user.id }, 'Failed to look up user for heartbeat');
      }

      const otherViewers = collisionService.recordHeartbeat(
        ticketId,
        user.id,
        fullName,
        body.is_composing,
      );

      return reply.status(200).send({ other_viewers: otherViewers });
    },
  );
}
