import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as leaseService from './service.js';
import { authenticate, requireRole } from '../../lib/auth-middleware.js';

const createLeaseSchema = z.object({
  propertyId: z.string().min(1),
  tenantId: z.string().min(1),
  currency: z.enum(['ARS', 'USD']),
  baseAmount: z.coerce.bigint(),
  managedBy: z.enum(['DIRECT', 'THIRD_PARTY']).optional(),
  thirdPartyEntityId: z.string().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

const updateLeaseSchema = z.object({
  currency: z.enum(['ARS', 'USD']).optional(),
  managedBy: z.enum(['DIRECT', 'THIRD_PARTY']).optional(),
  thirdPartyEntityId: z.string().nullable().optional(),
  endDate: z.coerce.date().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

const addPriceSchema = z.object({
  amount: z.coerce.bigint(),
  validFrom: z.coerce.date(),
});

const listQuerySchema = z.object({
  propertyId: z.string().optional(),
  tenantId: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

export default async function leaseRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // GET / — list leases (all roles)
  fastify.get('/', async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    return leaseService.list(query);
  });

  // GET /:id — get lease by id (all roles)
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    return leaseService.getById(request.params.id);
  });

  // POST / — create lease (OPERATOR, ADMIN)
  fastify.post('/', {
    preHandler: [requireRole('OPERATOR', 'ADMIN')],
  }, async (request, reply) => {
    const body = createLeaseSchema.parse(request.body);
    const lease = await leaseService.create(body);
    return reply.status(201).send(lease);
  });

  // PUT /:id — update lease (OPERATOR, ADMIN)
  fastify.put<{ Params: { id: string } }>('/:id', {
    preHandler: [requireRole('OPERATOR', 'ADMIN')],
  }, async (request, reply) => {
    const body = updateLeaseSchema.parse(request.body);
    return leaseService.update(request.params.id, body);
  });

  // POST /:id/prices — add price (OPERATOR, ADMIN)
  fastify.post<{ Params: { id: string } }>('/:id/prices', {
    preHandler: [requireRole('OPERATOR', 'ADMIN')],
  }, async (request, reply) => {
    const body = addPriceSchema.parse(request.body);
    const price = await leaseService.addPrice(request.params.id, body.amount, body.validFrom);
    return reply.status(201).send(price);
  });

  // DELETE /:id — soft delete lease (ADMIN only)
  fastify.delete<{ Params: { id: string } }>('/:id', {
    preHandler: [requireRole('ADMIN')],
  }, async (request, reply) => {
    await leaseService.softDelete(request.params.id);
    return { message: 'Lease deleted' };
  });
}
