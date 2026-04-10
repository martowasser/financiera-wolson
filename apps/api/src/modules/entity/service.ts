import prisma from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';
import type { EntityType } from '@prisma/client';

interface ListFilters {
  type?: EntityType;
  search?: string;
  isActive?: boolean;
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
