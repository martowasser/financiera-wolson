import { FastifyInstance } from 'fastify';
import * as reportingService from './service.js';
import { authenticate } from '../../lib/auth-middleware.js';

export default async function reportingRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // GET /entity/:entityId/balances
  fastify.get('/entity/:entityId/balances', async (request) => {
    const { entityId } = request.params as { entityId: string };
    return reportingService.getEntityBalances(entityId);
  });

  // GET /owner/:ownerId/weighted-balances
  fastify.get('/owner/:ownerId/weighted-balances', async (request) => {
    const { ownerId } = request.params as { ownerId: string };
    return reportingService.getWeightedBalances(ownerId);
  });

  // GET /period/:periodId/movements
  fastify.get('/period/:periodId/movements', async (request) => {
    const { periodId } = request.params as { periodId: string };
    return reportingService.getMovementsByPeriod(periodId);
  });

  // GET /leases/status
  fastify.get('/leases/status', async () => {
    return reportingService.getLeaseStatus();
  });

  // GET /period/:periodId/cash-flow
  fastify.get('/period/:periodId/cash-flow', async (request) => {
    const { periodId } = request.params as { periodId: string };
    return reportingService.getCashFlowSummary(periodId);
  });
}
