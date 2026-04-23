import prisma from '../../lib/prisma.js';
import { notFound, unprocessable } from '../../lib/errors.js';

interface CreateOwnershipData {
  entityId: string;
  ownerId: string;
  percentage: number;
}

interface UpdateOwnershipData {
  percentage?: number;
}

async function getActiveOwnershipsSum(entityId: string, excludeId?: string): Promise<number> {
  const ownerships = await prisma.ownership.findMany({
    where: {
      entityId,
      validUntil: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { percentage: true },
  });

  return ownerships.reduce((sum, o) => sum + o.percentage, 0);
}

export async function listByEntity(entityId: string) {
  return prisma.ownership.findMany({
    where: { entityId },
    include: {
      owner: {
        select: { id: true, name: true, type: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function create(data: CreateOwnershipData) {
  if (data.percentage < 1 || data.percentage > 10000) {
    throw unprocessable('Percentage must be between 1 and 10000 (0.01% to 100%)');
  }

  // Check the entity exists
  const entity = await prisma.entity.findUnique({ where: { id: data.entityId } });
  if (!entity) {
    throw notFound('Entity not found');
  }

  // Check the owner entity exists
  const owner = await prisma.entity.findUnique({ where: { id: data.ownerId } });
  if (!owner) {
    throw notFound('Owner entity not found');
  }

  // Validate that adding this ownership would not exceed 10000 (100%)
  const currentSum = await getActiveOwnershipsSum(data.entityId);
  if (currentSum + data.percentage > 10000) {
    throw unprocessable(
      `Adding ${data.percentage / 100}% would exceed 100%. Current total: ${currentSum / 100}%, available: ${(10000 - currentSum) / 100}%`,
    );
  }

  return prisma.ownership.create({
    data: {
      entityId: data.entityId,
      ownerId: data.ownerId,
      percentage: data.percentage,
    },
    include: {
      owner: {
        select: { id: true, name: true, type: true },
      },
    },
  });
}

export async function update(id: string, data: UpdateOwnershipData) {
  const existing = await prisma.ownership.findUnique({ where: { id } });
  if (!existing) {
    throw notFound('Ownership not found');
  }

  if (existing.validUntil) {
    throw unprocessable('Cannot update an inactive ownership');
  }

  if (data.percentage !== undefined) {
    if (data.percentage < 1 || data.percentage > 10000) {
      throw unprocessable('Percentage must be between 1 and 10000 (0.01% to 100%)');
    }

    // Validate that updating would not exceed 10000 (100%)
    const currentSum = await getActiveOwnershipsSum(existing.entityId, id);
    if (currentSum + data.percentage > 10000) {
      throw unprocessable(
        `Updating to ${data.percentage / 100}% would exceed 100%. Other owners total: ${currentSum / 100}%, available: ${(10000 - currentSum) / 100}%`,
      );
    }
  }

  return prisma.ownership.update({
    where: { id },
    data,
    include: {
      owner: {
        select: { id: true, name: true, type: true },
      },
    },
  });
}

export async function deactivate(id: string) {
  const existing = await prisma.ownership.findUnique({ where: { id } });
  if (!existing) {
    throw notFound('Ownership not found');
  }

  if (existing.validUntil) {
    throw unprocessable('Ownership is already inactive');
  }

  return prisma.ownership.update({
    where: { id },
    data: { validUntil: new Date() },
    include: {
      owner: {
        select: { id: true, name: true, type: true },
      },
    },
  });
}

export async function validateOwnershipSum(entityId: string) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } });
  if (!entity) {
    throw notFound('Entity not found');
  }

  const ownerships = await prisma.ownership.findMany({
    where: {
      entityId,
      validUntil: null,
    },
    include: {
      owner: {
        select: { id: true, name: true },
      },
    },
  });

  const totalPercentage = ownerships.reduce((sum, o) => sum + o.percentage, 0);

  return {
    entityId,
    totalPercentage,
    valid: totalPercentage === 10000,
    remaining: 10000 - totalPercentage,
    ownerships: ownerships.map((o) => ({
      id: o.id,
      ownerId: o.ownerId,
      ownerName: o.owner.name,
      percentage: o.percentage,
    })),
  };
}
