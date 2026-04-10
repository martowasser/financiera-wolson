import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as settlementService from './service.js';
import { authenticate, requireRole } from '../../lib/auth-middleware.js';

const listQuerySchema = z.object({
  entityId: z.string().optional(),
  status: z.enum(['DRAFT', 'APPROVED', 'DISTRIBUTED']).optional(),
});

const createSettlementSchema = z.object({
  entityId: z.string().min(1),
  periodFrom: z.coerce.date(),
  periodTo: z.coerce.date(),
  currency: z.enum(['ARS', 'USD']),
  notes: z.string().optional(),
});

export default async function settlementRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // GET / — list settlements (all roles)
  fastify.get('/', async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    return settlementService.list(query);
  });

  // GET /:id — get settlement by id (all roles)
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    return settlementService.getById(request.params.id);
  });

  // POST / — calculate/create settlement (OPERATOR, ADMIN)
  fastify.post('/', {
    preHandler: [requireRole('OPERATOR', 'ADMIN')],
  }, async (request, reply) => {
    const body = createSettlementSchema.parse(request.body);
    const settlement = await settlementService.calculate({
      ...body,
      createdById: request.user.userId,
    });
    return reply.status(201).send(settlement);
  });

  // POST /:id/approve — approve settlement (ADMIN only)
  fastify.post<{ Params: { id: string } }>('/:id/approve', {
    preHandler: [requireRole('ADMIN')],
  }, async (request, reply) => {
    return settlementService.approve(request.params.id);
  });
}
