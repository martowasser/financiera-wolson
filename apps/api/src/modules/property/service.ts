import prisma from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';
import type { PropertyType } from '@prisma/client';

interface ListFilters {
  entityId?: string;
  type?: PropertyType;
  search?: string;
  isActive?: boolean;
}

export async function list(filters?: ListFilters) {
  const where: any = {};

  if (filters?.entityId) {
    where.entityId = filters.entityId;
  }

  if (filters?.type) {
    where.type = filters.type;
  }

  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive;
  } else {
    where.deletedAt = null;
  }

  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { address: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  return prisma.property.findMany({
    where,
    include: {
      entity: { select: { id: true, name: true, type: true } },
      _count: { select: { leases: true } },
    },
    orderBy: { name: 'asc' },
  });
}

export async function getById(id: string) {
  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      entity: { select: { id: true, name: true, type: true } },
      leases: {
        where: { deletedAt: null },
        include: {
          tenant: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!property) {
    throw notFound('Property not found');
  }

  return property;
}

interface CreatePropertyData {
  entityId: string;
  name: string;
  address?: string;
  type?: PropertyType;
  notes?: string;
}

export async function create(data: CreatePropertyData) {
  return prisma.property.create({
    data,
    include: {
      entity: { select: { id: true, name: true, type: true } },
    },
  });
}

interface UpdatePropertyData {
  name?: string;
  address?: string;
  type?: PropertyType;
  notes?: string;
  isActive?: boolean;
}

export async function update(id: string, data: UpdatePropertyData) {
  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing) {
    throw notFound('Property not found');
  }

  return prisma.property.update({
    where: { id },
    data,
    include: {
      entity: { select: { id: true, name: true, type: true } },
    },
  });
}

export async function softDelete(id: string) {
  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing) {
    throw notFound('Property not found');
  }

  return prisma.property.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      isActive: false,
    },
  });
}
