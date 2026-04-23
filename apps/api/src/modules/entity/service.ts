import prisma from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';
import type { EntityType } from '@prisma/client';

interface ListFilters {
  type?: EntityType;
  search?: string;
  isActive?: boolean;
  onlySociedades?: boolean;
}

export async function list(filters?: ListFilters) {
  const where: any = {};

  if (filters?.type) {
    where.type = filters.type;
  }

  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive;
  } else {
    where.deletedAt = null;
  }

  if (filters?.search) {
    where.name = { contains: filters.search, mode: 'insensitive' };
  }

  if (filters?.onlySociedades) {
    // A valid sociedad is a COMPANY whose SociedadMember entries with percentBps > 0 sum to 10000 (100%).
    const memberSums = await prisma.sociedadMember.groupBy({
      by: ['sociedadId'],
      where: { percentBps: { gt: 0 } },
      _sum: { percentBps: true },
    });
    const validSociedadIds = memberSums
      .filter((m) => m._sum.percentBps === 10000)
      .map((m) => m.sociedadId);
    where.type = 'COMPANY';
    where.id = { in: validSociedadIds };
  }

  const entities = await prisma.entity.findMany({
    where,
    include: {
      _count: {
        select: {
          accounts: true,
          ownerships: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return entities;
}

export async function getById(id: string) {
  const entity = await prisma.entity.findUnique({
    where: { id },
    include: {
      accounts: { where: { isActive: true } },
      ownerships: {
        where: { validUntil: null },
        include: { owner: { select: { id: true, name: true, type: true } } },
      },
      _count: {
        select: {
          accounts: true,
          ownerships: true,
          properties: true,
        },
      },
    },
  });

  if (!entity) {
    throw notFound('Entity not found');
  }

  return entity;
}

interface CreateEntityData {
  name: string;
  type: EntityType;
  taxId?: string;
  notes?: string;
}

export async function create(data: CreateEntityData) {
  return prisma.entity.create({ data });
}

interface UpdateEntityData {
  name?: string;
  type?: EntityType;
  taxId?: string;
  notes?: string;
  isActive?: boolean;
}

export async function update(id: string, data: UpdateEntityData) {
  const existing = await prisma.entity.findUnique({ where: { id } });
  if (!existing) {
    throw notFound('Entity not found');
  }

  return prisma.entity.update({ where: { id }, data });
}

export async function softDelete(id: string) {
  const existing = await prisma.entity.findUnique({ where: { id } });
  if (!existing) {
    throw notFound('Entity not found');
  }

  return prisma.entity.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      isActive: false,
    },
  });
}
