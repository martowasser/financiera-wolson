import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { notFound, unprocessable } from '../../lib/errors.js';
import { distribute } from '../../lib/distribute.js';

export async function list(filters?: { entityId?: string; status?: string }) {
  const where: Prisma.OwnerSettlementWhereInput = {};
  if (filters?.entityId) where.entityId = filters.entityId;
  if (filters?.status) where.status = filters.status as any;

  return prisma.ownerSettlement.findMany({
    where,
    include: { entity: true, createdBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getById(id: string) {
  const settlement = await prisma.ownerSettlement.findUnique({
    where: { id },
    include: { entity: true, createdBy: { select: { id: true, name: true } } },
  });
  if (!settlement) throw notFound('Liquidación no encontrada');
  return settlement;
}

export async function calculate(data: {
  entityId: string;
  periodFrom: Date;
  periodTo: Date;
  currency: 'ARS' | 'USD';
  createdById: string;
  notes?: string;
}) {
  const entity = await prisma.entity.findUnique({ where: { id: data.entityId } });
  if (!entity) throw notFound('Entidad no encontrada');

  // Get accounts for entity with matching currency
  const accounts = await prisma.account.findMany({
    where: { entityId: data.entityId, currency: data.currency, isActive: true },
  });

  const revenueAccountIds = accounts.filter(a => a.type === 'REVENUE').map(a => a.id);
  const expenseAccountIds = accounts.filter(a => a.type === 'EXPENSE').map(a => a.id);

  // Get entries in period range
  const periodCondition = {
    transaction: {
      period: {
        date: { gte: data.periodFrom, lte: data.periodTo },
      },
      status: 'CONFIRMED' as const,
    },
  };

  // Gross income = sum of credits to REVENUE accounts
  const revenueEntries = revenueAccountIds.length > 0
    ? await prisma.entry.findMany({
        where: {
          accountId: { in: revenueAccountIds },
          type: 'CREDIT',
          ...periodCondition,
        },
      })
    : [];

  const grossIncome = revenueEntries.reduce((sum, e) => sum + e.amount, 0n);

  // Total expenses = sum of debits to EXPENSE accounts
  const expenseEntries = expenseAccountIds.length > 0
    ? await prisma.entry.findMany({
        where: {
          accountId: { in: expenseAccountIds },
          type: 'DEBIT',
          ...periodCondition,
        },
      })
    : [];

  const totalExpenses = expenseEntries.reduce((sum, e) => sum + e.amount, 0n);
  const netIncome = grossIncome - totalExpenses;

  // Get active ownerships
  const ownerships = await prisma.ownership.findMany({
    where: { entityId: data.entityId, validUntil: null },
    include: { owner: true },
  });

  if (ownerships.length === 0) {
    throw unprocessable('La entidad no tiene socios activos', 'NO_ACTIVE_OWNERS');
  }

  // Distribute using largest remainder method
  const distributed = netIncome >= 0n
    ? distribute(netIncome, ownerships.map(o => ({ ownerId: o.ownerId, percentage: o.percentage })))
    : distribute(-netIncome, ownerships.map(o => ({ ownerId: o.ownerId, percentage: o.percentage })))
        .map(d => ({ ...d, amount: -d.amount }));

  const distributions = distributed.map(d => {
    const ownership = ownerships.find(o => o.ownerId === d.ownerId)!;
    return {
      ownerId: d.ownerId,
      ownerName: ownership.owner.name,
      percentage: ownership.percentage,
      amount: d.amount.toString(),
    };
  });

  return prisma.ownerSettlement.create({
    data: {
      entityId: data.entityId,
      periodFrom: data.periodFrom,
      periodTo: data.periodTo,
      currency: data.currency,
      grossIncome,
      totalExpenses,
      netIncome,
      distributions,
      createdById: data.createdById,
      notes: data.notes,
    },
    include: { entity: true },
  });
}

export async function approve(id: string) {
  const settlement = await prisma.ownerSettlement.findUnique({ where: { id } });
  if (!settlement) throw notFound('Liquidación no encontrada');
  if (settlement.status !== 'DRAFT') {
    throw unprocessable('Solo se pueden aprobar liquidaciones en estado DRAFT', 'INVALID_STATUS');
  }

  return prisma.ownerSettlement.update({
    where: { id },
    data: { status: 'APPROVED', approvedAt: new Date() },
    include: { entity: true },
  });
}
