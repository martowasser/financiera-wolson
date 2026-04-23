import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../build-app.js';
import {
  createTestUser, createTestEntity, createTestAccount,
  createTestAccounts, createTestPeriod, getAuthToken, authHeader,
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

describe('Reconciliation Routes', () => {
  // ─── POST /api/reconciliations ──────────────────────────────────────
  describe('POST /api/reconciliations', () => {
    it('creates reconciliation with bank balance', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();
      const account = await createTestAccount(entity.id, {
        type: 'BANK', name: 'Bank for Recon', bankName: 'Test Bank',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/reconciliations',
        headers: authHeader(token),
        payload: {
          accountId: account.id,
          date: '2024-03-15',
          bankBalance: 500000,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.bankBalance).toBe(500000);
      expect(body.status).toBe('IN_PROGRESS');
    });
  });

  // ─── POST /api/reconciliations/:id/items ────────────────────────────
  describe('POST /api/reconciliations/:id/items', () => {
    it('adds bank item', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();
      const account = await createTestAccount(entity.id, { type: 'BANK' });

      const reconRes = await app.inject({
        method: 'POST',
        url: '/api/reconciliations',
        headers: authHeader(token),
        payload: { accountId: account.id, date: '2024-03-15', bankBalance: 500000 },
      });
      const reconId = reconRes.json().id;

      const res = await app.inject({
        method: 'POST',
        url: `/api/reconciliations/${reconId}/items`,
        headers: authHeader(token),
        payload: {
          description: 'Wire transfer deposit',
          bankAmount: 100000,
          externalRef: 'TRF-001',
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().description).toBe('Wire transfer deposit');
      expect(res.json().bankAmount).toBe(100000);
    });

    it('validates required fields', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();
      const account = await createTestAccount(entity.id, { type: 'BANK' });

      const reconRes = await app.inject({
        method: 'POST',
        url: '/api/reconciliations',
        headers: authHeader(token),
        payload: { accountId: account.id, date: '2024-03-15', bankBalance: 500000 },
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/reconciliations/${reconRes.json().id}/items`,
        headers: authHeader(token),
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ─── POST /api/reconciliations/items/:itemId/match ──────────────────
  describe('POST /api/reconciliations/items/:itemId/match', () => {
    it('matches item to system transaction', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();
      const accounts = await createTestAccounts(entity.id);
      const period = await createTestPeriod();

      // Create a bank account for reconciliation
      const bankAccount = accounts.bankARS;

      // Create a system transaction
      const txn = await createTransaction({
        periodId: period.id,
        description: 'Bank deposit',
        type: 'INCOME',
        entries: [
          { accountId: bankAccount.id, type: 'DEBIT', amount: 100000n },
          { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: 100000n },
        ],
        createdById: admin.id,
      });

      // Create reconciliation
      const reconRes = await app.inject({
        method: 'POST',
        url: '/api/reconciliations',
        headers: authHeader(token),
        payload: { accountId: bankAccount.id, date: '2024-03-15', bankBalance: 100000 },
      });
      const reconId = reconRes.json().id;

      // Add item
      const itemRes = await app.inject({
        method: 'POST',
        url: `/api/reconciliations/${reconId}/items`,
        headers: authHeader(token),
        payload: { description: 'Deposit', bankAmount: 100000 },
      });
      const itemId = itemRes.json().id;

      // Match item to transaction
      const res = await app.inject({
        method: 'POST',
        url: `/api/reconciliations/items/${itemId}/match`,
        headers: authHeader(token),
        payload: { transactionId: txn.id },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().isReconciled).toBe(true);
      expect(res.json().transactionId).toBe(txn.id);
      expect(res.json().systemAmount).toBe(100000);
    });
  });

  // ─── POST /api/reconciliations/:id/globalize ────────────────────────
  describe('POST /api/reconciliations/:id/globalize', () => {
    it('groups multiple items under label', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();
      const account = await createTestAccount(entity.id, { type: 'BANK' });

      const reconRes = await app.inject({
        method: 'POST',
        url: '/api/reconciliations',
        headers: authHeader(token),
        payload: { accountId: account.id, date: '2024-03-15', bankBalance: 500000 },
      });
      const reconId = reconRes.json().id;

      // Add two items
      const item1Res = await app.inject({
        method: 'POST',
        url: `/api/reconciliations/${reconId}/items`,
        headers: authHeader(token),
        payload: { description: 'Fee 1', bankAmount: 1000 },
      });
      const item2Res = await app.inject({
        method: 'POST',
        url: `/api/reconciliations/${reconId}/items`,
        headers: authHeader(token),
        payload: { description: 'Fee 2', bankAmount: 2000 },
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/reconciliations/${reconId}/globalize`,
        headers: authHeader(token),
        payload: {
          itemIds: [item1Res.json().id, item2Res.json().id],
          groupLabel: 'Bank Fees March',
        },
      });

      expect(res.statusCode).toBe(200);
    });
  });

  // ─── POST /api/reconciliations/:id/complete ─────────────────────────
  describe('POST /api/reconciliations/:id/complete', () => {
    it('completes when balanced', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();
      const account = await createTestAccount(entity.id, { type: 'BANK' });

      // Create reconciliation with 0 bank balance (and system balance is 0)
      const reconRes = await app.inject({
        method: 'POST',
        url: '/api/reconciliations',
        headers: authHeader(token),
        payload: { accountId: account.id, date: '2024-03-15', bankBalance: 0 },
      });
      const reconId = reconRes.json().id;

      const res = await app.inject({
        method: 'POST',
        url: `/api/reconciliations/${reconId}/complete`,
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('COMPLETED');
    });

    it('marks DISCREPANCY when unbalanced', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();
      const account = await createTestAccount(entity.id, { type: 'BANK' });

      // Create reconciliation with bank balance != system balance (system is 0)
      const reconRes = await app.inject({
        method: 'POST',
        url: '/api/reconciliations',
        headers: authHeader(token),
        payload: { accountId: account.id, date: '2024-03-15', bankBalance: 50000 },
      });
      const reconId = reconRes.json().id;

      const res = await app.inject({
        method: 'POST',
        url: `/api/reconciliations/${reconId}/complete`,
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('DISCREPANCY');
    });

    it('calculates difference correctly', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();
      const account = await createTestAccount(entity.id, { type: 'BANK' });

      const reconRes = await app.inject({
        method: 'POST',
        url: '/api/reconciliations',
        headers: authHeader(token),
        payload: { accountId: account.id, date: '2024-03-15', bankBalance: 150000 },
      });

      // difference should be bankBalance - systemBalance = 150000 - 0 = 150000
      expect(reconRes.json().difference).toBe(150000);
    });
  });
});
