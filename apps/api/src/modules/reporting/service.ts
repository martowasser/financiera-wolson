import prisma from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';

function computeBalance(account: { normalBalance: string; debitsPosted: bigint; creditsPosted: bigint }): bigint {
  return account.normalBalance === 'DEBIT'
    ? account.debitsPosted - account.creditsPosted
    : account.creditsPosted - account.debitsPosted;
}

export async function getEntityBalances(entityId: string) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } });
  if (!entity) throw notFound('Entidad no encontrada');

  const accounts = await prisma.account.findMany({
    where: { entityId, isActive: true },
    orderBy: { path: 'asc' },
  });

  return accounts.map(a => ({
    id: a.id,
    name: a.name,
    path: a.path,
    type: a.type,
    currency: a.currency,
    debitsPosted: a.debitsPosted.toString(),
    creditsPosted: a.creditsPosted.toString(),
    balance: computeBalance(a).toString(),
  }));
}

export async function getWeightedBalances(ownerId: string) {
  const ownerships = await prisma.ownership.findMany({
    where: { ownerId, validUntil: null },
    include: {
      entity: {
        include: {
          accounts: { where: { isActive: true } },
        },
      },
    },
  });

  const result: Record<string, { currency: string; totalBalance: bigint; details: any[] }> = {};

  for (const ownership of ownerships) {
    for (const account of ownership.entity.accounts) {
      const balance = computeBalance(account);
      const weightedBalance = (balance * BigInt(ownership.percentage)) / 10000n;
      const key = account.currency;

      if (!result[key]) {
        result[key] = { currency: key, totalBalance: 0n, details: [] };
      }

      result[key].totalBalance += weightedBalance;
      result[key].details.push({
        entityName: ownership.entity.name,
        accountName: account.name,
        accountPath: account.path,
        percentage: ownership.percentage,
        accountBalance: balance.toString(),
        weightedBalance: weightedBalance.toString(),
      });
    }
  }

  return Object.values(result).map(r => ({
    currency: r.currency,
    totalBalance: r.totalBalance.toString(),
    details: r.details,
  }));
}

export async function getMovementsByPeriod(periodId: string) {
  const period = await prisma.period.findUnique({ where: { id: periodId } });
  if (!period) throw notFound('Período no encontrado');

  const transactions = await prisma.transaction.findMany({
    where: { periodId, status: 'CONFIRMED' },
    include: {
      entries: { include: { account: { select: { id: true, name: true, path: true, currency: true } } } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const summary: Record<string, { count: number; totalAmount: bigint }> = {};
  for (const txn of transactions) {
    if (!summary[txn.type]) summary[txn.type] = { count: 0, totalAmount: 0n };
    summary[txn.type].count++;
    const debitTotal = txn.entries
      .filter(e => e.type === 'DEBIT')
      .reduce((sum, e) => sum + e.amount, 0n);
    summary[txn.type].totalAmount += debitTotal;
  }

  return {
    period: { id: period.id, date: period.date, status: period.status },
    transactionCount: transactions.length,
    summary: Object.entries(summary).map(([type, data]) => ({
      type,
      count: data.count,
      totalAmount: data.totalAmount.toString(),
    })),
    transactions: transactions.map(t => ({
      ...t,
      entries: t.entries.map(e => ({ ...e, amount: e.amount.toString() })),
    })),
  };
}

export async function getLeaseStatus() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const leases = await prisma.lease.findMany({
    where: { isActive: true },
    include: {
      property: { select: { id: true, name: true, address: true } },
      tenant: { select: { id: true, name: true } },
      invoices: {
        where: { periodMonth: currentMonth, periodYear: currentYear },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  return leases.map(lease => {
    const latestInvoice = lease.invoices[0];
    let status: 'PAID' | 'PENDING' | 'NO_INVOICE';
    if (!latestInvoice) {
      status = 'NO_INVOICE';
    } else if (latestInvoice.status === 'PAID') {
      status = 'PAID';
    } else {
      status = 'PENDING';
    }

    return {
      leaseId: lease.id,
      property: lease.property,
      tenant: lease.tenant,
      currency: lease.currency,
      baseAmount: lease.baseAmount.toString(),
      managedBy: lease.managedBy,
      status,
      currentInvoice: latestInvoice
        ? {
            id: latestInvoice.id,
            code: latestInvoice.code,
            status: latestInvoice.status,
            netAmount: latestInvoice.netAmount.toString(),
          }
        : null,
    };
  });
}

export async function getCashFlowSummary(periodId: string) {
  const period = await prisma.period.findUnique({ where: { id: periodId } });
  if (!period) throw notFound('Período no encontrado');

  // Get all CASH accounts
  const cashAccounts = await prisma.account.findMany({
    where: { type: 'CASH', isActive: true },
  });

  // Get entries for cash accounts in this period
  const entries = await prisma.entry.findMany({
    where: {
      accountId: { in: cashAccounts.map(a => a.id) },
      transaction: { periodId, status: 'CONFIRMED' },
    },
    include: {
      account: { select: { currency: true } },
      transaction: { select: { description: true, type: true } },
    },
  });

  const byCurrency: Record<string, { inflows: bigint; outflows: bigint }> = {};

  for (const entry of entries) {
    const key = entry.account.currency;
    if (!byCurrency[key]) byCurrency[key] = { inflows: 0n, outflows: 0n };

    if (entry.type === 'DEBIT') {
      byCurrency[key].inflows += entry.amount;
    } else {
      byCurrency[key].outflows += entry.amount;
    }
  }

  return Object.entries(byCurrency).map(([currency, data]) => ({
    currency,
    inflows: data.inflows.toString(),
    outflows: data.outflows.toString(),
    netFlow: (data.inflows - data.outflows).toString(),
  }));
}
