import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../build-app.js';
import {
  createTestUser, createTestEntity, createTestAccounts,
  createTestPeriod, getAuthToken, authHeader, prisma,
} from '../../test-helpers.js';
import { createTransaction } from '../ledger/service.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
});

describe('Settlement Routes', () => {
  // ─── POST /api/settlements ──────────────────────────────────────────
  describe('POST /api/settlements', () => {
    it('calculates owner shares based on ownership percentages', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity({ type: 'FIRM' });
      const owner1 = await createTestEntity({ name: 'Owner A', type: 'PERSON' });
      const owner2 = await createTestEntity({ name: 'Owner B', type: 'PERSON' });

      // Set up ownerships (60/40 split)
      await prisma.ownership.create({
        data: { entityId: entity.id, ownerId: owner1.id, percentage: 6000 },
      });
      await prisma.ownership.create({
        data: { entityId: entity.id, ownerId: owner2.id, percentage: 4000 },
      });

      // Create accounts and a transaction so there's income
      const accounts = await createTestAccounts(entity.id);
      const period = await createTestPeriod({ month: 1, year: 2024 });
      await createTransaction({
        periodId: period.id,
        description: 'Rental income',
        type: 'INCOME',
        entries: [
          { accountId: accounts.cashARS.id, type: 'DEBIT', amount: 100000n },
          { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: 100000n },
        ],
        createdById: admin.id,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/settlements',
        headers: authHeader(token),
        payload: {
          entityId: entity.id,
          periodFrom: '2024-01-01',
          periodTo: '2024-01-31',
          currency: 'ARS',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.grossIncome).toBe(100000);
      expect(body.status).toBe('DRAFT');

      // Check distributions
      const distributions = body.distributions;
      expect(distributions).toHaveLength(2);

      const ownerADist = distributions.find((d: any) => d.ownerName === 'Owner A');
      const ownerBDist = distributions.find((d: any) => d.ownerName === 'Owner B');
      expect(Number(ownerADist.amount)).toBe(60000); // 60% of 100000
      expect(Number(ownerBDist.amount)).toBe(40000); // 40% of 100000
    });

    it('rejects entity without active owners', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity({ type: 'FIRM' });
      // No ownerships created

      const res = await app.inject({
        method: 'POST',
        url: '/api/settlements',
        headers: authHeader(token),
        payload: {
          entityId: entity.id,
          periodFrom: '2024-01-01',
          periodTo: '2024-01-31',
          currency: 'ARS',
        },
      });

      expect(res.statusCode).toBe(422);
    });
  });

  // ─── POST /api/settlements/:id/approve ──────────────────────────────
  describe('POST /api/settlements/:id/approve', () => {
    it('approves as ADMIN', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity({ type: 'FIRM' });
      const owner = await createTestEntity({ type: 'PERSON' });

      await prisma.ownership.create({
        data: { entityId: entity.id, ownerId: owner.id, percentage: 10000 },
      });

      // Create settlement
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/settlements',
        headers: authHeader(token),
        payload: {
          entityId: entity.id,
          periodFrom: '2024-02-01',
          periodTo: '2024-02-29',
          currency: 'ARS',
        },
      });

      const settlementId = createRes.json().id;

      const res = await app.inject({
        method: 'POST',
        url: `/api/settlements/${settlementId}/approve`,
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('APPROVED');
    });

    it('rejects as OPERATOR', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const operator = await createTestUser({ role: 'OPERATOR' });
      const adminToken = getAuthToken(admin);
      const opToken = getAuthToken(operator);
      const entity = await createTestEntity({ type: 'FIRM' });
      const owner = await createTestEntity({ type: 'PERSON' });

      await prisma.ownership.create({
        data: { entityId: entity.id, ownerId: owner.id, percentage: 10000 },
      });

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/settlements',
        headers: authHeader(adminToken),
        payload: {
          entityId: entity.id,
          periodFrom: '2024-03-01',
          periodTo: '2024-03-31',
          currency: 'ARS',
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/settlements/${createRes.json().id}/approve`,
        headers: authHeader(opToken),
      });

      expect(res.statusCode).toBe(403);
    });

    it('rejects approving non-DRAFT settlement', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity({ type: 'FIRM' });
      const owner = await createTestEntity({ type: 'PERSON' });

      await prisma.ownership.create({
        data: { entityId: entity.id, ownerId: owner.id, percentage: 10000 },
      });

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/settlements',
        headers: authHeader(token),
        payload: {
          entityId: entity.id,
          periodFrom: '2024-04-01',
          periodTo: '2024-04-30',
          currency: 'ARS',
        },
      });

      const settlementId = createRes.json().id;

      // Approve first
      await app.inject({
        method: 'POST',
        url: `/api/settlements/${settlementId}/approve`,
        headers: authHeader(token),
      });

      // Try to approve again
      const res = await app.inject({
        method: 'POST',
        url: `/api/settlements/${settlementId}/approve`,
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(422);
    });
  });
});
