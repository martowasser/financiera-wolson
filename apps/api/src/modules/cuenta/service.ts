import prisma from '../../lib/prisma.js';
import { conflict, notFound, unprocessable } from '../../lib/errors.js';
import type { CreateCuentaInput, UpdateCuentaInput } from './schemas.js';
import type { Prisma } from '@prisma/client';

export async function listCuentas(opts: { q?: string; active?: 'true' | 'false' }) {
  const where: Prisma.CuentaWhereInput = { deletedAt: null };
  if (opts.active === 'true') where.isActive = true;
  if (opts.active === 'false') where.isActive = false;
  if (opts.q) {
    where.OR = [
      { name: { contains: opts.q, mode: 'insensitive' } },
      { identifier: { contains: opts.q, mode: 'insensitive' } },
    ];
  }
  return prisma.cuenta.findMany({ where, orderBy: { name: 'asc' } });
}

export async function getCuenta(id: string) {
  const cuenta = await prisma.cuenta.findUnique({ where: { id } });
  if (!cuenta || cuenta.deletedAt) throw notFound('Cuenta no encontrada');
  return cuenta;
}

export async function createCuenta(input: CreateCuentaInput) {
  if (input.identifier) {
    const existing = await prisma.cuenta.findUnique({ where: { identifier: input.identifier } });
    if (existing) throw conflict('Ya existe una cuenta con ese identificador');
  }
  return prisma.cuenta.create({
    data: {
      name: input.name,
      identifier: input.identifier ?? null,
      notes: input.notes ?? null,
      isOwner: input.isOwner ?? false,
    },
  });
}

export async function updateCuenta(id: string, input: UpdateCuentaInput) {
  await getCuenta(id);
  if (input.identifier) {
    const existing = await prisma.cuenta.findUnique({ where: { identifier: input.identifier } });
    if (existing && existing.id !== id) throw conflict('Ya existe una cuenta con ese identificador');
  }
  const data: Prisma.CuentaUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.identifier !== undefined) data.identifier = input.identifier ?? null;
  if (input.notes !== undefined) data.notes = input.notes ?? null;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.isOwner !== undefined) data.isOwner = input.isOwner;
  return prisma.cuenta.update({ where: { id }, data });
}

export async function deleteCuenta(id: string) {
  await getCuenta(id);
  // Block soft-delete if any active membership references this cuenta.
  const [sociedadMemberships, alquilerMemberships, alquileresInquilino] = await Promise.all([
    prisma.sociedadSocio.count({ where: { cuentaId: id } }),
    prisma.alquilerSocio.count({ where: { cuentaId: id } }),
    prisma.alquiler.count({ where: { inquilinoId: id, deletedAt: null } }),
  ]);
  if (sociedadMemberships > 0 || alquilerMemberships > 0 || alquileresInquilino > 0) {
    throw unprocessable(
      'No se puede eliminar: la cuenta participa de sociedades, alquileres o como inquilino activo',
      'CUENTA_HAS_DEPENDENCIES',
    );
  }
  return prisma.cuenta.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
}

export async function getCuentaMovimientos(id: string, opts: { from?: string; to?: string } = {}) {
  await getCuenta(id);
  const where: Prisma.MovimientoWhereInput = {
    OR: [
      { origenCuentaId: id },
      { destinoCuentaId: id },
      { cuentaContraparteId: id },
    ],
  };
  if (opts.from || opts.to) {
    where.fecha = {};
    if (opts.from) where.fecha.gte = new Date(opts.from);
    if (opts.to) where.fecha.lte = new Date(opts.to);
  }
  return prisma.movimiento.findMany({
    where,
    orderBy: { fecha: 'desc' },
    take: 200,
    include: {
      bancoOrigen: { select: { id: true, nombre: true, numero: true } },
      bancoDestino: { select: { id: true, nombre: true, numero: true } },
      cuentaOrigen: { select: { id: true, name: true } },
      cuentaDestino: { select: { id: true, name: true } },
      sociedad: { select: { id: true, name: true } },
      alquiler: { select: { id: true, numero: true } },
    },
  });
}
