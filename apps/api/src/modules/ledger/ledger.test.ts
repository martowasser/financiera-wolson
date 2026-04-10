import { describe, it, expect, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { createTransaction, reverseTransaction, getById } from './service.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://financiero:financiero_test@localhost:5435/financiero_test?schema=public',
    },
  },
});

// Test helpers
async function createTestUser() {
  return prisma.user.create({
    data: {
      email: `test-${Date.now()}@test.com`,
      password: await bcrypt.hash('test123', 4),
      name: 'Test User',
      role: 'OPERATOR',
    },
  });
}

async function createTestEntity() {
  return prisma.entity.create({
    data: { name: 'Test Entity', type: 'FIRM' },
  });
}

async function createTestAccounts(entityId: string) {
  const cashARS = await prisma.account.create({
    data: {
      entityId,
      name: 'Cash ARS',
      path: `Assets:Cash:ARS:${Date.now()}`,
      type: 'CASH',
      currency: 'ARS',
      normalBalance: 'DEBIT',
    },
  });

  const incomeARS = await prisma.account.create({
    data: {
      entityId,
      name: 'Income ARS',
      path: `Income:Rental:ARS:${Date.now()}`,
      type: 'REVENUE',
      currency: 'ARS',
      normalBalance: 'CREDIT',
    },
  });

  const expenseARS = await prisma.account.create({
    data: {
      entityId,
      name: 'Expense ARS',
      path: `Expense:General:ARS:${Date.now()}`,
      type: 'EXPENSE',
      currency: 'ARS',
      normalBalance: 'DEBIT',
    },
  });

  const bankARS = await prisma.account.create({
    data: {
      entityId,
      name: 'Bank ARS',
      path: `Assets:Bank:Test:ARS:${Date.now()}`,
      type: 'BANK',
      currency: 'ARS',
      normalBalance: 'DEBIT',
    },
  });

  return { cashARS, incomeARS, expenseARS, bankARS };
}

async function createTestPeriod() {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return prisma.period.create({
    data: { date, status: 'OPEN' },
  });
}

