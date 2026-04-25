import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import prisma from './lib/prisma.js';
import { errorHandler } from './lib/errors.js';
import authRoutes from './modules/auth/routes.js';
import cuentaRoutes from './modules/cuenta/routes.js';
import sociedadRoutes from './modules/sociedad/routes.js';
import bancoRoutes from './modules/banco/routes.js';
import propiedadRoutes from './modules/propiedad/routes.js';
import alquilerRoutes from './modules/alquiler/routes.js';
import cajaRoutes from './modules/caja/routes.js';
import movimientoRoutes from './modules/movimiento/routes.js';
import reportingRoutes from './modules/reporting/routes.js';

const server = Fastify({
  logger: true,
  serializerOpts: { ajv: { allowUnionTypes: true } },
});

server.addHook('preSerialization', async (_request, _reply, payload) => {
  return JSON.parse(JSON.stringify(payload, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
});

await server.register(cors, {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
});

await server.register(helmet);

await server.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

server.get('/health', async (request, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', timestamp: new Date().toISOString() };
  } catch (error) {
    request.log.error(error, 'Health check failed');
    return reply.status(503).send({
      status: 'error',
      timestamp: new Date().toISOString(),
    });
  }
});

await server.register(authRoutes,       { prefix: '/api/auth' });
await server.register(cuentaRoutes,     { prefix: '/api/cuentas' });
await server.register(sociedadRoutes,   { prefix: '/api/sociedades' });
await server.register(bancoRoutes,      { prefix: '/api/bancos' });
await server.register(propiedadRoutes,  { prefix: '/api/propiedades' });
await server.register(alquilerRoutes,   { prefix: '/api/alquileres' });
await server.register(cajaRoutes,       { prefix: '/api/caja' });
await server.register(movimientoRoutes, { prefix: '/api/movimientos' });
await server.register(reportingRoutes,  { prefix: '/api/reports' });

server.setErrorHandler(errorHandler);

const port = Number(process.env.PORT) || 3001;
try {
  await server.listen({ port, host: '0.0.0.0' });
  server.log.info(`Server listening on http://0.0.0.0:${port}`);
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
