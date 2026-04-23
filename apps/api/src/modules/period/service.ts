import prisma from '../../lib/prisma.js';
import { notFound, conflict } from '../../lib/errors.js';
import { businessToday, toBusinessDate } from '../../lib/business-date.js';

// ─── Get or create today's period ───────────────────────────────────────────

export async function getOrCreateToday() {
  const today = businessToday();

  const existing = await prisma.period.findUnique({ where: { date: today } });
  if (existing) return existing;

  const period = await prisma.period.create({
    data: { date: today, status: 'OPEN' },
  });

  return period;
}

// ─── List periods ───────────────────────────────────────────────────────────

interface ListFilters {
  status?: string;
}

export async function list(filters: ListFilters = {}) {
  const where: Record<string, unknown> = {};

  if (filters.status) where.status = filters.status;

  return prisma.period.findMany({
    where,
    orderBy: { date: 'desc' },
  });
}

// ─── Get period by ID ───────────────────────────────────────────────────────

export async function getById(id: string) {
  const period = await prisma.period.findUnique({ where: { id } });

  if (!period) {
    throw notFound('Periodo no encontrado');
  }

  return period;
}

// ─── Get period by date ─────────────────────────────────────────────────────

export async function getByDate(date: Date) {
  const normalized = toBusinessDate(date);

  const period = await prisma.period.findUnique({ where: { date: normalized } });

  if (!period) {
    throw notFound('No existe un periodo para esta fecha');
  }

  return period;
}

// ─── Close period ───────────────────────────────────────────────────────────

export async function close(id: string, userId: string, closingNotes?: string) {
  return prisma.$transaction(async (tx) => {
    // 1. Find the period and verify it's OPEN
    const period = await tx.period.findUnique({ where: { id } });

    if (!period) {
      throw notFound('Periodo no encontrado');
    }

    if (period.status === 'CLOSED') {
      throw conflict('El periodo ya se encuentra cerrado', 'PERIOD_ALREADY_CLOSED', {
        periodId: period.id,
        closedAt: period.closedAt,
      });
    }

    // 2. Take a snapshot of all account balances
    const accounts = await tx.account.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        path: true,
        type: true,
        currency: true,
        normalBalance: true,
        debitsPosted: true,
        creditsPosted: true,
      },
    });

    const closingBalances = accounts.map((account) => {
      const balance =
        account.normalBalance === 'DEBIT'
          ? account.debitsPosted - account.creditsPosted
          : account.creditsPosted - account.debitsPosted;

      return {
        accountId: account.id,
        name: account.name,
        path: account.path,
        type: account.type,
        currency: account.currency,
        normalBalance: account.normalBalance,
        debitsPosted: account.debitsPosted.toString(),
        creditsPosted: account.creditsPosted.toString(),
        balance: balance.toString(),
      };
    });

    // 3. Update period
    const closedPeriod = await tx.period.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closedById: userId,
        closingNotes: closingNotes ?? null,
        closingBalances: closingBalances as any,
      },
    });

    // 4. Create audit log entry
    await tx.auditLog.create({
      data: {
        userId,
        action: 'period.close',
        entityType: 'Period',
        entityId: period.id,
        details: {
          date: period.date.toISOString().split('T')[0],
          accountsSnapshot: closingBalances.length,
        },
      },
    });

    return closedPeriod;
  });
}
