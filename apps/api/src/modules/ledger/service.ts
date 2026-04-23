import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { conflict, unprocessable, notFound } from '../../lib/errors.js';
import { distribute } from '../../lib/distribute.js';

// ─── Sequential code generator ──────────────────────────────────────────────

async function getNextCode(tx: any): Promise<string> {
  const last = await tx.transaction.findFirst({
    orderBy: { code: 'desc' },
    select: { code: true },
  });
  if (!last) return 'TXN-000001';
  const num = parseInt(last.code.replace('TXN-', ''), 10) + 1;
  return `TXN-${String(num).padStart(6, '0')}`;
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface CreateTransactionInput {
  periodId: string;
  description: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'BANK_FEE' | 'ADJUSTMENT';
  paymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'CHECK' | null;
  checkNumber?: string | null;
  bankReference?: string | null;
  invoiceId?: string | null;
  sociedadId?: string | null;
  notes?: string | null;
  idempotencyKey?: string | null;
  entries: Array<{
    accountId: string;
    type: 'DEBIT' | 'CREDIT';
    amount: bigint;
    description?: string | null;
  }>;
  createdById: string;
}

type FinalEntry = {
  accountId: string;
  type: 'DEBIT' | 'CREDIT';
  amount: bigint;
  description?: string | null;
};

// ─── Create transaction (core double-entry) ─────────────────────────────────

export async function createTransaction(data: CreateTransactionInput) {
  if (data.entries.length < 1) {
    throw unprocessable('Una transacción requiere al menos 1 entry de origen', 'INSUFFICIENT_ENTRIES');
  }

  return prisma.$transaction(
    async (tx) => {
      // 1. Validate period is open
      const period = await tx.period.findUnique({ where: { id: data.periodId } });
      if (!period) throw notFound('Período no encontrado');
      if (period.status !== 'OPEN') {
        throw conflict(
          `El período ${period.date.toISOString().split('T')[0]} está cerrado`,
          'PERIOD_CLOSED',
          { periodId: period.id },
        );
      }

      // 2. Check idempotency
      if (data.idempotencyKey) {
        const existing = await tx.transaction.findUnique({
          where: { idempotencyKey: data.idempotencyKey },
          include: { entries: true },
        });
        if (existing) return existing;
      }

      // 3. Validate origin accounts exist and are active
      const originAccountIds = [...new Set(data.entries.map((e) => e.accountId))];
      const originAccounts = await tx.account.findMany({
        where: { id: { in: originAccountIds } },
      });
      if (originAccounts.length !== originAccountIds.length) {
        throw notFound('Una o más cuentas no existen');
      }
      const inactiveAccount = originAccounts.find((a) => !a.isActive);
      if (inactiveAccount) {
        throw unprocessable(
          `La cuenta ${inactiveAccount.name} está inactiva`,
          'ACCOUNT_INACTIVE',
        );
      }

      // 4. Build final entries: if sociedadId set, append auto-distribution to members
      const finalEntries: FinalEntry[] = data.entries.map((e) => ({ ...e }));

      if (data.sociedadId) {
        const sociedad = await tx.entity.findUnique({ where: { id: data.sociedadId } });
        if (!sociedad) throw notFound('Sociedad no encontrada');

        // Every origin entry must be against a CASH or BANK account (la "caja" de Mariana)
        for (const entry of data.entries) {
          const acc = originAccounts.find((a) => a.id === entry.accountId)!;
          if (acc.type !== 'CASH' && acc.type !== 'BANK') {
            throw unprocessable(
              `La cuenta de origen "${acc.name}" debe ser CASH o BANK cuando se usa sociedad`,
              'INVALID_ORIGIN_ACCOUNT',
            );
          }
        }

        // All origin accounts must share the same currency (distribution hereda moneda)
        const originCurrencies = new Set(originAccounts.map((a) => a.currency));
        if (originCurrencies.size !== 1) {
          throw unprocessable(
            'Las cuentas de origen deben compartir moneda',
            'MIXED_CURRENCY_ORIGIN',
          );
        }
        const originCurrency = originAccounts[0].currency;

        // Fetch sociedad members with % > 0 whose target account matches origin currency
        const members = await tx.sociedadMember.findMany({
          where: {
            sociedadId: data.sociedadId,
            percentBps: { gt: 0 },
            account: { type: 'OWNER_CURRENT', currency: originCurrency, isActive: true },
          },
          include: { account: true },
          orderBy: { id: 'asc' },
        });

        if (members.length === 0) {
          throw unprocessable(
            `La sociedad no tiene socios configurados en ${originCurrency}`,
            'SOCIEDAD_WITHOUT_MEMBERS',
          );
        }

        const totalBps = members.reduce((sum, m) => sum + m.percentBps, 0);
        if (totalBps !== 10000) {
          throw unprocessable(
            `Los porcentajes de los socios deben sumar 100% (actual: ${(totalBps / 100).toFixed(2)}%)`,
            'MEMBER_PERCENTAGES_INVALID',
            { totalBps },
          );
        }

        // For each origin entry, append distributed entries of the inverse type
        for (const originEntry of data.entries) {
          const inverseType = originEntry.type === 'DEBIT' ? 'CREDIT' : 'DEBIT';
          const shares = distribute(
            originEntry.amount,
            members.map((m) => ({ ownerId: m.accountId, percentage: m.percentBps })),
          );
          for (const share of shares) {
            finalEntries.push({
              accountId: share.ownerId,
              type: inverseType,
              amount: share.amount,
              description: originEntry.description ?? null,
            });
          }
        }
      }

      if (finalEntries.length < 2) {
        throw unprocessable(
          'Una transacción requiere al menos 2 entries',
          'INSUFFICIENT_ENTRIES',
        );
      }

      // 5. Balance check (always — after distribution in sociedad mode)
      const totalDebits = finalEntries
        .filter((e) => e.type === 'DEBIT')
        .reduce((sum, e) => sum + e.amount, 0n);
      const totalCredits = finalEntries
        .filter((e) => e.type === 'CREDIT')
        .reduce((sum, e) => sum + e.amount, 0n);
      if (totalDebits !== totalCredits) {
        throw unprocessable(
          `Los entries no balancean: débitos=${totalDebits}, créditos=${totalCredits}`,
          'ENTRIES_NOT_BALANCED',
          { totalDebits: totalDebits.toString(), totalCredits: totalCredits.toString() },
        );
      }

      // 6. Lock all accounts involved (origin + distributed), sorted by ID
      const allAccountIds = [...new Set(finalEntries.map((e) => e.accountId))].sort();
      await tx.$queryRaw`
        SELECT id FROM "Account"
        WHERE id = ANY(${allAccountIds}::text[])
        ORDER BY id
        FOR UPDATE
      `;

      // 7. Generate sequential code
      const code = await getNextCode(tx);

      // 8. Create transaction + entries
      const transaction = await tx.transaction.create({
        data: {
          periodId: data.periodId,
          code,
          description: data.description,
          type: data.type,
          paymentMethod: data.paymentMethod,
          checkNumber: data.checkNumber,
          bankReference: data.bankReference,
          invoiceId: data.invoiceId,
          sociedadId: data.sociedadId ?? null,
          notes: data.notes,
          idempotencyKey: data.idempotencyKey,
          createdById: data.createdById,
          entries: {
            create: finalEntries.map((e) => ({
              accountId: e.accountId,
              type: e.type,
              amount: e.amount,
              description: e.description,
            })),
          },
        },
        include: { entries: true },
      });

      // 9. Update cached balances atomically
      for (const entry of finalEntries) {
        if (entry.type === 'DEBIT') {
          await tx.$queryRaw`
            UPDATE "Account"
            SET "debitsPosted" = "debitsPosted" + ${entry.amount}::bigint,
                "updatedAt" = NOW()
            WHERE id = ${entry.accountId}
          `;
        } else {
          await tx.$queryRaw`
            UPDATE "Account"
            SET "creditsPosted" = "creditsPosted" + ${entry.amount}::bigint,
                "updatedAt" = NOW()
            WHERE id = ${entry.accountId}
          `;
        }
      }

      // 10. Audit log
      await tx.auditLog.create({
        data: {
          userId: data.createdById,
          action: 'transaction.create',
          entityType: 'Transaction',
          entityId: transaction.id,
          details: {
            code: transaction.code,
            type: transaction.type,
            entriesCount: finalEntries.length,
            sociedadId: data.sociedadId ?? null,
          },
        },
      });

      return transaction;
    },
    {
      timeout: 10000,
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    },
  );
}

// ─── Reverse transaction ────────────────────────────────────────────────────

export async function reverseTransaction(
  transactionId: string,
  userId: string,
  reason: string,
) {
  return prisma.$transaction(
    async (tx) => {
      // 1. Find original transaction with entries
      const original = await tx.transaction.findUnique({
        where: { id: transactionId },
        include: { entries: true, period: true },
      });

      if (!original) {
        throw notFound('Transacción no encontrada');
      }

      if (original.status !== 'CONFIRMED') {
        throw conflict(
          'La transacción ya fue revertida',
          'TRANSACTION_ALREADY_REVERSED',
          { transactionId: original.id, status: original.status },
        );
      }

      // 2. Determine the period for the reversal
      let periodId: string;

      if (original.period.status === 'OPEN') {
        periodId = original.periodId;
      } else {
        // Original period is closed — use today's period
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        let todayPeriod = await tx.period.findUnique({ where: { date: today } });
        if (!todayPeriod) {
          todayPeriod = await tx.period.create({
            data: { date: today, status: 'OPEN' },
          });
        }

        if (todayPeriod.status !== 'OPEN') {
          throw conflict(
            'El periodo de hoy está cerrado, no se puede revertir',
            'TODAY_PERIOD_CLOSED',
            { periodId: todayPeriod.id },
          );
        }

        periodId = todayPeriod.id;
      }

      // 3. Lock accounts (sorted by ID to prevent deadlocks)
      const accountIds = [...new Set(original.entries.map((e) => e.accountId))].sort();
      await tx.$queryRaw`
        SELECT id FROM "Account"
        WHERE id = ANY(${accountIds}::text[])
        ORDER BY id
        FOR UPDATE
      `;

      // 4. Generate code for reversal
      const code = await getNextCode(tx);

      // 5. Create reversal transaction with mirrored entries
      const mirroredEntries = original.entries.map((e) => ({
        accountId: e.accountId,
        type: (e.type === 'DEBIT' ? 'CREDIT' : 'DEBIT') as 'DEBIT' | 'CREDIT',
        amount: e.amount,
        description: `Reversión: ${e.description ?? original.description}`,
      }));

      const reversalTransaction = await tx.transaction.create({
        data: {
          periodId,
          code,
          description: `Reversión de ${original.code}: ${reason}`,
          type: 'REVERSAL',
          reversesId: original.id,
          createdById: userId,
          entries: {
            create: mirroredEntries,
          },
        },
        include: { entries: true },
      });

      // 6. Mark original as REVERSED
      await tx.transaction.update({
        where: { id: original.id },
        data: {
          status: 'REVERSED',
          reversedById: userId,
        },
      });

      // 7. Update cached balances (mirrored entries)
      for (const entry of mirroredEntries) {
        if (entry.type === 'DEBIT') {
          await tx.$queryRaw`
            UPDATE "Account"
            SET "debitsPosted" = "debitsPosted" + ${entry.amount}::bigint,
                "updatedAt" = NOW()
            WHERE id = ${entry.accountId}
          `;
        } else {
          await tx.$queryRaw`
            UPDATE "Account"
            SET "creditsPosted" = "creditsPosted" + ${entry.amount}::bigint,
                "updatedAt" = NOW()
            WHERE id = ${entry.accountId}
          `;
        }
      }

      // 8. Audit log for reversal creation
      await tx.auditLog.create({
        data: {
          userId,
          action: 'transaction.create',
          entityType: 'Transaction',
          entityId: reversalTransaction.id,
          details: {
            code: reversalTransaction.code,
            type: 'REVERSAL',
            reversesCode: original.code,
            reason,
          },
        },
      });

      // 9. Audit log for status change on original
      await tx.auditLog.create({
        data: {
          userId,
          action: 'transaction.reverse',
          entityType: 'Transaction',
          entityId: original.id,
          details: {
            originalCode: original.code,
            reversalCode: reversalTransaction.code,
            reason,
          },
        },
      });

      return reversalTransaction;
    },
    {
      timeout: 10000,
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    },
  );
}

// ─── Get transaction by ID ──────────────────────────────────────────────────

export async function getById(id: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      entries: { include: { account: true } },
      period: true,
      sociedad: { select: { id: true, name: true } },
      createdBy: {
        select: { id: true, name: true, username: true, role: true },
      },
    },
  });

  if (!transaction) {
    throw notFound('Transacción no encontrada');
  }

  return transaction;
}

// ─── List transactions with filters ─────────────────────────────────────────

interface ListFilters {
  periodId?: string;
  type?: string;
  status?: string;
  search?: string;
}

export async function list(filters: ListFilters = {}) {
  const where: Record<string, unknown> = {};

  if (filters.periodId) where.periodId = filters.periodId;
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.search) {
    where.OR = [
      { description: { contains: filters.search, mode: 'insensitive' } },
      { code: { contains: filters.search, mode: 'insensitive' } },
      { notes: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  return prisma.transaction.findMany({
    where,
    include: {
      entries: { include: { account: true } },
      sociedad: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ─── Get transactions by period ─────────────────────────────────────────────

export async function getByPeriod(periodId: string) {
  return prisma.transaction.findMany({
    where: { periodId },
    include: {
      entries: { include: { account: true } },
      sociedad: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}
