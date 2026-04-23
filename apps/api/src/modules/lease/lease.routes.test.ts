import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../build-app.js';
import {
  createTestUser, createTestEntity, createTestProperty,
  createTestLease, getAuthToken, authHeader,
} from '../../test-helpers.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
});

describe('Lease Routes', () => {
  // ─── GET /api/leases ────────────────────────────────────────────────
  describe('GET /api/leases', () => {
    it('lists leases', async () => {
      const user = await createTestUser();
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      const tenant = await createTestEntity({ name: 'Tenant', type: 'PERSON' });
      const prop = await createTestProperty(entity.id);
      await createTestLease({ propertyId: prop.id, tenantId: tenant.id });

      const res = await app.inject({
        method: 'GET',
        url: '/api/leases',
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(1);
    });

    it('filters by propertyId', async () => {
      const user = await createTestUser();
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      const tenant = await createTestEntity({ name: 'Tenant', type: 'PERSON' });
      const prop1 = await createTestProperty(entity.id, { name: 'Prop 1' });
      const prop2 = await createTestProperty(entity.id, { name: 'Prop 2' });
      await createTestLease({ propertyId: prop1.id, tenantId: tenant.id });
      await createTestLease({ propertyId: prop2.id, tenantId: tenant.id });

      const res = await app.inject({
        method: 'GET',
        url: `/api/leases?propertyId=${prop1.id}`,
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(1);
    });

    it('filters by tenantId', async () => {
      const user = await createTestUser();
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      const tenant1 = await createTestEntity({ name: 'Tenant 1', type: 'PERSON' });
      const tenant2 = await createTestEntity({ name: 'Tenant 2', type: 'PERSON' });
      const prop = await createTestProperty(entity.id);
      await createTestLease({ propertyId: prop.id, tenantId: tenant1.id });
      await createTestLease({ propertyId: prop.id, tenantId: tenant2.id });

      const res = await app.inject({
        method: 'GET',
        url: `/api/leases?tenantId=${tenant1.id}`,
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(1);
    });
  });

  // ─── POST /api/leases ──────────────────────────────────────────────
  describe('POST /api/leases', () => {
    it('creates lease with required fields', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();
      const tenant = await createTestEntity({ name: 'New Tenant', type: 'PERSON' });
      const prop = await createTestProperty(entity.id);

      const res = await app.inject({
        method: 'POST',
        url: '/api/leases',
        headers: authHeader(token),
        payload: {
          propertyId: prop.id,
          tenantId: tenant.id,
          currency: 'ARS',
          baseAmount: 100000,
          startDate: '2024-01-01',
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().propertyId).toBe(prop.id);
      expect(res.json().tenantId).toBe(tenant.id);
    });

    it('rejects as VIEWER', async () => {
      const viewer = await createTestUser({ role: 'VIEWER' });
      const token = getAuthToken(viewer);
      const entity = await createTestEntity();
      const tenant = await createTestEntity({ type: 'PERSON' });
      const prop = await createTestProperty(entity.id);

      const res = await app.inject({
        method: 'POST',
        url: '/api/leases',
        headers: authHeader(token),
        payload: {
          propertyId: prop.id,
          tenantId: tenant.id,
          currency: 'ARS',
          baseAmount: 100000,
          startDate: '2024-01-01',
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('validates required fields', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);

      const res = await app.inject({
        method: 'POST',
        url: '/api/leases',
        headers: authHeader(token),
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ─── POST /api/leases/:id/prices ───────────────────────────────────
  describe('POST /api/leases/:id/prices', () => {
    it('adds price history entry', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();
      const tenant = await createTestEntity({ type: 'PERSON' });
      const prop = await createTestProperty(entity.id);
      const lease = await createTestLease({ propertyId: prop.id, tenantId: tenant.id });

      const res = await app.inject({
        method: 'POST',
        url: `/api/leases/${lease.id}/prices`,
        headers: authHeader(token),
        payload: {
          amount: 150000,
          validFrom: '2024-06-01',
        },
      });

      expect(res.statusCode).toBe(201);
    });
  });

  // ─── PUT /api/leases/:id ───────────────────────────────────────────
  describe('PUT /api/leases/:id', () => {
    it('updates lease', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity();
      const tenant = await createTestEntity({ type: 'PERSON' });
      const prop = await createTestProperty(entity.id);
      const lease = await createTestLease({ propertyId: prop.id, tenantId: tenant.id });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/leases/${lease.id}`,
        headers: authHeader(token),
        payload: { notes: 'Updated notes' },
      });

      expect(res.statusCode).toBe(200);
    });
  });
});
