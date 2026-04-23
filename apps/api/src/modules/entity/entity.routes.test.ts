import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../build-app.js';
import { createTestUser, createTestEntity, getAuthToken, authHeader } from '../../test-helpers.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
});

describe('Entity Routes', () => {
  // ─── GET /api/entities ──────────────────────────────────────────────
  describe('GET /api/entities', () => {
    it('lists entities with auth', async () => {
      const user = await createTestUser();
      const token = getAuthToken(user);
      await createTestEntity({ name: 'Acme Corp', type: 'COMPANY' });
      await createTestEntity({ name: 'John Doe', type: 'PERSON' });

      const res = await app.inject({
        method: 'GET',
        url: '/api/entities',
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(2);
    });

    it('filters by type', async () => {
      const user = await createTestUser();
      const token = getAuthToken(user);
      await createTestEntity({ type: 'COMPANY' });
      await createTestEntity({ type: 'PERSON' });

      const res = await app.inject({
        method: 'GET',
        url: '/api/entities?type=COMPANY',
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(1);
      expect(body[0].type).toBe('COMPANY');
    });

    it('filters by onlyPersonas (excludes COMPANY)', async () => {
      const user = await createTestUser();
      const token = getAuthToken(user);
      await createTestEntity({ name: 'Acme Corp', type: 'COMPANY' });
      await createTestEntity({ name: 'John Doe', type: 'PERSON' });
      await createTestEntity({ name: 'Remax', type: 'FIRM' });
      await createTestEntity({ name: 'Some Vendor', type: 'THIRD_PARTY' });

      const res = await app.inject({
        method: 'GET',
        url: '/api/entities?onlyPersonas=true',
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(3);
      expect(body.every((e: { type: string }) => e.type !== 'COMPANY')).toBe(true);
    });

    it('filters by search', async () => {
      const user = await createTestUser();
      const token = getAuthToken(user);
      await createTestEntity({ name: 'Acme Corp' });
      await createTestEntity({ name: 'Other Inc' });

      const res = await app.inject({
        method: 'GET',
        url: '/api/entities?search=Acme',
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe('Acme Corp');
    });

    it('rejects without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/entities',
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ─── GET /api/entities/:id ──────────────────────────────────────────
  describe('GET /api/entities/:id', () => {
    it('returns entity by id', async () => {
      const user = await createTestUser();
      const token = getAuthToken(user);
      const entity = await createTestEntity({ name: 'Test Entity' });

      const res = await app.inject({
        method: 'GET',
        url: `/api/entities/${entity.id}`,
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe('Test Entity');
    });

    it('returns 404 for non-existent id', async () => {
      const user = await createTestUser();
      const token = getAuthToken(user);

      const res = await app.inject({
        method: 'GET',
        url: '/api/entities/non-existent-id',
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ─── POST /api/entities ─────────────────────────────────────────────
  describe('POST /api/entities', () => {
    it('creates entity as ADMIN', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);

      const res = await app.inject({
        method: 'POST',
        url: '/api/entities',
        headers: authHeader(token),
        payload: { name: 'New Entity', type: 'COMPANY' },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().name).toBe('New Entity');
      expect(res.json().type).toBe('COMPANY');
    });

    it('creates entity as OPERATOR', async () => {
      const operator = await createTestUser({ role: 'OPERATOR' });
      const token = getAuthToken(operator);

      const res = await app.inject({
        method: 'POST',
        url: '/api/entities',
        headers: authHeader(token),
        payload: { name: 'Operator Entity', type: 'PERSON' },
      });

      expect(res.statusCode).toBe(201);
    });

    it('rejects as VIEWER', async () => {
      const viewer = await createTestUser({ role: 'VIEWER' });
      const token = getAuthToken(viewer);

      const res = await app.inject({
        method: 'POST',
        url: '/api/entities',
        headers: authHeader(token),
        payload: { name: 'Viewer Entity', type: 'COMPANY' },
      });

      expect(res.statusCode).toBe(403);
    });

    it('validates required fields (name, type)', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);

      const res = await app.inject({
        method: 'POST',
        url: '/api/entities',
        headers: authHeader(token),
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects invalid entity type', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);

      const res = await app.inject({
        method: 'POST',
        url: '/api/entities',
        headers: authHeader(token),
        payload: { name: 'Bad Type', type: 'INVALID_TYPE' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ─── PUT /api/entities/:id ──────────────────────────────────────────
  describe('PUT /api/entities/:id', () => {
    it('updates entity', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity({ name: 'Old Name' });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/entities/${entity.id}`,
        headers: authHeader(token),
        payload: { name: 'New Name' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe('New Name');
    });

    it('returns 404 for non-existent id', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);

      const res = await app.inject({
        method: 'PUT',
        url: '/api/entities/non-existent-id',
        headers: authHeader(token),
        payload: { name: 'Does Not Exist' },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ─── DELETE /api/entities/:id ───────────────────────────────────────
  describe('DELETE /api/entities/:id', () => {
    it('soft-deletes as ADMIN', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/entities/${entity.id}`,
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
    });

    it('rejects as OPERATOR', async () => {
      const operator = await createTestUser({ role: 'OPERATOR' });
      const token = getAuthToken(operator);
      const entity = await createTestEntity();

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/entities/${entity.id}`,
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(403);
    });
  });
});
