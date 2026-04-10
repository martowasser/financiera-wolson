import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as accountService from './service.js';
import { authenticate, requireRole } from '../../lib/auth-middleware.js';

const createAccountSchema = z.object({
  entityId: z.string().min(1),
  name: z.string().min(1),
  path: z.string().min(1),
  type: z.enum(['CASH', 'BANK', 'RECEIVABLE', 'PAYABLE', 'EQUITY', 'REVENUE', 'EXPENSE']),
  currency: z.enum(['ARS', 'USD']),
  normalBalance: z.enum(['DEBIT', 'CREDIT']),
  bankName: z.string().nullish(),
  bankAccountNum: z.string().nullish(),
});

const updateAccountSchema = z.object({
  name: z.string().min(1).optional(),
  bankName: z.string().nullish(),
  bankAccountNum: z.string().nullish(),
  isActive: z.boolean().optional(),
});

export default async function accountRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  // GET / — list accounts (all roles)
  fastify.get('/', async (request) => {
    const query = request.query as Record<string, string | undefined>;
    return accountService.list({
      entityId: query.entityId,
      type: query.type,
      currency: query.currency,
      search: query.search,
    });
  });

  // GET /:id — get account with balance (all roles)
  fastify.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const account = await accountService.getById(id);
    const balance = await accountService.getBalance(id);
    return { ...account, ...balance };
  });

  // GET /:id/balance — get balance details (all roles)
  fastify.get('/:id/balance', async (request) => {
    const { id } = request.params as { id: string };
    return accountService.getBalance(id);
  });

  // GET /hierarchy/:pathPrefix — get accounts under path prefix (all roles)
  fastify.get('/hierarchy/:pathPrefix', async (request) => {
    const { pathPrefix } = request.params as { pathPrefix: string };
    const decoded = decodeURIComponent(pathPrefix);
    return accountService.getByPath(decoded);
  });

  // POST / — create account (OPERATOR, ADMIN)
  fastify.post('/', {
    preHandler: [requireRole('OPERATOR', 'ADMIN')],
  }, async (request, reply) => {
    const body = createAccountSchema.parse(request.body);
    const account = await accountService.create(body);
    return reply.status(201).send(account);
  });

  // PUT /:id — update account (OPERATOR, ADMIN)
  fastify.put('/:id', {
    preHandler: [requireRole('OPERATOR', 'ADMIN')],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = updateAccountSchema.parse(request.body);
    return accountService.update(id, body);
  });

  // DELETE /:id — soft delete account (ADMIN)
  fastify.delete('/:id', {
    preHandler: [requireRole('ADMIN')],
  }, async (request) => {
    const { id } = request.params as { id: string };
    return accountService.softDelete(id);
  });
}