describe('Ledger Service', () => {
  let user: any;
  let entity: any;
  let accounts: Awaited<ReturnType<typeof createTestAccounts>>;
  let period: any;

  beforeEach(async () => {
    // Clean in reverse FK order
    await prisma.auditLog.deleteMany();
    await prisma.bankReconciliationItem.deleteMany();
    await prisma.bankReconciliation.deleteMany();
    await prisma.ownerSettlement.deleteMany();
    await prisma.invoiceRetention.deleteMany();
    await prisma.entry.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.leasePrice.deleteMany();
    await prisma.lease.deleteMany();
    await prisma.property.deleteMany();
    await prisma.ownership.deleteMany();
    await prisma.account.deleteMany();
    await prisma.period.deleteMany();
    await prisma.entity.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();

    user = await createTestUser();
    entity = await createTestEntity();
    accounts = await createTestAccounts(entity.id);
    period = await createTestPeriod();
  });

  describe('createTransaction', () => {
    it('creates a balanced double-entry transaction', async () => {
      const txn = await createTransaction({
        periodId: period.id,
        description: 'Test income transaction',
        type: 'INCOME',
        paymentMethod: 'CASH',
        entries: [
          { accountId: accounts.cashARS.id, type: 'DEBIT', amount: 10000n },
          { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: 10000n },
        ],
        createdById: user.id,
      });

      expect(txn.code).toMatch(/^TXN-\d{6}$/);
      expect(txn.status).toBe('CONFIRMED');
      expect(txn.entries).toHaveLength(2);

      // Verify cached balances were updated
      const cash = await prisma.account.findUnique({ where: { id: accounts.cashARS.id } });
      expect(cash!.debitsPosted).toBe(10000n);
      expect(cash!.creditsPosted).toBe(0n);

      const income = await prisma.account.findUnique({ where: { id: accounts.incomeARS.id } });
      expect(income!.debitsPosted).toBe(0n);
      expect(income!.creditsPosted).toBe(10000n);
    });

    it('rejects unbalanced entries', async () => {
      await expect(
        createTransaction({
          periodId: period.id,
          description: 'Unbalanced',
          type: 'INCOME',
          entries: [
            { accountId: accounts.cashARS.id, type: 'DEBIT', amount: 10000n },
            { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: 5000n },
          ],
          createdById: user.id,
        })
      ).rejects.toThrow('Los entries no balancean');
    });

    it('rejects transactions with fewer than 2 entries', async () => {
      await expect(
        createTransaction({
          periodId: period.id,
          description: 'Single entry',
          type: 'INCOME',
          entries: [
            { accountId: accounts.cashARS.id, type: 'DEBIT', amount: 10000n },
          ],
          createdById: user.id,
        })
      ).rejects.toThrow(); // Fails either balance check or min-entries check
    });

    it('rejects transactions on a closed period', async () => {
      await prisma.period.update({
        where: { id: period.id },
        data: { status: 'CLOSED', closedAt: new Date() },
      });

      await expect(
        createTransaction({
          periodId: period.id,
          description: 'On closed period',
          type: 'INCOME',
          entries: [
            { accountId: accounts.cashARS.id, type: 'DEBIT', amount: 10000n },
            { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: 10000n },
          ],
          createdById: user.id,
        })
      ).rejects.toThrow('cerrado');
    });

    it('handles idempotency — returns existing transaction on duplicate key', async () => {
      const idempotencyKey = `idem-${Date.now()}`;

      const txn1 = await createTransaction({
        periodId: period.id,
        description: 'Idempotent transaction',
        type: 'INCOME',
        idempotencyKey,
        entries: [
          { accountId: accounts.cashARS.id, type: 'DEBIT', amount: 5000n },
          { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: 5000n },
        ],
        createdById: user.id,
      });

      const txn2 = await createTransaction({
        periodId: period.id,
        description: 'Duplicate attempt',
        type: 'INCOME',
        idempotencyKey,
        entries: [
          { accountId: accounts.cashARS.id, type: 'DEBIT', amount: 5000n },
          { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: 5000n },
        ],
        createdById: user.id,
      });

      expect(txn2.id).toBe(txn1.id);
      expect(txn2.code).toBe(txn1.code);

      // Balance should not be double-counted
      const cash = await prisma.account.findUnique({ where: { id: accounts.cashARS.id } });
      expect(cash!.debitsPosted).toBe(5000n);
    });

    it('creates audit log entry', async () => {
      const txn = await createTransaction({
        periodId: period.id,
        description: 'Audited transaction',
        type: 'INCOME',
        entries: [
          { accountId: accounts.cashARS.id, type: 'DEBIT', amount: 1000n },
          { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: 1000n },
        ],
        createdById: user.id,
      });

      const logs = await prisma.auditLog.findMany({
        where: { entityId: txn.id, action: 'transaction.create' },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0].userId).toBe(user.id);
    });
  });

  describe('reverseTransaction', () => {
    it('reverses a confirmed transaction', async () => {
      const original = await createTransaction({
        periodId: period.id,
        description: 'To be reversed',
        type: 'EXPENSE',
        entries: [
          { accountId: accounts.expenseARS.id, type: 'DEBIT', amount: 20000n },
          { accountId: accounts.bankARS.id, type: 'CREDIT', amount: 20000n },
        ],
        createdById: user.id,
      });

      const reversal = await reverseTransaction(original.id, user.id, 'Monto incorrecto');

      expect(reversal.type).toBe('REVERSAL');
      expect(reversal.reversesId).toBe(original.id);
      expect(reversal.description).toContain('Reversión');
      expect(reversal.entries).toHaveLength(2);

      // Verify entries are mirrored
      const debitEntry = reversal.entries.find((e: any) => e.type === 'DEBIT');
      const creditEntry = reversal.entries.find((e: any) => e.type === 'CREDIT');
      expect(debitEntry!.accountId).toBe(accounts.bankARS.id);
      expect(creditEntry!.accountId).toBe(accounts.expenseARS.id);

      // Verify original is marked REVERSED
      const updated = await prisma.transaction.findUnique({ where: { id: original.id } });
      expect(updated!.status).toBe('REVERSED');

      // Verify net balances are zero
      const expense = await prisma.account.findUnique({ where: { id: accounts.expenseARS.id } });
      expect(expense!.debitsPosted).toBe(20000n);
      expect(expense!.creditsPosted).toBe(20000n);
    });

    it('rejects reversing an already reversed transaction', async () => {
      const original = await createTransaction({
        periodId: period.id,
        description: 'Already reversed',
        type: 'EXPENSE',
        entries: [
          { accountId: accounts.expenseARS.id, type: 'DEBIT', amount: 5000n },
          { accountId: accounts.bankARS.id, type: 'CREDIT', amount: 5000n },
        ],
        createdById: user.id,
      });

      await reverseTransaction(original.id, user.id, 'First reversal');

      await expect(
        reverseTransaction(original.id, user.id, 'Second attempt')
      ).rejects.toThrow('ya fue revertida');
    });
  });

  describe('concurrent locking', () => {
    it('serializes concurrent transactions to the same account', async () => {
      // Create 5 concurrent transactions
      const promises = Array.from({ length: 5 }, (_, i) =>
        createTransaction({
          periodId: period.id,
          description: `Concurrent txn ${i}`,
          type: 'INCOME',
          entries: [
            { accountId: accounts.cashARS.id, type: 'DEBIT', amount: 1000n },
            { accountId: accounts.incomeARS.id, type: 'CREDIT', amount: 1000n },
          ],
          createdById: user.id,
        })
      );

      const results = await Promise.all(promises);

      // All should succeed
      expect(results).toHaveLength(5);

      // All should have unique codes
      const codes = results.map((r: any) => r.code);
      expect(new Set(codes).size).toBe(5);

      // Final balance should be sum of all
      const cash = await prisma.account.findUnique({ where: { id: accounts.cashARS.id } });
      expect(cash!.debitsPosted).toBe(5000n);
    });
  });
});

