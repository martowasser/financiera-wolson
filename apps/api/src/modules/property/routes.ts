import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as propertyService from './service.js';
import { authenticate, requireRole } from '../../lib/auth-middleware.js';
import { nullishString } from '../../lib/zod-helpers.js';

const createPropertySchema = z.object({
  entityId: z.string().min(1),
  name: z.string().min(1),
  address: nullishString,
  type: z.enum(['APARTMENT', 'COMMERCIAL', 'OFFICE', 'PARKING', 'WAREHOUSE', 'LAND', 'OTHER']).optional(),
  notes: nullishString,
});

const updatePropertySchema = z.object({
  name: z.string().min(1).optional(),
  address: nullishString,
  type: z.enum(['APARTMENT', 'COMMERCIAL', 'OFFICE', 'PARKING', 'WAREHOUSE', 'LAND', 'OTHER']).optional(),
  notes: nullishString,
  isActive: z.boolean().optional(),
});

const listQuerySchema = z.object({
  entityId: nullishString,
  type: z.enum(['APARTMENT', 'COMMERCIAL', 'OFFICE', 'PARKING', 'WAREHOUSE', 'LAND', 'OTHER']).optional(),
  search: nullishString,
  isActive: z.coerce.boolean().optional(),
});

export default async function propertyRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // GET / — list properties (all roles)
  fastify.get('/', async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    return propertyService.list(query);
  });

  // GET /:id — get property by id (all roles)
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    return propertyService.getById(request.params.id);
  });

  // POST / — create property (OPERATOR, ADMIN)
  fastify.post('/', {
    preHandler: [requireRole('OPERATOR', 'ADMIN')],
  }, async (request, reply) => {
    const body = createPropertySchema.parse(request.body);
    const property = await propertyService.create(body);
    return reply.status(201).send(property);
  });

  // PUT /:id — update property (OPERATOR, ADMIN)
  fastify.put<{ Params: { id: string } }>('/:id', {
    preHandler: [requireRole('OPERATOR', 'ADMIN')],
  }, async (request, reply) => {
    const body = updatePropertySchema.parse(request.body);
    return propertyService.update(request.params.id, body);
  });

  // DELETE /:id — soft delete property (ADMIN only)
  fastify.delete<{ Params: { id: string } }>('/:id', {
    preHandler: [requireRole('ADMIN')],
  }, async (request, reply) => {
    await propertyService.softDelete(request.params.id);
    return { message: 'Property deleted' };
  });
}
