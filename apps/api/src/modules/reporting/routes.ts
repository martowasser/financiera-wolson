import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../lib/auth-middleware.js';
import { z } from 'zod';
import * as service from './service.js';

export default async function reportingRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/posicion', async () => {
    return service.getPosicion();
  });

  fastify.get('/alquileres', async () => {
    return service.getAlquileres();
  });

  fastify.get('/caja/:fecha/resumen', async (request) => {
    const { fecha } = z.object({ fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(request.params);
    return service.getCajaResumen(fecha);
  });
}
