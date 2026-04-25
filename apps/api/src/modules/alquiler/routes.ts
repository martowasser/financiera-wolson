import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../lib/auth-middleware.js';
import * as service from './service.js';
import {
  createAlquilerSchema,
  updateAlquilerSchema,
  replaceAlquilerSociosSchema,
  finalizarAlquilerSchema,
  listAlquileresQuerySchema,
  numeroParamSchema,
} from './schemas.js';
import { z } from 'zod';

export default async function alquilerRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request) => {
    const query = listAlquileresQuerySchema.parse(request.query);
    return service.listAlquileres(query);
  });

  fastify.get('/:id', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return service.getAlquiler(id);
  });

  fastify.get('/by-numero/:numero', async (request) => {
    const { numero } = numeroParamSchema.parse(request.params);
    return service.getAlquilerByNumero(numero);
  });

  fastify.post('/', async (request, reply) => {
    const body = createAlquilerSchema.parse(request.body);
    const alquiler = await service.createAlquiler(body);
    return reply.status(201).send(alquiler);
  });

  fastify.put('/:id', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = updateAlquilerSchema.parse(request.body);
    return service.updateAlquiler(id, body);
  });

  fastify.post('/:id/socios', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = replaceAlquilerSociosSchema.parse(request.body);
    return service.replaceAlquilerSocios(id, body);
  });

  fastify.post('/:id/finalizar', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = finalizarAlquilerSchema.parse(request.body);
    return service.finalizarAlquiler(id, body);
  });

  // Reactivar is an override of a closed alquiler — restrict to ADMIN to avoid operator mistakes.
  fastify.post(
    '/:id/reactivar',
    { preHandler: requireRole('ADMIN') },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      return service.reactivarAlquiler(id);
    },
  );

  fastify.delete('/:id', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return service.deleteAlquiler(id);
  });
}
