import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../build-app.js';
import { createTestUser, createTestEntity, createTestProperty, getAuthToken, authHeader } from '../../test-helpers.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
});

describe('Property Routes', () => {
  // ─── GET /api/properties ────────────────────────────────────────────
  describe('GET /api/properties', () => {
    it('lists properties with auth', async () => {
      const user = await createTestUser();
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      await createTestProperty(entity.id, { name: 'Prop A' });
      await createTestProperty(entity.id, { name: 'Prop B' });

      const res = await app.inject({
        method: 'GET',
        url: '/api/properties',
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(2);
    });

    it('filters by entityId', async () => {
      const user = await createTestUser();
      const token = getAuthToken(user);
      const entity1 = await createTestEntity({ name: 'E1' });
      const entity2 = await createTestEntity({ name: 'E2' });
      await createTestProperty(entity1.id);
      await createTestProperty(entity2.id);

      const res = await app.inject({
        method: 'GET',
        url: `/api/properties?entityId=${entity1.id}`,
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(1);
    });

    it('filters by type', async () => {
      const user = await createTestUser();
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      await createTestProperty(entity.id, { type: 'APARTMENT' });
      await createTestProperty(entity.id, { type: 'COMMERCIAL' });

      const res = await app.inject({
        method: 'GET',
        url: '/api/properties?type=APARTMENT',
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(1);
      expect(body[0].type).toBe('APARTMENT');
    });

    it('rejects without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/properties',
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ─── GET /api/properties/:id ────────────────────────────────────────
  describe('GET /api/properties/:id', () => {
    it('returns property by id', async () => {
      const user = await createTestUser();
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      const prop = await createTestProperty(entity.id, { name: 'My Prop' });

      const res = await app.inject({
        method: 'GET',
        url: `/api/properties/${prop.id}`,
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe('My Prop');
    });

    it('returns 404 for non-existent id', async () => {
      const user = await createTestUser();
      const token = getAuthToken(user);

      const res = await app.inject({
        method: 'GET',
        url: '/api/properties/non-existent-id',
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ─── POST /api/properties ──────────────────────────────────────────
  describe('POST /api/properties', () => {
    it('creates property as ADMIN', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();

      const res = await app.inject({
        method: 'POST',
        url: '/api/properties',
        headers: authHeader(token),
        payload: {
          entityId: entity.id,
          name: 'New Property',
          address: '456 Test Ave',
          type: 'COMMERCIAL',
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().name).toBe('New Property');
      expect(res.json().type).toBe('COMMERCIAL');
    });

    it('creates property as OPERATOR', async () => {
      const operator = await createTestUser({ role: 'OPERATOR' });
      const token = getAuthToken(operator);
      const entity = await createTestEntity();

      const res = await app.inject({
        method: 'POST',
        url: '/api/properties',
        headers: authHeader(token),
        payload: { entityId: entity.id, name: 'Operator Prop' },
      });

      expect(res.statusCode).toBe(201);
    });

    it('rejects as VIEWER', async () => {
      const viewer = await createTestUser({ role: 'VIEWER' });
      const token = getAuthToken(viewer);
      const entity = await createTestEntity();

      const res = await app.inject({
        method: 'POST',
        url: '/api/properties',
        headers: authHeader(token),
        payload: { entityId: entity.id, name: 'Viewer Prop' },
      });

      expect(res.statusCode).toBe(403);
    });

    it('validates required fields', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);

      const res = await app.inject({
        method: 'POST',
        url: '/api/properties',
        headers: authHeader(token),
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ─── PUT /api/properties/:id ───────────────────────────────────────
  describe('PUT /api/properties/:id', () => {
    it('updates property', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();
      const prop = await createTestProperty(entity.id, { name: 'Old Prop' });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/properties/${prop.id}`,
        headers: authHeader(token),
        payload: { name: 'Updated Prop' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe('Updated Prop');
    });
  });

  // ─── DELETE /api/properties/:id ────────────────────────────────────
  describe('DELETE /api/properties/:id', () => {
    it('soft-deletes as ADMIN', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();
      const prop = await createTestProperty(entity.id);

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/properties/${prop.id}`,
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
    });

    it('rejects as OPERATOR', async () => {
      const operator = await createTestUser({ role: 'OPERATOR' });
      const token = getAuthToken(operator);
      const entity = await createTestEntity();
      const prop = await createTestProperty(entity.id);

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/properties/${prop.id}`,
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(403);
    });
  });
});
