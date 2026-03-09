import type { FastifyInstance } from 'fastify';
import { submitCSATSchema } from '@busybirdies/shared';
import * as csatService from '../services/csat.service.js';

/**
 * Register all CSAT survey-related routes.
 * These are public routes (no authentication required) accessed via unique tokens.
 */
export async function csatRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /v1/csat/:token
   * Get survey metadata for rendering the survey page.
   * Public endpoint, token-based access.
   */
  app.get(
    '/csat/:token',
    async (request, reply) => {
      const { token } = request.params as { token: string };
      const surveyData = await csatService.getSurvey(token);

      return reply.status(200).send(surveyData);
    },
  );

  /**
   * POST /v1/csat/:token
   * Submit a CSAT survey response (rating 1-5 + optional comment).
   * Public endpoint, token-based access.
   */
  app.post(
    '/csat/:token',
    async (request, reply) => {
      const { token } = request.params as { token: string };
      const body = submitCSATSchema.parse(request.body);
      const result = await csatService.submitSurvey(
        token,
        body.rating,
        body.comment,
      );

      return reply.status(200).send(result);
    },
  );
}
