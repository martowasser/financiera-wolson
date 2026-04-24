import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../lib/auth-middleware.js';
import * as service from './service.js';
import {
  createContratoSchema,
  updateContratoSchema,
  replaceContratoSociosSchema,
  finalizarContratoSchema,
  listContratosQuerySchema,
  numeroParamSchema,
} from './schemas.js';
import { z } from 'zod';

export default async function contratoRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request) => {
    const query = listContratosQuerySchema.parse(request.query);
    return service.listContratos(query);
  });

  fastify.get('/:id', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return service.getContrato(id);
  });

  fastify.get('/by-numero/:numero', async (request) => {
    const { numero } = numeroParamSchema.parse(request.params);
    return service.getContratoByNumero(numero);
  });

  fastify.post('/', async (request, reply) => {
    const body = createContratoSchema.parse(request.body);
    const contrato = await service.createContrato(body);
    return reply.status(201).send(contrato);
  });

  fastify.put('/:id', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = updateContratoSchema.parse(request.body);
    return service.updateContrato(id, body);
  });

  fastify.post('/:id/socios', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = replaceContratoSociosSchema.parse(request.body);
    return service.replaceContratoSocios(id, body);
  });

  fastify.post('/:id/finalizar', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = finalizarContratoSchema.parse(request.body);
    return service.finalizarContrato(id, body);
  });

  // Reactivar is an override of a closed contract — restrict to ADMIN to avoid operator mistakes.
  fastify.post(
    '/:id/reactivar',
    { preHandler: requireRole('ADMIN') },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      return service.reactivarContrato(id);
    },
  );

  fastify.delete('/:id', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return service.deleteContrato(id);
  });
}
