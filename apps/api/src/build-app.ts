import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';

import { errorHandler } from './lib/errors.js';
import authRoutes from './modules/auth/routes.js';

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

  await server.register(authRoutes, { prefix: '/api/auth' });

  await server.ready();
  return server;
}
