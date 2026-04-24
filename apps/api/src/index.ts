import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import prisma from './lib/prisma.js';
import { errorHandler } from './lib/errors.js';
import authRoutes from './modules/auth/routes.js';

const server = Fastify({
  logger: true,
  serializerOpts: {
    ajv: { allowUnionTypes: true },
  },
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

await server.register(authRoutes, { prefix: '/api/auth' });

server.setErrorHandler(errorHandler);

const port = Number(process.env.PORT) || 3001;
try {
  await server.listen({ port, host: '0.0.0.0' });
  server.log.info(`Server listening on http://0.0.0.0:${port}`);
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
