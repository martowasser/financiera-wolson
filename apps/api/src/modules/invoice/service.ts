import prisma from '../../lib/prisma.js';
import { notFound, unprocessable } from '../../lib/errors.js';
import { getOrCreateToday } from '../period/service.js';
import type { InvoiceStatus, PaymentMethod } from '@prisma/client';

interface ListFilters {
  leaseId?: string;
  status?: InvoiceStatus;
  periodMonth?: number;
  periodYear?: number;
}

export async function list(filters?: ListFilters) {
  const where: any = {};

  if (filters?.leaseId) {
    where.leaseId = filters.leaseId;
  }

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.periodMonth) {
    where.periodMonth = filters.periodMonth;
  }

  if (filters?.periodYear) {
    where.periodYear = filters.periodYear;
  }

  return prisma.invoice.findMany({
    where,
    include: {
      lease: {
        include: {
          property: { select: { id: true, name: true, address: true } },
        },
      },
      retentions: true,
    },
    orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
  });
}

export async function getById(id: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      lease: {
        include: {
          property: { select: { id: true, name: true, address: true } },
          tenant: { select: { id: true, name: true, type: true } },
        },
      },
      retentions: true,
      transactions: {
        include: { entries: true },
      },
    },
  });

  if (!invoice) {
    throw notFound('Invoice not found');
  }

  return invoice;
}

interface CreateInvoiceData {
  leaseId: string;
  periodMonth: number;
  periodYear: number;
  baseAmount: bigint;
  vatAmount?: bigint;
  retentions?: Array<{ concept: string; amount: bigint; notes?: string }>;
  notes?: string;
}

async function generateInvoiceCode(periodYear: number, periodMonth: number): Promise<string> {
  const yearStr = String(periodYear);
  const monthStr = String(periodMonth).padStart(2, '0');

  // Count existing invoices for this period to generate sequential number
  const count = await prisma.invoice.count({
    where: { periodYear, periodMonth },
  });

  const sequential = String(count + 1).padStart(6, '0');
  return `INV-${yearStr}-${monthStr}-${sequential}`;
}

export async function create(data: CreateInvoiceData) {
  const { retentions, ...invoiceFields } = data;

  const vatAmount = data.vatAmount ?? 0n;
  const totalAmount = data.baseAmount + vatAmount;
  const totalRetentions = retentions
    ? retentions.reduce((sum, r) => sum + r.amount, 0n)
    : 0n;
  const netAmount = totalAmount - totalRetentions;

  const code = await generateInvoiceCode(data.periodYear, data.periodMonth);

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({
      data: {
        leaseId: invoiceFields.leaseId,
        code,
        periodMonth: invoiceFields.periodMonth,
        periodYear: invoiceFields.periodYear,
        baseAmount: invoiceFields.baseAmount,
        vatAmount,
        totalAmount,
        netAmount,
        notes: invoiceFields.notes,
        retentions: retentions && retentions.length > 0
          ? {
              create: retentions.map((r) => ({
                concept: r.concept,
                amount: r.amount,
                notes: r.notes,
              })),
            }
          : undefined,
      },
      include: {
        retentions: true,
        lease: {
          include: {
            property: { select: { id: true, name: true } },
          },
        },
      },
    });

    return invoice;
  });
}

interface CollectPaymentData {
  paymentMethod: PaymentMethod;
  checkNumber?: string;
  bankReference?: string;
  debitAccountId: string;
  creditAccountId: string;
  notes?: string;
}

export async function collect(invoiceId: string, userId: string, paymentData: CollectPaymentData) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lease: true },
  });

  if (!invoice) {
    throw notFound('Invoice not found');
  }

  if (invoice.status !== 'PENDING' && invoice.status !== 'PARTIAL') {
    throw unprocessable(`Cannot collect invoice with status ${invoice.status}`);
  }

  // Get or create today's period
  const period = await getOrCreateToday();

  // Generate transaction code
  const txCount = await prisma.transaction.count();
  const txCode = `TXN-${String(txCount + 1).padStart(8, '0')}`;

  return prisma.$transaction(async (tx) => {
    // Create the ledger transaction
    const transaction = await tx.transaction.create({
      data: {
        periodId: period.id,
        code: txCode,
        description: `Cobro alquiler ${invoice.code}`,
        type: 'INCOME',
        paymentMethod: paymentData.paymentMethod,
        checkNumber: paymentData.checkNumber,
        bankReference: paymentData.bankReference,
        invoiceId: invoice.id,
        notes: paymentData.notes,
        createdById: userId,
        entries: {
          create: [
            {
              accountId: paymentData.debitAccountId,
              type: 'DEBIT',
              amount: invoice.netAmount,
              description: `Cobro alquiler ${invoice.code}`,
            },
            {
              accountId: paymentData.creditAccountId,
              type: 'CREDIT',
              amount: invoice.netAmount,
              description: `Cobro alquiler ${invoice.code}`,
            },
          ],
        },
      },
      include: { entries: true },
    });

    // Update account running totals
    await tx.account.update({
      where: { id: paymentData.debitAccountId },
      data: { debitsPosted: { increment: invoice.netAmount } },
    });

    await tx.account.update({
      where: { id: paymentData.creditAccountId },
      data: { creditsPosted: { increment: invoice.netAmount } },
    });

    // Update invoice status
    const updatedInvoice = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
      include: {
        lease: {
          include: {
            property: { select: { id: true, name: true } },
            tenant: { select: { id: true, name: true } },
          },
        },
        retentions: true,
        transactions: { include: { entries: true } },
      },
    });

    return updatedInvoice;
  });
}
