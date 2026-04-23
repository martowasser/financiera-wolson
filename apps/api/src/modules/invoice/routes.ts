import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as invoiceService from './service.js';
import { authenticate, requireRole } from '../../lib/auth-middleware.js';
import { nullishString } from '../../lib/zod-helpers.js';

const listQuerySchema = z.object({
  leaseId: nullishString,
  status: z.enum(['PENDING', 'PAID', 'PARTIAL', 'CANCELLED']).optional(),
  periodMonth: z.coerce.number().int().min(1).max(12).optional(),
  periodYear: z.coerce.number().int().optional(),
});

const createInvoiceSchema = z.object({
  leaseId: z.string().min(1),
  periodMonth: z.number().int().min(1).max(12),
  periodYear: z.number().int(),
  baseAmount: z.coerce.bigint(),
  vatAmount: z.coerce.bigint().optional(),
  retentions: z.array(z.object({
    concept: z.string().min(1),
    amount: z.coerce.bigint(),
    notes: nullishString,
  })).optional(),
  notes: nullishString,
});

const collectSchema = z.object({
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CHECK']),
  checkNumber: nullishString,
  bankReference: nullishString,
  debitAccountId: z.string().min(1),
  creditAccountId: z.string().min(1),
  notes: nullishString,
});

export default async function invoiceRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // GET / — list invoices (all roles)
  fastify.get('/', async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    return invoiceService.list(query);
  });

  // GET /:id — get invoice by id (all roles)
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    return invoiceService.getById(request.params.id);
  });

  // POST / — create invoice (OPERATOR, ADMIN)
  fastify.post('/', {
    preHandler: [requireRole('OPERATOR', 'ADMIN')],
  }, async (request, reply) => {
    const body = createInvoiceSchema.parse(request.body);
    const invoice = await invoiceService.create(body);
    return reply.status(201).send(invoice);
  });

  // POST /:id/collect — collect payment (OPERATOR, ADMIN)
  fastify.post<{ Params: { id: string } }>('/:id/collect', {
    preHandler: [requireRole('OPERATOR', 'ADMIN')],
  }, async (request, reply) => {
    const body = collectSchema.parse(request.body);
    const invoice = await invoiceService.collect(
      request.params.id,
      request.user.userId,
      body,
    );
    return invoice;
  });
}
