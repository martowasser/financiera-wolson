import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../lib/auth-middleware.js';
import * as service from './service.js';
import { createBancoSchema, updateBancoSchema, listBancosQuerySchema } from './schemas.js';
import { z } from 'zod';

export default async function bancoRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request) => {
    const query = listBancosQuerySchema.parse(request.query);
    return service.listBancos(query);
  });

  fastify.get('/:id', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return service.getBanco(id);
  });

  fastify.post('/', async (request, reply) => {
    const body = createBancoSchema.parse(request.body);
    const banco = await service.createBanco(body);
    return reply.status(201).send(banco);
  });

  fastify.put('/:id', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = updateBancoSchema.parse(request.body);
    return service.updateBanco(id, body);
  });

  fastify.post('/:id/cerrar', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return service.cerrarBanco(id);
  });

  fastify.post('/:id/reabrir', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return service.reabrirBanco(id);
  });

  fastify.delete('/:id', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return service.deleteBanco(id);
  });

  fastify.post(
    '/:id/recalcular-saldo',
    { preHandler: requireRole('ADMIN') },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const banco = await service.recalcularSaldo(id);
      return { saldoArs: banco.saldoArs, saldoUsd: banco.saldoUsd };
    },
  );
}
