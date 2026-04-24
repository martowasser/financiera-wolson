import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../lib/auth-middleware.js';
import * as service from './service.js';
import {
  createMovimientoSchema,
  updateMovimientoSchema,
  reversarSchema,
  listMovimientosQuerySchema,
} from './schemas.js';
import { z } from 'zod';

const idParam = z.object({ id: z.string() });

export default async function movimientoRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request) => {
    const query = listMovimientosQuerySchema.parse(request.query);
    return service.listMovimientos(query);
  });

  fastify.get('/by-numero/:numero', async (request) => {
    const { numero } = z.object({ numero: z.coerce.number().int() }).parse(request.params);
    return service.getMovimientoByNumero(numero);
  });

  fastify.get('/:id', async (request) => {
    const { id } = idParam.parse(request.params);
    return service.getMovimiento(id);
  });

  fastify.post('/', async (request, reply) => {
    const body = createMovimientoSchema.parse(request.body);
    const created = await service.createMovimiento(body, request.user.userId);
    return reply.status(201).send(created);
  });

  fastify.put('/:id', async (request) => {
    const { id } = idParam.parse(request.params);
    const body = updateMovimientoSchema.parse(request.body);
    return service.updateMovimiento(id, body);
  });

  fastify.post('/:id/reversar', async (request, reply) => {
    const { id } = idParam.parse(request.params);
    const { motivo } = reversarSchema.parse(request.body);
    const reverso = await service.reversarMovimiento(id, motivo, request.user.userId);
    return reply.status(201).send(reverso);
  });
}
