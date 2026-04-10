import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { notFound, unprocessable } from '../../lib/errors.js';

export async function list(filters?: { accountId?: string; status?: string }) {
  const where: Prisma.BankReconciliationWhereInput = {};
  if (filters?.accountId) where.accountId = filters.accountId;
  if (filters?.status) where.status = filters.status as any;

  return prisma.bankReconciliation.findMany({
    where,
    include: {
      account: { select: { id: true, name: true, path: true } },
      _count: { select: { items: true } },
    },
    orderBy: { date: 'desc' },
  });
}

export async function getById(id: string) {
  const reconciliation = await prisma.bankReconciliation.findUnique({
    where: { id },
    include: {
      account: true,
      items: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!reconciliation) throw notFound('Conciliación no encontrada');
  return reconciliation;
}

export async function create(data: { accountId: string; date: Date; bankBalance: bigint; notes?: string }) {
  const account = await prisma.account.findUnique({ where: { id: data.accountId } });
  if (!account) throw notFound('Cuenta no encontrada');

  // Calculate system balance based on normalBalance
  const systemBalance = account.normalBalance === 'DEBIT'
    ? account.debitsPosted - account.creditsPosted
    : account.creditsPosted - account.debitsPosted;

  const difference = data.bankBalance - systemBalance;

  return prisma.bankReconciliation.create({
    data: {
      accountId: data.accountId,
      date: data.date,
      bankBalance: data.bankBalance,
      systemBalance,
      difference,
      notes: data.notes,
    },
    include: { account: true },
  });
}

export async function addItem(
  reconciliationId: string,
  data: { description: string; bankAmount: bigint; externalRef?: string; importedFrom?: string; notes?: string }
) {
  const reconciliation = await prisma.bankReconciliation.findUnique({ where: { id: reconciliationId } });
  if (!reconciliation) throw notFound('Conciliación no encontrada');
  if (reconciliation.status === 'COMPLETED') {
    throw unprocessable('La conciliación ya está completada', 'RECONCILIATION_COMPLETED');
  }

  return prisma.bankReconciliationItem.create({
    data: {
      reconciliationId,
      description: data.description,
      bankAmount: data.bankAmount,
      externalRef: data.externalRef,
      importedFrom: data.importedFrom || 'manual',
      notes: data.notes,
    },
  });
}

export async function matchItem(itemId: string, transactionId: string) {
  const item = await prisma.bankReconciliationItem.findUnique({ where: { id: itemId } });
  if (!item) throw notFound('Item no encontrado');

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { entries: true },
  });
  if (!transaction) throw notFound('Transacción no encontrada');

  const totalAmount = transaction.entries.reduce((sum, e) =>
    e.type === 'DEBIT' ? sum + e.amount : sum, 0n
  );

  return prisma.bankReconciliationItem.update({
    where: { id: itemId },
    data: {
      transactionId,
      systemAmount: totalAmount,
      isReconciled: true,
    },
  });
}

export async function globalizeItems(itemIds: string[], groupLabel: string) {
  return prisma.bankReconciliationItem.updateMany({
    where: { id: { in: itemIds } },
    data: { groupLabel },
  });
}

export async function complete(id: string) {
  const reconciliation = await prisma.bankReconciliation.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!reconciliation) throw notFound('Conciliación no encontrada');

  const unreconciledCount = reconciliation.items.filter(
    i => !i.isReconciled && !i.groupLabel
  ).length;

  const status = reconciliation.difference === 0n && unreconciledCount === 0
    ? 'COMPLETED' as const
    : 'DISCREPANCY' as const;

  return prisma.bankReconciliation.update({
    where: { id },
    data: { status },
    include: { account: true, items: true },
  });
}
