import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../build-app.js';
import {
  createTestUser, createTestEntity, createTestAccounts,
  createTestPeriod, getAuthToken, authHeader, prisma,
} from '../../test-helpers.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
});

describe('Ledger Routes', () => {
  // ─── GET /api/transactions ──────────────────────────────────────────
  describe('GET /api/transactions', () => {
    it('lists transactions with auth', async () => {
      const user = await createTestUser({ role: 'OPERATOR' });
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      const accounts = await createTestAccounts(entity.id);
      const period = await createTestPeriod();

      // Create a transaction via API
      await app.inject({
        method: 'POST',
        url: '/api/transactions',
        headers: authHeader(token),
        payload: {
          periodId: period.id,
          description: 'Test income',
          type: 'INCOME',
          paymentMethod: 'CASH',
          entries: [
            { accountId: accounts.cashARS.id, type: 'DEBIT', amount: '10000' },
            { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: '10000' },
          ],
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/transactions',
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().length).toBeGreaterThanOrEqual(1);
    });

    it('filters by periodId', async () => {
      const user = await createTestUser({ role: 'OPERATOR' });
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      const accounts = await createTestAccounts(entity.id);
      const period1 = await createTestPeriod({ month: 1, year: 2023 });
      const period2 = await createTestPeriod({ month: 2, year: 2023 });

      await app.inject({
        method: 'POST', url: '/api/transactions', headers: authHeader(token),
        payload: {
          periodId: period1.id, description: 'P1 txn', type: 'INCOME',
          entries: [
            { accountId: accounts.cashARS.id, type: 'DEBIT', amount: '1000' },
            { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: '1000' },
          ],
        },
      });

      await app.inject({
        method: 'POST', url: '/api/transactions', headers: authHeader(token),
        payload: {
          periodId: period2.id, description: 'P2 txn', type: 'EXPENSE',
          entries: [
            { accountId: accounts.expenseARS.id, type: 'DEBIT', amount: '2000' },
            { accountId: accounts.bankARS.id, type: 'CREDIT', amount: '2000' },
          ],
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/transactions?periodId=${period1.id}`,
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(1);
      expect(res.json()[0].description).toBe('P1 txn');
    });

    it('filters by type', async () => {
      const user = await createTestUser({ role: 'OPERATOR' });
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      const accounts = await createTestAccounts(entity.id);
      const period = await createTestPeriod();

      await app.inject({
        method: 'POST', url: '/api/transactions', headers: authHeader(token),
        payload: {
          periodId: period.id, description: 'Income', type: 'INCOME',
          entries: [
            { accountId: accounts.cashARS.id, type: 'DEBIT', amount: '1000' },
            { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: '1000' },
          ],
        },
      });

      await app.inject({
        method: 'POST', url: '/api/transactions', headers: authHeader(token),
        payload: {
          periodId: period.id, description: 'Expense', type: 'EXPENSE',
          entries: [
            { accountId: accounts.expenseARS.id, type: 'DEBIT', amount: '2000' },
            { accountId: accounts.bankARS.id, type: 'CREDIT', amount: '2000' },
          ],
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/transactions?type=INCOME',
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(1);
    });

    it('search by description', async () => {
      const user = await createTestUser({ role: 'OPERATOR' });
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      const accounts = await createTestAccounts(entity.id);
      const period = await createTestPeriod();

      await app.inject({
        method: 'POST', url: '/api/transactions', headers: authHeader(token),
        payload: {
          periodId: period.id, description: 'Alquiler departamento', type: 'INCOME',
          entries: [
            { accountId: accounts.cashARS.id, type: 'DEBIT', amount: '5000' },
            { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: '5000' },
          ],
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/transactions?search=Alquiler',
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(1);
    });
  });

  // ─── GET /api/transactions/:id ──────────────────────────────────────
  describe('GET /api/transactions/:id', () => {
    it('returns transaction with entries', async () => {
      const user = await createTestUser({ role: 'OPERATOR' });
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      const accounts = await createTestAccounts(entity.id);
      const period = await createTestPeriod();

      const createRes = await app.inject({
        method: 'POST', url: '/api/transactions', headers: authHeader(token),
        payload: {
          periodId: period.id, description: 'Detail test', type: 'INCOME',
          entries: [
            { accountId: accounts.cashARS.id, type: 'DEBIT', amount: '3000' },
            { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: '3000' },
          ],
        },
      });

      const txnId = createRes.json().id;
      const res = await app.inject({
        method: 'GET',
        url: `/api/transactions/${txnId}`,
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.entries).toHaveLength(2);
      expect(body.description).toBe('Detail test');
    });

    it('returns 404 for non-existent', async () => {
      const user = await createTestUser();
      const token = getAuthToken(user);

      const res = await app.inject({
        method: 'GET',
        url: '/api/transactions/non-existent-id',
        headers: authHeader(token),
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ─── POST /api/transactions ─────────────────────────────────────────
  describe('POST /api/transactions', () => {
    it('creates balanced transaction (total debits == total credits)', async () => {
      const user = await createTestUser({ role: 'OPERATOR' });
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      const accounts = await createTestAccounts(entity.id);
      const period = await createTestPeriod();

      const res = await app.inject({
        method: 'POST',
        url: '/api/transactions',
        headers: authHeader(token),
        payload: {
          periodId: period.id,
          description: 'Balanced transaction',
          type: 'INCOME',
          paymentMethod: 'CASH',
          entries: [
            { accountId: accounts.cashARS.id, type: 'DEBIT', amount: '10000' },
            { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: '10000' },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.status).toBe('CONFIRMED');
      expect(body.entries).toHaveLength(2);
      expect(body.code).toMatch(/^TXN-\d{6}$/);
    });

    it('rejects unbalanced entries', async () => {
      const user = await createTestUser({ role: 'OPERATOR' });
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      const accounts = await createTestAccounts(entity.id);
      const period = await createTestPeriod();

      const res = await app.inject({
        method: 'POST',
        url: '/api/transactions',
        headers: authHeader(token),
        payload: {
          periodId: period.id,
          description: 'Unbalanced',
          type: 'INCOME',
          entries: [
            { accountId: accounts.cashARS.id, type: 'DEBIT', amount: '10000' },
            { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: '5000' },
          ],
        },
      });

      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('rejects less than 2 entries without sociedad', async () => {
      const user = await createTestUser({ role: 'OPERATOR' });
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      const accounts = await createTestAccounts(entity.id);
      const period = await createTestPeriod();

      const res = await app.inject({
        method: 'POST',
        url: '/api/transactions',
        headers: authHeader(token),
        payload: {
          periodId: period.id,
          description: 'Single entry',
          type: 'INCOME',
          entries: [
            { accountId: accounts.cashARS.id, type: 'DEBIT', amount: '10000' },
          ],
        },
      });

      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('rejects entry with empty accountId', async () => {
      const user = await createTestUser({ role: 'OPERATOR' });
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      const accounts = await createTestAccounts(entity.id);
      const period = await createTestPeriod();

      const res = await app.inject({
        method: 'POST',
        url: '/api/transactions',
        headers: authHeader(token),
        payload: {
          periodId: period.id,
          description: 'Empty accountId',
          type: 'INCOME',
          entries: [
            { accountId: '', type: 'DEBIT', amount: '10000' },
            { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: '10000' },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects transaction in closed period', async () => {
      const user = await createTestUser({ role: 'OPERATOR' });
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      const accounts = await createTestAccounts(entity.id);
      const period = await createTestPeriod({ month: 7, year: 2023 });

      // Close the period
      await prisma.period.update({
        where: { id: period.id },
        data: { status: 'CLOSED', closedAt: new Date() },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/transactions',
        headers: authHeader(token),
        payload: {
          periodId: period.id,
          description: 'On closed period',
          type: 'INCOME',
          entries: [
            { accountId: accounts.cashARS.id, type: 'DEBIT', amount: '10000' },
            { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: '10000' },
          ],
        },
      });

      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('creates with idempotencyKey (duplicate ignored)', async () => {
      const user = await createTestUser({ role: 'OPERATOR' });
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      const accounts = await createTestAccounts(entity.id);
      const period = await createTestPeriod();
      const idempotencyKey = `idem-route-${Date.now()}`;

      const payload = {
        periodId: period.id,
        description: 'Idempotent txn',
        type: 'INCOME' as const,
        idempotencyKey,
        entries: [
          { accountId: accounts.cashARS.id, type: 'DEBIT' as const, amount: '5000' },
          { accountId: accounts.incomeARS.id, type: 'CREDIT' as const, amount: '5000' },
        ],
      };

      const res1 = await app.inject({
        method: 'POST', url: '/api/transactions', headers: authHeader(token), payload,
      });
      const res2 = await app.inject({
        method: 'POST', url: '/api/transactions', headers: authHeader(token), payload,
      });

      expect(res1.statusCode).toBe(201);
      expect(res2.statusCode).toBe(201);
      expect(res1.json().id).toBe(res2.json().id);
    });

    it('validates transaction type enum', async () => {
      const user = await createTestUser({ role: 'OPERATOR' });
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      const accounts = await createTestAccounts(entity.id);
      const period = await createTestPeriod();

      const res = await app.inject({
        method: 'POST',
        url: '/api/transactions',
        headers: authHeader(token),
        payload: {
          periodId: period.id,
          description: 'Bad type',
          type: 'INVALID_TYPE',
          entries: [
            { accountId: accounts.cashARS.id, type: 'DEBIT', amount: '1000' },
            { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: '1000' },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('validates payment method enum', async () => {
      const user = await createTestUser({ role: 'OPERATOR' });
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      const accounts = await createTestAccounts(entity.id);
      const period = await createTestPeriod();

      const res = await app.inject({
        method: 'POST',
        url: '/api/transactions',
        headers: authHeader(token),
        payload: {
          periodId: period.id,
          description: 'Bad payment',
          type: 'INCOME',
          paymentMethod: 'BITCOIN',
          entries: [
            { accountId: accounts.cashARS.id, type: 'DEBIT', amount: '1000' },
            { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: '1000' },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('updates account balances after creation', async () => {
      const user = await createTestUser({ role: 'OPERATOR' });
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      const accounts = await createTestAccounts(entity.id);
      const period = await createTestPeriod();

      await app.inject({
        method: 'POST',
        url: '/api/transactions',
        headers: authHeader(token),
        payload: {
          periodId: period.id,
          description: 'Balance check',
          type: 'INCOME',
          entries: [
            { accountId: accounts.cashARS.id, type: 'DEBIT', amount: '25000' },
            { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: '25000' },
          ],
        },
      });

      // Check balance via API
      const balRes = await app.inject({
        method: 'GET',
        url: `/api/accounts/${accounts.cashARS.id}/balance`,
        headers: authHeader(token),
      });

      expect(balRes.json().debitsPosted).toBe(25000);
      expect(balRes.json().balance).toBe(25000);
    });
  });

  // ─── POST /api/transactions/:id/reverse ─────────────────────────────
  describe('POST /api/transactions/:id/reverse', () => {
    it('reverses confirmed transaction', async () => {
      const user = await createTestUser({ role: 'OPERATOR' });
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      const accounts = await createTestAccounts(entity.id);
      const period = await createTestPeriod();

      const createRes = await app.inject({
        method: 'POST', url: '/api/transactions', headers: authHeader(token),
        payload: {
          periodId: period.id, description: 'To reverse', type: 'EXPENSE',
          entries: [
            { accountId: accounts.expenseARS.id, type: 'DEBIT', amount: '20000' },
            { accountId: accounts.bankARS.id, type: 'CREDIT', amount: '20000' },
          ],
        },
      });

      const txnId = createRes.json().id;
      const res = await app.inject({
        method: 'POST',
        url: `/api/transactions/${txnId}/reverse`,
        headers: authHeader(token),
        payload: { reason: 'Monto incorrecto' },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().type).toBe('REVERSAL');
      expect(res.json().entries).toHaveLength(2);
    });

    it('creates reversal entries (mirror of original)', async () => {
      const user = await createTestUser({ role: 'OPERATOR' });
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      const accounts = await createTestAccounts(entity.id);
      const period = await createTestPeriod();

      const createRes = await app.inject({
        method: 'POST', url: '/api/transactions', headers: authHeader(token),
        payload: {
          periodId: period.id, description: 'To mirror', type: 'INCOME',
          entries: [
            { accountId: accounts.cashARS.id, type: 'DEBIT', amount: '10000' },
            { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: '10000' },
          ],
        },
      });

      const reverseRes = await app.inject({
        method: 'POST',
        url: `/api/transactions/${createRes.json().id}/reverse`,
        headers: authHeader(token),
        payload: { reason: 'Mirror test' },
      });

      const entries = reverseRes.json().entries;
      const debitEntry = entries.find((e: any) => e.type === 'DEBIT');
      const creditEntry = entries.find((e: any) => e.type === 'CREDIT');

      // Original: cash DEBIT, income CREDIT → Reversal: income DEBIT, cash CREDIT
      expect(debitEntry.accountId).toBe(accounts.incomeARS.id);
      expect(creditEntry.accountId).toBe(accounts.cashARS.id);
    });

    it('rejects reversing already-reversed transaction', async () => {
      const user = await createTestUser({ role: 'OPERATOR' });
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      const accounts = await createTestAccounts(entity.id);
      const period = await createTestPeriod();

      const createRes = await app.inject({
        method: 'POST', url: '/api/transactions', headers: authHeader(token),
        payload: {
          periodId: period.id, description: 'Already reversed', type: 'EXPENSE',
          entries: [
            { accountId: accounts.expenseARS.id, type: 'DEBIT', amount: '5000' },
            { accountId: accounts.bankARS.id, type: 'CREDIT', amount: '5000' },
          ],
        },
      });

      const txnId = createRes.json().id;

      // Reverse once
      await app.inject({
        method: 'POST',
        url: `/api/transactions/${txnId}/reverse`,
        headers: authHeader(token),
        payload: { reason: 'First reversal' },
      });

      // Try again
      const res = await app.inject({
        method: 'POST',
        url: `/api/transactions/${txnId}/reverse`,
        headers: authHeader(token),
        payload: { reason: 'Second attempt' },
      });

      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('updates account balances after reversal', async () => {
      const user = await createTestUser({ role: 'OPERATOR' });
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      const accounts = await createTestAccounts(entity.id);
      const period = await createTestPeriod();

      const createRes = await app.inject({
        method: 'POST', url: '/api/transactions', headers: authHeader(token),
        payload: {
          periodId: period.id, description: 'Balance reversal', type: 'INCOME',
          entries: [
            { accountId: accounts.cashARS.id, type: 'DEBIT', amount: '15000' },
            { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: '15000' },
          ],
        },
      });

      await app.inject({
        method: 'POST',
        url: `/api/transactions/${createRes.json().id}/reverse`,
        headers: authHeader(token),
        payload: { reason: 'Balance check' },
      });

      const balRes = await app.inject({
        method: 'GET',
        url: `/api/accounts/${accounts.cashARS.id}/balance`,
        headers: authHeader(token),
      });

      // Net balance should be 0 after reversal
      expect(balRes.json().balance).toBe(0);
    });
  });

  // ─── Sociedad auto-distribution ─────────────────────────────────────
  describe('POST /api/transactions with sociedadId (auto-distribution)', () => {
    async function setupSociedad(
      opts: { members: number[]; extraBank?: boolean } = { members: [5000, 5000] },
    ) {
      const user = await createTestUser({ role: 'OPERATOR' });
      const token = getAuthToken(user);
      const financiera = await createTestEntity({ type: 'FIRM' });
      const sociedad = await createTestEntity({ type: 'COMPANY' });
      const accounts = await createTestAccounts(financiera.id);
      const period = await createTestPeriod();

      const suffix = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
      const memberAccounts = [] as { id: string }[];
      for (let i = 0; i < opts.members.length; i++) {
        const socio = await createTestEntity({ type: 'PERSON', name: `Socio ${i}` });
        const cc = await prisma.account.create({
          data: {
            entityId: socio.id,
            name: `CC Socio ${i}`,
            path: `OwnerCurrent:Test:${i}:${suffix}`,
            type: 'OWNER_CURRENT',
            currency: 'ARS',
            normalBalance: 'DEBIT',
          },
        });
        memberAccounts.push(cc);
        await prisma.sociedadMember.create({
          data: { sociedadId: sociedad.id, accountId: cc.id, percentBps: opts.members[i] },
        });
      }

      if (opts.extraBank) {
        // Also attach the bank to the sociedad at 0% so real-life seed matches
        await prisma.sociedadMember.create({
          data: { sociedadId: sociedad.id, accountId: accounts.bankARS.id, percentBps: 0 },
        });
      }

      return { user, token, sociedad, accounts, period, memberAccounts };
    }

    it('50/50 expense paid from bank → 3 entries (CREDIT bank, DEBIT CC1, DEBIT CC2)', async () => {
      const { token, sociedad, accounts, period, memberAccounts } = await setupSociedad({
        members: [5000, 5000],
        extraBank: true,
      });

      const res = await app.inject({
        method: 'POST', url: '/api/transactions', headers: authHeader(token),
        payload: {
          periodId: period.id,
          description: 'ABL obra',
          type: 'EXPENSE',
          sociedadId: sociedad.id,
          entries: [
            { accountId: accounts.bankARS.id, type: 'CREDIT', amount: '1000' },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.entries).toHaveLength(3);

      const bankEntry = body.entries.find((e: any) => e.accountId === accounts.bankARS.id);
      expect(bankEntry.type).toBe('CREDIT');
      expect(bankEntry.amount).toBe(1000);

      const memberEntries = body.entries.filter(
        (e: any) => e.accountId === memberAccounts[0].id || e.accountId === memberAccounts[1].id,
      );
      expect(memberEntries).toHaveLength(2);
      for (const me of memberEntries) {
        expect(me.type).toBe('DEBIT');
        expect(me.amount).toBe(500);
      }
    });

    it('60/40 income collected to cash → 3 entries with 60/40 split', async () => {
      const { token, sociedad, accounts, period, memberAccounts } = await setupSociedad({
        members: [6000, 4000],
      });

      const res = await app.inject({
        method: 'POST', url: '/api/transactions', headers: authHeader(token),
        payload: {
          periodId: period.id,
          description: 'Alquiler obra',
          type: 'INCOME',
          sociedadId: sociedad.id,
          entries: [
            { accountId: accounts.cashARS.id, type: 'DEBIT', amount: '1000' },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.entries).toHaveLength(3);

      const m0 = body.entries.find((e: any) => e.accountId === memberAccounts[0].id);
      const m1 = body.entries.find((e: any) => e.accountId === memberAccounts[1].id);
      expect(m0.type).toBe('CREDIT');
      expect(m0.amount).toBe(600);
      expect(m1.type).toBe('CREDIT');
      expect(m1.amount).toBe(400);
    });

    it('sociedadId null → no distribution, persists entries as-is', async () => {
      const user = await createTestUser({ role: 'OPERATOR' });
      const token = getAuthToken(user);
      const entity = await createTestEntity();
      const accounts = await createTestAccounts(entity.id);
      const period = await createTestPeriod();

      const res = await app.inject({
        method: 'POST', url: '/api/transactions', headers: authHeader(token),
        payload: {
          periodId: period.id,
          description: 'Sin sociedad',
          type: 'INCOME',
          entries: [
            { accountId: accounts.cashARS.id, type: 'DEBIT', amount: '5000' },
            { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: '5000' },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().entries).toHaveLength(2);
    });

    it('reverse cascades: inverse transaction mirrors all entries including distributions', async () => {
      const { token, sociedad, accounts, period, memberAccounts } = await setupSociedad({
        members: [5000, 5000],
      });

      const createRes = await app.inject({
        method: 'POST', url: '/api/transactions', headers: authHeader(token),
        payload: {
          periodId: period.id,
          description: 'Gasto con socios',
          type: 'EXPENSE',
          sociedadId: sociedad.id,
          entries: [
            { accountId: accounts.bankARS.id, type: 'CREDIT', amount: '1000' },
          ],
        },
      });
      const txnId = createRes.json().id;

      const reverseRes = await app.inject({
        method: 'POST',
        url: `/api/transactions/${txnId}/reverse`,
        headers: authHeader(token),
        payload: { reason: 'error de carga' },
      });

      expect(reverseRes.statusCode).toBe(201);
      const reversal = reverseRes.json();
      expect(reversal.entries).toHaveLength(3);

      const bankReverse = reversal.entries.find((e: any) => e.accountId === accounts.bankARS.id);
      expect(bankReverse.type).toBe('DEBIT');
      expect(bankReverse.amount).toBe(1000);

      for (const mAcc of memberAccounts) {
        const mReverse = reversal.entries.find((e: any) => e.accountId === mAcc.id);
        expect(mReverse.type).toBe('CREDIT');
        expect(mReverse.amount).toBe(500);
      }
    });

    it('33/33/34 rounding: 100 centavos on 3 members splits as 34/33/33 (largest remainder)', async () => {
      const { token, sociedad, accounts, period, memberAccounts } = await setupSociedad({
        members: [3333, 3333, 3334],
      });

      const res = await app.inject({
        method: 'POST', url: '/api/transactions', headers: authHeader(token),
        payload: {
          periodId: period.id,
          description: '100 centavos tripartito',
          type: 'INCOME',
          sociedadId: sociedad.id,
          entries: [
            { accountId: accounts.cashARS.id, type: 'DEBIT', amount: '100' },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.entries).toHaveLength(4);

      const memberAmounts = memberAccounts
        .map((m) => body.entries.find((e: any) => e.accountId === m.id).amount)
        .sort((a: number, b: number) => b - a);

      expect(memberAmounts).toEqual([34, 33, 33]);
      const total = memberAmounts.reduce((s: number, n: number) => s + n, 0);
      expect(total).toBe(100);
    });

    it('rejects when sociedad has no members in the origin currency', async () => {
      const user = await createTestUser({ role: 'OPERATOR' });
      const token = getAuthToken(user);
      const financiera = await createTestEntity({ type: 'FIRM' });
      const sociedad = await createTestEntity({ type: 'COMPANY' });
      const accounts = await createTestAccounts(financiera.id);
      const period = await createTestPeriod();

      const res = await app.inject({
        method: 'POST', url: '/api/transactions', headers: authHeader(token),
        payload: {
          periodId: period.id,
          description: 'sociedad vacía',
          type: 'EXPENSE',
          sociedadId: sociedad.id,
          entries: [
            { accountId: accounts.bankARS.id, type: 'CREDIT', amount: '1000' },
          ],
        },
      });

      expect(res.statusCode).toBe(422);
      expect(res.json().error.code).toBe('SOCIEDAD_WITHOUT_MEMBERS');
    });

    it('rejects when member percentages do not sum to 100%', async () => {
      const { token, sociedad, accounts, period } = await setupSociedad({
        members: [4000, 4000], // 80% total
      });

      const res = await app.inject({
        method: 'POST', url: '/api/transactions', headers: authHeader(token),
        payload: {
          periodId: period.id,
          description: '% inválido',
          type: 'EXPENSE',
          sociedadId: sociedad.id,
          entries: [
            { accountId: accounts.bankARS.id, type: 'CREDIT', amount: '1000' },
          ],
        },
      });

      expect(res.statusCode).toBe(422);
      expect(res.json().error.code).toBe('MEMBER_PERCENTAGES_INVALID');
    });

    it('rejects when origin account is not CASH/BANK', async () => {
      const { token, sociedad, accounts, period } = await setupSociedad({
        members: [5000, 5000],
      });

      const res = await app.inject({
        method: 'POST', url: '/api/transactions', headers: authHeader(token),
        payload: {
          periodId: period.id,
          description: 'origen inválido',
          type: 'EXPENSE',
          sociedadId: sociedad.id,
          entries: [
            { accountId: accounts.expenseARS.id, type: 'DEBIT', amount: '1000' },
          ],
        },
      });

      expect(res.statusCode).toBe(422);
      expect(res.json().error.code).toBe('INVALID_ORIGIN_ACCOUNT');
    });
  });
});
