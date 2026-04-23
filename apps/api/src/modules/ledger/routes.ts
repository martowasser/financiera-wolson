import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as ledgerService from './service.js';
import { authenticate, requireRole } from '../../lib/auth-middleware.js';

const entrySchema = z.object({
  accountId: z.string().min(1),
  type: z.enum(['DEBIT', 'CREDIT']),
  amount: z.string().min(1),
  description: z.string().nullish(),
});

const createTransactionSchema = z.object({
  periodId: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER', 'BANK_FEE', 'ADJUSTMENT']),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CHECK']).nullish(),
  checkNumber: z.string().nullish(),
  bankReference: z.string().nullish(),
  invoiceId: z.string().nullish(),
  sociedadId: z.string().nullish(),
  notes: z.string().nullish(),
  idempotencyKey: z.string().nullish(),
  entries: z.array(entrySchema).min(1),
});

const reverseTransactionSchema = z.object({
  reason: z.string().min(1),
});

export default async function ledgerRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  // GET / — list transactions (all roles)
  fastify.get('/', async (request) => {
    const query = request.query as Record<string, string | undefined>;
    return ledgerService.list({
      periodId: query.periodId,
      type: query.type,
      status: query.status,
      search: query.search,
    });
  });

  // GET /:id — get transaction (all roles)
  fastify.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    return ledgerService.getById(id);
  });

  // POST / — create transaction (OPERATOR, ADMIN)
  fastify.post('/', {
    preHandler: [requireRole('OPERATOR', 'ADMIN')],
  }, async (request, reply) => {
    const body = createTransactionSchema.parse(request.body);

    // Convert entry amounts from string to BigInt
    const entries = body.entries.map((e) => ({
      accountId: e.accountId,
      type: e.type,
      amount: BigInt(e.amount),
      description: e.description,
    }));

    const transaction = await ledgerService.createTransaction({
      periodId: body.periodId,
      description: body.description,
      type: body.type,
      paymentMethod: body.paymentMethod,
      checkNumber: body.checkNumber,
      bankReference: body.bankReference,
      invoiceId: body.invoiceId,
      sociedadId: body.sociedadId,
      notes: body.notes,
      idempotencyKey: body.idempotencyKey,
      entries,
      createdById: request.user.userId,
    });

    return reply.status(201).send(transaction);
  });

  // POST /:id/reverse — reverse transaction (OPERATOR, ADMIN)
  fastify.post('/:id/reverse', {
    preHandler: [requireRole('OPERATOR', 'ADMIN')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = reverseTransactionSchema.parse(request.body);
    const reversal = await ledgerService.reverseTransaction(
      id,
      request.user.userId,
      body.reason,
    );
    return reply.status(201).send(reversal);
  });
}
