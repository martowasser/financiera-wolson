import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../build-app.js';
import { createTestUser, createTestPeriod, getAuthToken, authHeader } from '../../test-helpers.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
});

describe('Period Routes', () => {
  // ─── GET /api/periods ───────────────────────────────────────────────
  describe('GET /api/periods', () => {
    it('lists periods', async () => {
      const user = await createTestUser();
      const token = getAuthToken(user);
      await createTestPeriod({ month: 1, year: 2024 });
      await createTestPeriod({ month: 2, year: 2024 });

      const res = await app.inject({
        method: 'GET',
        url: '/api/periods',
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(2);
    });

    it('filters by status', async () => {
      const user = await createTestUser();
      const token = getAuthToken(user);
      await createTestPeriod({ month: 3, year: 2024 });
      await createTestPeriod({ month: 4, year: 2024, status: 'CLOSED' });

      const res = await app.inject({
        method: 'GET',
        url: '/api/periods?status=OPEN',
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(1);
      expect(body[0].status).toBe('OPEN');
    });
  });

  // ─── GET /api/periods/today ─────────────────────────────────────────
  describe('GET /api/periods/today', () => {
    it('creates period if none exists', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);

      const res = await app.inject({
        method: 'GET',
        url: '/api/periods/today',
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('OPEN');
    });

    it('returns existing period for current month', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);

      // Call twice — should return same period
      const res1 = await app.inject({
        method: 'GET',
        url: '/api/periods/today',
        headers: authHeader(token),
      });

      const res2 = await app.inject({
        method: 'GET',
        url: '/api/periods/today',
        headers: authHeader(token),
      });

      expect(res1.json().id).toBe(res2.json().id);
    });

    it('rejects as VIEWER', async () => {
      const viewer = await createTestUser({ role: 'VIEWER' });
      const token = getAuthToken(viewer);

      const res = await app.inject({
        method: 'GET',
        url: '/api/periods/today',
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ─── POST /api/periods/:id/close ───────────────────────────────────
  describe('POST /api/periods/:id/close', () => {
    it('closes period', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const period = await createTestPeriod({ month: 5, year: 2024 });

      const res = await app.inject({
        method: 'POST',
        url: `/api/periods/${period.id}/close`,
        headers: authHeader(token),
        payload: { closingNotes: 'Month end close' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('CLOSED');
    });

    it('rejects closing already-closed period', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const period = await createTestPeriod({ month: 6, year: 2024 });

      // Close it
      await app.inject({
        method: 'POST',
        url: `/api/periods/${period.id}/close`,
        headers: authHeader(token),
        payload: {},
      });

      // Try to close again
      const res = await app.inject({
        method: 'POST',
        url: `/api/periods/${period.id}/close`,
        headers: authHeader(token),
        payload: {},
      });

      expect(res.statusCode).toBe(409);
    });
  });
});
