import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../lib/auth-middleware.js';
import * as service from './service.js';
import {
  createPropiedadSchema,
  updatePropiedadSchema,
  listPropiedadesQuerySchema,
} from './schemas.js';
import { z } from 'zod';

export default async function propiedadRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request) => {
    const query = listPropiedadesQuerySchema.parse(request.query);
    return service.listPropiedades(query);
  });

  fastify.get('/:id', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return service.getPropiedad(id);
  });

  fastify.post('/', async (request, reply) => {
    const body = createPropiedadSchema.parse(request.body);
    const propiedad = await service.createPropiedad(body);
    return reply.status(201).send(propiedad);
  });

  fastify.put('/:id', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = updatePropiedadSchema.parse(request.body);
    return service.updatePropiedad(id, body);
  });

  fastify.delete('/:id', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return service.deletePropiedad(id);
  });
}
