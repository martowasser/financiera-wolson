import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../build-app.js';
import { createTestUser, createTestEntity, createTestAccount, getAuthToken, authHeader } from '../../test-helpers.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
});

describe('Account Routes', () => {
  // ─── GET /api/accounts ──────────────────────────────────────────────
  describe('GET /api/accounts', () => {
    it('lists accounts with auth', async () => {
      const user = await createTestUser();
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      await createTestAccount(entity.id, { type: 'CASH' });
      await createTestAccount(entity.id, { type: 'BANK' });

      const res = await app.inject({
        method: 'GET',
        url: '/api/accounts',
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(2);
    });

    it('filters by type', async () => {
      const user = await createTestUser();
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      await createTestAccount(entity.id, { type: 'CASH' });
      await createTestAccount(entity.id, { type: 'BANK' });

      const res = await app.inject({
        method: 'GET',
        url: '/api/accounts?type=BANK',
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(1);
      expect(body[0].type).toBe('BANK');
    });

    it('filters by entityId', async () => {
      const user = await createTestUser();
      const token = getAuthToken(user);
      const entity1 = await createTestEntity({ name: 'Entity 1' });
      const entity2 = await createTestEntity({ name: 'Entity 2' });
      await createTestAccount(entity1.id);
      await createTestAccount(entity2.id);

      const res = await app.inject({
        method: 'GET',
        url: `/api/accounts?entityId=${entity1.id}`,
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(1);
    });

    it('filters by currency', async () => {
      const user = await createTestUser();
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      await createTestAccount(entity.id, { currency: 'ARS' });
      await createTestAccount(entity.id, { currency: 'USD' });

      const res = await app.inject({
        method: 'GET',
        url: '/api/accounts?currency=USD',
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(1);
      expect(body[0].currency).toBe('USD');
    });
  });

  // ─── GET /api/accounts/:id ─────────────────────────────────────────
  describe('GET /api/accounts/:id', () => {
    it('returns account with entity and balance', async () => {
      const user = await createTestUser();
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      const account = await createTestAccount(entity.id);

      const res = await app.inject({
        method: 'GET',
        url: `/api/accounts/${account.id}`,
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.entity).toBeDefined();
      expect(body.debitsPosted).toBeDefined();
      expect(body.creditsPosted).toBeDefined();
    });
  });

  // ─── GET /api/accounts/:id/balance ─────────────────────────────────
  describe('GET /api/accounts/:id/balance', () => {
    it('returns correct balance', async () => {
      const user = await createTestUser();
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      const account = await createTestAccount(entity.id, { normalBalance: 'DEBIT' });

      const res = await app.inject({
        method: 'GET',
        url: `/api/accounts/${account.id}/balance`,
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.debitsPosted).toBe(0);
      expect(body.creditsPosted).toBe(0);
      expect(body.balance).toBe(0);
    });
  });

  // ─── POST /api/accounts ────────────────────────────────────────────
  describe('POST /api/accounts', () => {
    it('creates account with all fields', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();

      const res = await app.inject({
        method: 'POST',
        url: '/api/accounts',
        headers: authHeader(token),
        payload: {
          entityId: entity.id,
          name: 'Test Cash',
          path: `ACTIVO:CAJA:ARS:${Date.now()}`,
          type: 'CASH',
          currency: 'ARS',
          normalBalance: 'DEBIT',
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().name).toBe('Test Cash');
      expect(res.json().type).toBe('CASH');
    });

    it('creates bank account with bankName and bankAccountNum', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();

      const res = await app.inject({
        method: 'POST',
        url: '/api/accounts',
        headers: authHeader(token),
        payload: {
          entityId: entity.id,
          name: 'Bank Account',
          path: `ACTIVO:BANCO:TEST:${Date.now()}`,
          type: 'BANK',
          currency: 'ARS',
          normalBalance: 'DEBIT',
          bankName: 'Banco Test',
          bankAccountNum: '1234567890',
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().bankName).toBe('Banco Test');
      expect(res.json().bankAccountNum).toBe('1234567890');
    });

    it('rejects duplicate path', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();
      const path = `ACTIVO:DUP:${Date.now()}`;
      await createTestAccount(entity.id, { path });

      const res = await app.inject({
        method: 'POST',
        url: '/api/accounts',
        headers: authHeader(token),
        payload: {
          entityId: entity.id,
          name: 'Duplicate Path',
          path,
          type: 'CASH',
          currency: 'ARS',
          normalBalance: 'DEBIT',
        },
      });

      expect(res.statusCode).toBe(409);
    });

    it('validates required fields', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);

      const res = await app.inject({
        method: 'POST',
        url: '/api/accounts',
        headers: authHeader(token),
        payload: { name: 'Missing Fields' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ─── PUT /api/accounts/:id ─────────────────────────────────────────
  describe('PUT /api/accounts/:id', () => {
    it('updates account', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();
      const account = await createTestAccount(entity.id, { name: 'Old Name' });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/accounts/${account.id}`,
        headers: authHeader(token),
        payload: { name: 'Updated Name' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe('Updated Name');
    });
  });

  // ─── DELETE /api/accounts/:id ──────────────────────────────────────
  describe('DELETE /api/accounts/:id', () => {
    it('soft-deletes as ADMIN', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();
      const account = await createTestAccount(entity.id);

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/accounts/${account.id}`,
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
    });
  });
});
