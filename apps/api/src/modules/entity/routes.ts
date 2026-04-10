import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as entityService from './service.js';
import { authenticate, requireRole } from '../../lib/auth-middleware.js';

const createEntitySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['COMPANY', 'PERSON', 'FIRM', 'THIRD_PARTY']),
  taxId: z.string().optional(),
  notes: z.string().optional(),
});

const updateEntitySchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['COMPANY', 'PERSON', 'FIRM', 'THIRD_PARTY']).optional(),
  taxId: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

const listQuerySchema = z.object({
  type: z.enum(['COMPANY', 'PERSON', 'FIRM', 'THIRD_PARTY']).optional(),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

export default async function entityRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  // GET / — list entities (all roles)
  fastify.get('/', async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const entities = await entityService.list(query);
    return entities;
  });

  // GET /:id — get entity by id (all roles)
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const entity = await entityService.getById(request.params.id);
    return entity;
  });

  // POST / — create entity (OPERATOR, ADMIN)
  fastify.post('/', {
    preHandler: [requireRole('OPERATOR', 'ADMIN')],
  }, async (request, reply) => {
    const body = createEntitySchema.parse(request.body);
    const entity = await entityService.create(body);
    return reply.status(201).send(entity);
  });

  // PUT /:id — update entity (OPERATOR, ADMIN)
  fastify.put<{ Params: { id: string } }>('/:id', {
    preHandler: [requireRole('OPERATOR', 'ADMIN')],
  }, async (request, reply) => {
    const body = updateEntitySchema.parse(request.body);
    const entity = await entityService.update(request.params.id, body);
    return entity;
  });

  // DELETE /:id — soft delete entity (ADMIN only)
  fastify.delete<{ Params: { id: string } }>('/:id', {
    preHandler: [requireRole('ADMIN')],
  }, async (request, reply) => {
    await entityService.softDelete(request.params.id);
    return { message: 'Entity deleted' };
  });
}
