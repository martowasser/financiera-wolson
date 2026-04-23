import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../build-app.js';
import { createTestUser, createTestEntity, getAuthToken, authHeader } from '../../test-helpers.js';
import prisma from '../../lib/prisma.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
});

describe('Ownership Routes', () => {
  // ─── GET /api/ownerships/entity/:entityId ───────────────────────────
  describe('GET /api/ownerships/entity/:entityId', () => {
    it('lists ownerships for entity', async () => {
      const user = await createTestUser();
      const token = getAuthToken(user);
      const entity = await createTestEntity({ name: 'Managed Entity', type: 'FIRM' });
      const owner = await createTestEntity({ name: 'Owner', type: 'PERSON' });
      await prisma.ownership.create({
        data: { entityId: entity.id, ownerId: owner.id, percentage: 5000 },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/ownerships/entity/${entity.id}`,
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(1);
      expect(body[0].percentage).toBe(5000);
    });
  });

  // ─── GET /api/ownerships/entity/:entityId/validate ──────────────────
  describe('GET /api/ownerships/entity/:entityId/validate', () => {
    it('returns valid when percentages sum to 10000', async () => {
      const user = await createTestUser();
      const token = getAuthToken(user);
      const entity = await createTestEntity({ type: 'FIRM' });
      const owner1 = await createTestEntity({ name: 'Owner 1', type: 'PERSON' });
      const owner2 = await createTestEntity({ name: 'Owner 2', type: 'PERSON' });
      await prisma.ownership.create({
        data: { entityId: entity.id, ownerId: owner1.id, percentage: 6000 },
      });
      await prisma.ownership.create({
        data: { entityId: entity.id, ownerId: owner2.id, percentage: 4000 },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/ownerships/entity/${entity.id}/validate`,
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.valid).toBe(true);
      expect(body.totalPercentage).toBe(10000);
      expect(body.remaining).toBe(0);
    });

    it('returns invalid when sum !== 10000', async () => {
      const user = await createTestUser();
      const token = getAuthToken(user);
      const entity = await createTestEntity({ type: 'FIRM' });
      const owner = await createTestEntity({ name: 'Single Owner', type: 'PERSON' });
      await prisma.ownership.create({
        data: { entityId: entity.id, ownerId: owner.id, percentage: 5000 },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/ownerships/entity/${entity.id}/validate`,
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.valid).toBe(false);
      expect(body.remaining).toBe(5000);
    });
  });

  // ─── POST /api/ownerships ──────────────────────────────────────────
  describe('POST /api/ownerships', () => {
    it('creates ownership', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity({ type: 'FIRM' });
      const owner = await createTestEntity({ name: 'New Owner', type: 'PERSON' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/ownerships',
        headers: authHeader(token),
        payload: {
          entityId: entity.id,
          ownerId: owner.id,
          percentage: 5000,
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().percentage).toBe(5000);
    });

    it('validates percentage > 0 and <= 10000', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity({ type: 'FIRM' });
      const owner = await createTestEntity({ type: 'PERSON' });

      // percentage = 0
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/ownerships',
        headers: authHeader(token),
        payload: { entityId: entity.id, ownerId: owner.id, percentage: 0 },
      });
      expect(res1.statusCode).toBe(400);

      // percentage > 10000
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/ownerships',
        headers: authHeader(token),
        payload: { entityId: entity.id, ownerId: owner.id, percentage: 10001 },
      });
      expect(res2.statusCode).toBe(400);
    });

    it('rejects if total exceeds 10000', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity({ type: 'FIRM' });
      const owner1 = await createTestEntity({ name: 'O1', type: 'PERSON' });
      const owner2 = await createTestEntity({ name: 'O2', type: 'PERSON' });

      // Create first ownership at 8000 (80%)
      await app.inject({
        method: 'POST',
        url: '/api/ownerships',
        headers: authHeader(token),
        payload: { entityId: entity.id, ownerId: owner1.id, percentage: 8000 },
      });

      // Try adding 3000 (30%) — exceeds 100%
      const res = await app.inject({
        method: 'POST',
        url: '/api/ownerships',
        headers: authHeader(token),
        payload: { entityId: entity.id, ownerId: owner2.id, percentage: 3000 },
      });

      expect(res.statusCode).toBe(422);
    });
  });

  // ─── PUT /api/ownerships/:id ───────────────────────────────────────
  describe('PUT /api/ownerships/:id', () => {
    it('updates percentage', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = getAuthToken(admin);
      const entity = await createTestEntity({ type: 'FIRM' });
      const owner = await createTestEntity({ type: 'PERSON' });
      const ownership = await prisma.ownership.create({
        data: { entityId: entity.id, ownerId: owner.id, percentage: 5000 },
      });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/ownerships/${ownership.id}`,
        headers: authHeader(token),
        payload: { percentage: 7000 },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().percentage).toBe(7000);
    });
  });
});
