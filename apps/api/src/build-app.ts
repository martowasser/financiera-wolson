import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';

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

export async function buildApp() {
  const server = Fastify({ logger: false });

  server.addHook('preSerialization', async (_request, _reply, payload) => {
    return JSON.parse(JSON.stringify(payload, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));
  });

  await server.register(cookie);
  await server.register(cors, { origin: true, credentials: true });

  server.setErrorHandler(errorHandler);

  await server.register(authRoutes,       { prefix: '/api/auth' });
  await server.register(cuentaRoutes,     { prefix: '/api/cuentas' });
  await server.register(sociedadRoutes,   { prefix: '/api/sociedades' });
  await server.register(bancoRoutes,      { prefix: '/api/bancos' });
  await server.register(propiedadRoutes,  { prefix: '/api/propiedades' });
  await server.register(alquilerRoutes,   { prefix: '/api/alquileres' });
  await server.register(cajaRoutes,       { prefix: '/api/caja' });
  await server.register(movimientoRoutes, { prefix: '/api/movimientos' });
  await server.register(reportingRoutes,  { prefix: '/api/reports' });

  await server.ready();
  return server;
}
