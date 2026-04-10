import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as ownershipService from './service.js';
import { authenticate, requireRole } from '../../lib/auth-middleware.js';

const createOwnershipSchema = z.object({
  entityId: z.string().min(1),
  ownerId: z.string().min(1),
  percentage: z.number().int().min(1).max(10000),
});

const updateOwnershipSchema = z.object({
  percentage: z.number().int().min(1).max(10000).optional(),
});

export default async function ownershipRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  // GET /entity/:entityId — list ownerships for entity (all roles)
  fastify.get<{ Params: { entityId: string } }>('/entity/:entityId', async (request, reply) => {
    const ownerships = await ownershipService.listByEntity(request.params.entityId);
    return ownerships;
  });

  // GET /entity/:entityId/validate — check if active ownerships sum to 10000
  fastify.get<{ Params: { entityId: string } }>('/entity/:entityId/validate', async (request, reply) => {
    const result = await ownershipService.validateOwnershipSum(request.params.entityId);
    return result;
  });

  // POST / — create ownership (OPERATOR, ADMIN)
  fastify.post('/', {
    preHandler: [requireRole('OPERATOR', 'ADMIN')],
  }, async (request, reply) => {
    const body = createOwnershipSchema.parse(request.body);
    const ownership = await ownershipService.create(body);
    return reply.status(201).send(ownership);
  });

  // PUT /:id — update ownership (OPERATOR, ADMIN)
  fastify.put<{ Params: { id: string } }>('/:id', {
    preHandler: [requireRole('OPERATOR', 'ADMIN')],
  }, async (request, reply) => {
    const body = updateOwnershipSchema.parse(request.body);
    const ownership = await ownershipService.update(request.params.id, body);
    return ownership;
  });

  // DELETE /:id — deactivate ownership (OPERATOR, ADMIN)
  fastify.delete<{ Params: { id: string } }>('/:id', {
    preHandler: [requireRole('OPERATOR', 'ADMIN')],
  }, async (request, reply) => {
    const ownership = await ownershipService.deactivate(request.params.id);
    return ownership;
  });
}
