import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as service from './service.js';
import { authenticate, requireRole } from '../../lib/auth-middleware.js';

const createSchema = z.object({
  sociedadId: z.string().min(1),
  accountId: z.string().min(1),
  percentBps: z.number().int().min(0).max(10000),
});

const updateSchema = z.object({
  percentBps: z.number().int().min(0).max(10000),
});

export default async function sociedadMemberRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get<{ Params: { sociedadId: string } }>('/sociedad/:sociedadId', async (request) => {
    return service.listBySociedad(request.params.sociedadId);
  });

  fastify.get<{ Params: { sociedadId: string } }>(
    '/sociedad/:sociedadId/validate',
    async (request) => {
      return service.validateSum(request.params.sociedadId);
    },
  );

  fastify.post('/', {
    preHandler: [requireRole('OPERATOR', 'ADMIN')],
  }, async (request, reply) => {
    const body = createSchema.parse(request.body);
    const member = await service.create(body);
    return reply.status(201).send(member);
  });

  fastify.put<{ Params: { id: string } }>('/:id', {
    preHandler: [requireRole('OPERATOR', 'ADMIN')],
  }, async (request) => {
    const body = updateSchema.parse(request.body);
    return service.update(request.params.id, body);
  });

  fastify.delete<{ Params: { id: string } }>('/:id', {
    preHandler: [requireRole('OPERATOR', 'ADMIN')],
  }, async (request) => {
    return service.remove(request.params.id);
  });
}
