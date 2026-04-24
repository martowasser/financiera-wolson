import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../lib/auth-middleware.js';
import * as service from './service.js';
import { createCuentaSchema, updateCuentaSchema, listCuentasQuerySchema } from './schemas.js';
import { z } from 'zod';

export default async function cuentaRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request) => {
    const query = listCuentasQuerySchema.parse(request.query);
    return service.listCuentas(query);
  });

  fastify.get('/:id', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return service.getCuenta(id);
  });

  fastify.post('/', async (request, reply) => {
    const body = createCuentaSchema.parse(request.body);
    const cuenta = await service.createCuenta(body);
    return reply.status(201).send(cuenta);
  });

  fastify.put('/:id', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = updateCuentaSchema.parse(request.body);
    return service.updateCuenta(id, body);
  });

  fastify.delete('/:id', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return service.deleteCuenta(id);
  });

  fastify.get('/:id/movimientos', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const query = z.object({
      from: z.string().optional(),
      to: z.string().optional(),
    }).parse(request.query);
    return service.getCuentaMovimientos(id, query);
  });
}
