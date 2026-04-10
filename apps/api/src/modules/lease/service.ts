import prisma from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';
import type { Currency, LeaseManager } from '@prisma/client';

interface ListFilters {
  propertyId?: string;
  tenantId?: string;
  isActive?: boolean;
}

export async function list(filters?: ListFilters) {
  const where: any = {};

  if (filters?.propertyId) {
    where.propertyId = filters.propertyId;
  }

  if (filters?.tenantId) {
    where.tenantId = filters.tenantId;
  }

  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive;
  } else {
    where.deletedAt = null;
  }

  return prisma.lease.findMany({
    where,
    include: {
      property: { select: { id: true, name: true, address: true } },
      tenant: { select: { id: true, name: true, type: true } },
      priceHistory: {
        orderBy: { validFrom: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getById(id: string) {
  const lease = await prisma.lease.findUnique({
    where: { id },
    include: {
      property: { select: { id: true, name: true, address: true, entityId: true } },
      tenant: { select: { id: true, name: true, type: true } },
      priceHistory: { orderBy: { validFrom: 'desc' } },
      invoices: { orderBy: { periodYear: 'desc', periodMonth: 'desc' } },
    },
  });

  if (!lease) {
    throw notFound('Lease not found');
  }

  return lease;
}

interface CreateLeaseData {
  propertyId: string;
  tenantId: string;
  currency: Currency;
  baseAmount: bigint;
  managedBy?: LeaseManager;
  thirdPartyEntityId?: string;
  startDate: Date;
  endDate?: Date;
  notes?: string;
}

export async function create(data: CreateLeaseData) {
  const { baseAmount, startDate, ...leaseData } = data;

  return prisma.$transaction(async (tx) => {
    const lease = await tx.lease.create({
      data: {
        ...leaseData,
        baseAmount,
        startDate,
      },
    });

    // Create initial LeasePrice entry
    await tx.leasePrice.create({
      data: {
        leaseId: lease.id,
        amount: baseAmount,
        validFrom: startDate,
      },
    });

    return tx.lease.findUnique({
      where: { id: lease.id },
      include: {
        property: { select: { id: true, name: true, address: true } },
        tenant: { select: { id: true, name: true, type: true } },
        priceHistory: true,
      },
    });
  });
}

interface UpdateLeaseData {
  currency?: Currency;
  managedBy?: LeaseManager;
  thirdPartyEntityId?: string | null;
  endDate?: Date;
  notes?: string;
  isActive?: boolean;
}

export async function update(id: string, data: UpdateLeaseData) {
  const existing = await prisma.lease.findUnique({ where: { id } });
  if (!existing) {
    throw notFound('Lease not found');
  }

  return prisma.lease.update({
    where: { id },
    data,
    include: {
      property: { select: { id: true, name: true, address: true } },
      tenant: { select: { id: true, name: true, type: true } },
    },
  });
}

export async function addPrice(leaseId: string, amount: bigint, validFrom: Date) {
  const lease = await prisma.lease.findUnique({ where: { id: leaseId } });
  if (!lease) {
    throw notFound('Lease not found');
  }

  return prisma.$transaction(async (tx) => {
    // Close previous price: set validUntil = validFrom - 1 day
    const previousPrice = await tx.leasePrice.findFirst({
      where: { leaseId, validUntil: null },
      orderBy: { validFrom: 'desc' },
    });

    if (previousPrice) {
      const validUntil = new Date(validFrom);
      validUntil.setDate(validUntil.getDate() - 1);

      await tx.leasePrice.update({
        where: { id: previousPrice.id },
        data: { validUntil },
      });
    }

    // Create new LeasePrice
    const newPrice = await tx.leasePrice.create({
      data: {
        leaseId,
        amount,
        validFrom,
      },
    });

    // Update lease baseAmount to the new price
    await tx.lease.update({
      where: { id: leaseId },
      data: { baseAmount: amount },
    });

    return newPrice;
  });
}

export async function softDelete(id: string) {
  const existing = await prisma.lease.findUnique({ where: { id } });
  if (!existing) {
    throw notFound('Lease not found');
  }

  return prisma.lease.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      isActive: false,
    },
  });
}
