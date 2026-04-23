import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as periodService from './service.js';
import { authenticate, requireRole } from '../../lib/auth-middleware.js';
import { nullishString } from '../../lib/zod-helpers.js';

const closePeriodSchema = z.object({
  closingNotes: nullishString,
});

export default async function periodRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  // GET / — list periods (all roles)
  fastify.get('/', async (request) => {
    const query = request.query as Record<string, string | undefined>;
    return periodService.list({
      status: query.status,
    });
  });

  // GET /today — get or create today's period (OPERATOR, ADMIN)
  fastify.get('/today', {
    preHandler: [requireRole('OPERATOR', 'ADMIN')],
  }, async () => {
    return periodService.getOrCreateToday();
  });

  // GET /:id — get period by id (all roles)
  fastify.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    return periodService.getById(id);
  });

  // POST /:id/close — close period (OPERATOR, ADMIN)
  fastify.post('/:id/close', {
    preHandler: [requireRole('OPERATOR', 'ADMIN')],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = closePeriodSchema.parse(request.body);
    return periodService.close(id, request.user.userId, body.closingNotes);
  });
}
