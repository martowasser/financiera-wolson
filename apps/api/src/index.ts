import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import prisma from './lib/prisma.js';
import { errorHandler } from './lib/errors.js';
import authRoutes from './modules/auth/routes.js';
import entityRoutes from './modules/entity/routes.js';
import ownershipRoutes from './modules/ownership/routes.js';
import accountRoutes from './modules/account/routes.js';
import periodRoutes from './modules/period/routes.js';
import ledgerRoutes from './modules/ledger/routes.js';
import propertyRoutes from './modules/property/routes.js';
import leaseRoutes from './modules/lease/routes.js';
import invoiceRoutes from './modules/invoice/routes.js';
import settlementRoutes from './modules/settlement/routes.js';
import reconciliationRoutes from './modules/reconciliation/routes.js';
import reportRoutes from './modules/reporting/routes.js';

const server = Fastify({ logger: true });

await server.register(cors, {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
});

await server.register(helmet);

await server.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

// Health check
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

// Register module routes
await server.register(authRoutes, { prefix: '/api/auth' });
await server.register(entityRoutes, { prefix: '/api/entities' });
await server.register(ownershipRoutes, { prefix: '/api/ownerships' });
await server.register(accountRoutes, { prefix: '/api/accounts' });
await server.register(periodRoutes, { prefix: '/api/periods' });
await server.register(ledgerRoutes, { prefix: '/api/transactions' });
await server.register(propertyRoutes, { prefix: '/api/properties' });
await server.register(leaseRoutes, { prefix: '/api/leases' });
await server.register(invoiceRoutes, { prefix: '/api/invoices' });
await server.register(settlementRoutes, { prefix: '/api/settlements' });
await server.register(reconciliationRoutes, { prefix: '/api/reconciliations' });
await server.register(reportRoutes, { prefix: '/api/reports' });

// Global error handler
server.setErrorHandler(errorHandler);

// Start server
const port = Number(process.env.PORT) || 3001;
try {
  await server.listen({ port, host: '0.0.0.0' });
  server.log.info(`Server listening on http://0.0.0.0:${port}`);
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
