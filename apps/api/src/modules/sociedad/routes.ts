import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../lib/auth-middleware.js';
import * as service from './service.js';
import {
  createSociedadSchema,
  updateSociedadSchema,
  replaceSociosSchema,
  listSociedadesQuerySchema,
} from './schemas.js';
import { z } from 'zod';

export default async function sociedadRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request) => {
    const query = listSociedadesQuerySchema.parse(request.query);
    return service.listSociedades(query);
  });

  fastify.get('/:id', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return service.getSociedad(id);
  });

  fastify.post('/', async (request, reply) => {
    const body = createSociedadSchema.parse(request.body);
    const sociedad = await service.createSociedad(body);
    return reply.status(201).send(sociedad);
  });

  fastify.put('/:id', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = updateSociedadSchema.parse(request.body);
    return service.updateSociedad(id, body);
  });

  fastify.post('/:id/socios', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = replaceSociosSchema.parse(request.body);
    return service.replaceSocios(id, body);
  });

  fastify.delete('/:id', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return service.deleteSociedad(id);
  });
}
