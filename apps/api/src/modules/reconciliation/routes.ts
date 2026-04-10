import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as reconciliationService from './service.js';
import { authenticate, requireRole } from '../../lib/auth-middleware.js';

const listQuerySchema = z.object({
  accountId: z.string().optional(),
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'DISCREPANCY']).optional(),
});

const createReconciliationSchema = z.object({
  accountId: z.string().min(1),
  date: z.coerce.date(),
  bankBalance: z.coerce.bigint(),
  notes: z.string().optional(),
});

const addItemSchema = z.object({
  description: z.string().min(1),
  bankAmount: z.coerce.bigint(),
  externalRef: z.string().optional(),
  importedFrom: z.string().optional(),
  notes: z.string().optional(),
});

const matchItemSchema = z.object({
  transactionId: z.string().min(1),
});

const globalizeSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1),
  groupLabel: z.string().min(1),
});

export default async function reconciliationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // GET / — list reconciliations (all roles)
  fastify.get('/', async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    return reconciliationService.list(query);
  });

  // GET /:id — get reconciliation by id (all roles)
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    return reconciliationService.getById(request.params.id);
  });

  // POST / — create reconciliation (OPERATOR, ADMIN)
  fastify.post('/', {
    preHandler: [requireRole('OPERATOR', 'ADMIN')],
  }, async (request, reply) => {
    const body = createReconciliationSchema.parse(request.body);
    const reconciliation = await reconciliationService.create(body);
    return reply.status(201).send(reconciliation);
  });

  // POST /:id/items — add item (OPERATOR, ADMIN)
  fastify.post<{ Params: { id: string } }>('/:id/items', {
    preHandler: [requireRole('OPERATOR', 'ADMIN')],
  }, async (request, reply) => {
    const body = addItemSchema.parse(request.body);
    const item = await reconciliationService.addItem(request.params.id, body);
    return reply.status(201).send(item);
  });

  // POST /items/:itemId/match — match item to transaction (OPERATOR, ADMIN)
  fastify.post<{ Params: { itemId: string } }>('/items/:itemId/match', {
    preHandler: [requireRole('OPERATOR', 'ADMIN')],
  }, async (request, reply) => {
    const body = matchItemSchema.parse(request.body);
    return reconciliationService.matchItem(request.params.itemId, body.transactionId);
  });

  // POST /:id/globalize — globalize items (OPERATOR, ADMIN)
  fastify.post<{ Params: { id: string } }>('/:id/globalize', {
    preHandler: [requireRole('OPERATOR', 'ADMIN')],
  }, async (request, reply) => {
    const body = globalizeSchema.parse(request.body);
    return reconciliationService.globalizeItems(body.itemIds, body.groupLabel);
  });

  // POST /:id/complete — complete reconciliation (OPERATOR, ADMIN)
  fastify.post<{ Params: { id: string } }>('/:id/complete', {
    preHandler: [requireRole('OPERATOR', 'ADMIN')],
  }, async (request, reply) => {
    return reconciliationService.complete(request.params.id);
  });
}
