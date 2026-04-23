import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../build-app.js';
import {
  createTestUser, createTestEntity, createTestAccounts,
  createTestPeriod, createTestProperty, createTestLease,
  getAuthToken, authHeader, prisma,
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

describe('Reporting Routes', () => {
  // ─── GET /api/reports/entity/:entityId/balances ─────────────────────
  describe('GET /api/reports/entity/:entityId/balances', () => {
    it('returns account balances for entity', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();
      const accounts = await createTestAccounts(entity.id);
      const period = await createTestPeriod();

      // Create a transaction to generate balances
      await createTransaction({
        periodId: period.id,
        description: 'Income for report',
        type: 'INCOME',
        entries: [
          { accountId: accounts.cashARS.id, type: 'DEBIT', amount: 50000n },
          { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: 50000n },
        ],
        createdById: admin.id,
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/reports/entity/${entity.id}/balances`,
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.length).toBeGreaterThanOrEqual(2);

      const cashBalance = body.find((a: any) => a.name === 'Cash ARS');
      expect(cashBalance).toBeDefined();
      expect(cashBalance.balance).toBe('50000');
    });
  });

  // ─── GET /api/reports/owner/:ownerId/weighted-balances ──────────────
  describe('GET /api/reports/owner/:ownerId/weighted-balances', () => {
    it('returns weighted balances based on ownership percentage', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity({ type: 'FIRM' });
      const owner = await createTestEntity({ name: 'Report Owner', type: 'PERSON' });

      // 50% ownership
      await prisma.ownership.create({
        data: { entityId: entity.id, ownerId: owner.id, percentage: 5000 },
      });

      const accounts = await createTestAccounts(entity.id);
      const period = await createTestPeriod();

      // Create transaction for 100000
      await createTransaction({
        periodId: period.id,
        description: 'Weighted balance test',
        type: 'INCOME',
        entries: [
          { accountId: accounts.cashARS.id, type: 'DEBIT', amount: 100000n },
          { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: 100000n },
        ],
        createdById: admin.id,
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/reports/owner/${owner.id}/weighted-balances`,
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.length).toBeGreaterThanOrEqual(1);

      const arsCurrency = body.find((c: any) => c.currency === 'ARS');
      expect(arsCurrency).toBeDefined();
      // Owner has 50% so weighted total should include half of each account balance
    });
  });

  // ─── GET /api/reports/period/:periodId/movements ────────────────────
  describe('GET /api/reports/period/:periodId/movements', () => {
    it('returns period movements', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();
      const accounts = await createTestAccounts(entity.id);
      const period = await createTestPeriod({ month: 8, year: 2023 });

      await createTransaction({
        periodId: period.id,
        description: 'Movement 1',
        type: 'INCOME',
        entries: [
          { accountId: accounts.cashARS.id, type: 'DEBIT', amount: 30000n },
          { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: 30000n },
        ],
        createdById: admin.id,
      });

      await createTransaction({
        periodId: period.id,
        description: 'Movement 2',
        type: 'EXPENSE',
        entries: [
          { accountId: accounts.expenseARS.id, type: 'DEBIT', amount: 10000n },
          { accountId: accounts.bankARS.id, type: 'CREDIT', amount: 10000n },
        ],
        createdById: admin.id,
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/reports/period/${period.id}/movements`,
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.transactionCount).toBe(2);
      expect(body.summary).toHaveLength(2);
      expect(body.period.id).toBe(period.id);
    });
  });

  // ─── GET /api/reports/leases/status ─────────────────────────────────
  describe('GET /api/reports/leases/status', () => {
    it('returns lease status summary', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();
      const tenant = await createTestEntity({ name: 'Lease Tenant', type: 'PERSON' });
      const prop = await createTestProperty(entity.id, { name: 'Report Prop' });
      await createTestLease({ propertyId: prop.id, tenantId: tenant.id });

      const res = await app.inject({
        method: 'GET',
        url: '/api/reports/leases/status',
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.length).toBeGreaterThanOrEqual(1);
      expect(body[0].property).toBeDefined();
      expect(body[0].tenant).toBeDefined();
      expect(['PAID', 'PENDING', 'NO_INVOICE']).toContain(body[0].status);
    });
  });

  // ─── GET /api/reports/period/:periodId/cash-flow ────────────────────
  describe('GET /api/reports/period/:periodId/cash-flow', () => {
    it('returns cash flow summary', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();
      const accounts = await createTestAccounts(entity.id);
      const period = await createTestPeriod({ month: 9, year: 2023 });

      // Income (cash debit = inflow)
      await createTransaction({
        periodId: period.id,
        description: 'Cash inflow',
        type: 'INCOME',
        entries: [
          { accountId: accounts.cashARS.id, type: 'DEBIT', amount: 80000n },
          { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: 80000n },
        ],
        createdById: admin.id,
      });

      // Expense (cash credit = outflow)
      await createTransaction({
        periodId: period.id,
        description: 'Cash outflow',
        type: 'EXPENSE',
        entries: [
          { accountId: accounts.expenseARS.id, type: 'DEBIT', amount: 20000n },
          { accountId: accounts.cashARS.id, type: 'CREDIT', amount: 20000n },
        ],
        createdById: admin.id,
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/reports/period/${period.id}/cash-flow`,
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.length).toBeGreaterThanOrEqual(1);

      const ars = body.find((c: any) => c.currency === 'ARS');
      expect(ars).toBeDefined();
      expect(ars.inflows).toBe('80000');
      expect(ars.outflows).toBe('20000');
      expect(ars.netFlow).toBe('60000');
    });
  });
});
