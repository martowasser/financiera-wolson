import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../lib/auth-middleware.js';
import * as service from './service.js';
import { cerrarCajaSchema, fechaParamSchema, listCajasQuerySchema } from './schemas.js';
import { z } from 'zod';

export default async function cajaRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/today', async () => {
    return service.getOrCreateToday();
  });

  fastify.get('/', async (request) => {
    const query = listCajasQuerySchema.parse(request.query);
    return service.listCajas(query);
  });

  // Registered after `/today` and `/` so Fastify matches the literal routes
  // first (radix tree handles this, but keep ordering for readability).
  fastify.get('/:fecha', async (request) => {
    const { fecha } = z.object({ fecha: fechaParamSchema }).parse(request.params);
    return service.getByFecha(fecha);
  });

  fastify.post('/:id/cerrar', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = cerrarCajaSchema.parse(request.body ?? {});
    return service.cerrarCaja(id, body, request.user.userId);
  });

  fastify.post(
    '/:id/reabrir',
    { preHandler: requireRole('ADMIN') },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      return service.reabrirCaja(id);
    },
  );
}
