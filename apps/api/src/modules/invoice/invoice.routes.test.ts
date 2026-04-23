import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../build-app.js';
import {
  createTestUser, createTestEntity, createTestProperty,
  createTestLease, createTestAccounts, createTestPeriod,
  getAuthToken, authHeader,
} from '../../test-helpers.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
});

describe('Invoice Routes', () => {
  // ─── POST /api/invoices ─────────────────────────────────────────────
  describe('POST /api/invoices', () => {
    it('creates invoice with retentions and VAT', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();
      const tenant = await createTestEntity({ name: 'Tenant', type: 'PERSON' });
      const prop = await createTestProperty(entity.id);
      const lease = await createTestLease({ propertyId: prop.id, tenantId: tenant.id, baseAmount: 100000 });

      const res = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        headers: authHeader(token),
        payload: {
          leaseId: lease.id,
          periodMonth: 3,
          periodYear: 2024,
          baseAmount: 100000,
          vatAmount: 21000,
          retentions: [
            { concept: 'IIBB', amount: 3000 },
            { concept: 'Ganancias', amount: 6000, notes: 'Retención de ganancias' },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.retentions).toHaveLength(2);
      expect(body.code).toMatch(/^INV-/);
    });

    it('calculates totalAmount and netAmount correctly', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();
      const tenant = await createTestEntity({ type: 'PERSON' });
      const prop = await createTestProperty(entity.id);
      const lease = await createTestLease({ propertyId: prop.id, tenantId: tenant.id });

      const res = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        headers: authHeader(token),
        payload: {
          leaseId: lease.id,
          periodMonth: 4,
          periodYear: 2024,
          baseAmount: 100000,    // $1000.00
          vatAmount: 21000,      // $210.00
          retentions: [
            { concept: 'IIBB', amount: 3000 },   // $30.00
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      // totalAmount = baseAmount + vatAmount = 121000
      expect(body.totalAmount).toBe(121000);
      // netAmount = totalAmount - retentions = 121000 - 3000 = 118000
      expect(body.netAmount).toBe(118000);
    });

    it('validates required fields', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);

      const res = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        headers: authHeader(token),
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ─── POST /api/invoices/:id/collect ─────────────────────────────────
  describe('POST /api/invoices/:id/collect', () => {
    it('marks invoice as PAID and creates ledger transaction', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();
      const tenant = await createTestEntity({ type: 'PERSON' });
      const prop = await createTestProperty(entity.id);
      const lease = await createTestLease({ propertyId: prop.id, tenantId: tenant.id });
      const accounts = await createTestAccounts(entity.id);
      // Ensure a period exists for today
      await createTestPeriod();

      // Create invoice first
      const invoiceRes = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        headers: authHeader(token),
        payload: {
          leaseId: lease.id,
          periodMonth: 5,
          periodYear: 2024,
          baseAmount: 50000,
        },
      });
      const invoiceId = invoiceRes.json().id;

      // Collect payment
      const res = await app.inject({
        method: 'POST',
        url: `/api/invoices/${invoiceId}/collect`,
        headers: authHeader(token),
        payload: {
          paymentMethod: 'CASH',
          debitAccountId: accounts.cashARS.id,
          creditAccountId: accounts.receivableARS.id,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('PAID');
      expect(body.paidAt).toBeDefined();
      expect(body.transactions).toHaveLength(1);
    });

    it('rejects double collection', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();
      const tenant = await createTestEntity({ type: 'PERSON' });
      const prop = await createTestProperty(entity.id);
      const lease = await createTestLease({ propertyId: prop.id, tenantId: tenant.id });
      const accounts = await createTestAccounts(entity.id);
      await createTestPeriod();

      const invoiceRes = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        headers: authHeader(token),
        payload: { leaseId: lease.id, periodMonth: 6, periodYear: 2024, baseAmount: 50000 },
      });
      const invoiceId = invoiceRes.json().id;

      const collectPayload = {
        paymentMethod: 'CASH',
        debitAccountId: accounts.cashARS.id,
        creditAccountId: accounts.receivableARS.id,
      };

      // Collect first time
      await app.inject({
        method: 'POST',
        url: `/api/invoices/${invoiceId}/collect`,
        headers: authHeader(token),
        payload: collectPayload,
      });

      // Try again
      const res = await app.inject({
        method: 'POST',
        url: `/api/invoices/${invoiceId}/collect`,
        headers: authHeader(token),
        payload: collectPayload,
      });

      expect(res.statusCode).toBe(422);
    });

    it('validates payment method', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();
      const tenant = await createTestEntity({ type: 'PERSON' });
      const prop = await createTestProperty(entity.id);
      const lease = await createTestLease({ propertyId: prop.id, tenantId: tenant.id });
      const accounts = await createTestAccounts(entity.id);

      const invoiceRes = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        headers: authHeader(token),
        payload: { leaseId: lease.id, periodMonth: 7, periodYear: 2024, baseAmount: 50000 },
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/invoices/${invoiceRes.json().id}/collect`,
        headers: authHeader(token),
        payload: {
          paymentMethod: 'BITCOIN',
          debitAccountId: accounts.cashARS.id,
          creditAccountId: accounts.receivableARS.id,
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
