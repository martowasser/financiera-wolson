import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';

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
import sociedadMemberRoutes from './modules/sociedad-member/routes.js';

export async function buildApp() {
  const server = Fastify({ logger: false });

  // BigInt serialization
  server.addHook('preSerialization', async (_request, _reply, payload) => {
    return JSON.parse(JSON.stringify(payload, (_key, value) =>
      typeof value === 'bigint' ? Number(value) : value
    ));
  });

  await server.register(cookie);
  await server.register(cors, { origin: true, credentials: true });

  server.setErrorHandler(errorHandler);

  // Register all routes (same prefixes as index.ts)
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
  await server.register(sociedadMemberRoutes, { prefix: '/api/sociedad-members' });

  await server.ready();
  return server;
}