describe('Double Entry Trigger (PostgreSQL safety net)', () => {
  let user: any;
  let entity: any;
  let period: any;
  let accountId: string;

  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.entry.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.account.deleteMany();
    await prisma.period.deleteMany();
    await prisma.entity.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();

    user = await prisma.user.create({
      data: {
        email: `trigger-${Date.now()}@test.com`,
        password: await bcrypt.hash('test', 4),
        name: 'Trigger Test',
        role: 'OPERATOR',
      },
    });

    entity = await prisma.entity.create({
      data: { name: 'Trigger Entity', type: 'FIRM' },
    });

    const account = await prisma.account.create({
      data: {
        entityId: entity.id,
        name: 'Trigger Account',
        path: `Test:Trigger:${Date.now()}`,
        type: 'CASH',
        currency: 'ARS',
        normalBalance: 'DEBIT',
      },
    });
    accountId = account.id;

    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    period = await prisma.period.create({ data: { date, status: 'OPEN' } });
  });

  it('rejects unbalanced entries at database level (trigger)', async () => {
    // Bypass the application-level validation by using raw SQL
    await expect(
      prisma.$transaction(async (tx) => {
        const txnId = `trigger-test-${Date.now()}`;
        await tx.transaction.create({
          data: {
            id: txnId,
            periodId: period.id,
            code: `TRG-${Date.now()}`,
            description: 'Trigger test',
            type: 'INCOME',
            createdById: user.id,
          },
        });

        // Insert unbalanced entries
        await tx.entry.create({
          data: {
            transactionId: txnId,
            accountId: accountId,
            type: 'DEBIT',
            amount: 10000n,
          },
        });

        await tx.entry.create({
          data: {
            transactionId: txnId,
            accountId: accountId,
            type: 'CREDIT',
            amount: 5000n, // Intentionally wrong
          },
        });
      })
    ).rejects.toThrow(/Double entry violation/);
  });
});
