import prisma from '../../lib/prisma.js';
import { conflict, notFound } from '../../lib/errors.js';
import type { CreateBancoInput, UpdateBancoInput } from './schemas.js';
import type { Prisma } from '@prisma/client';

const sociedadSelect = { sociedad: { select: { id: true, name: true } } } as const;

export async function listBancos(opts: { sociedadId?: string; q?: string; active?: 'true' | 'false'; showArchived?: 'true' | 'false' }) {
  const where: Prisma.BancoWhereInput = {};
  if (opts.showArchived !== 'true') where.deletedAt = null;
  if (opts.sociedadId) where.sociedadId = opts.sociedadId;
  if (opts.active === 'true') where.isActive = true;
  if (opts.active === 'false') where.isActive = false;
  if (opts.q) {
    where.OR = [
      { nombre: { contains: opts.q, mode: 'insensitive' } },
      { numero: { contains: opts.q, mode: 'insensitive' } },
    ];
  }
  return prisma.banco.findMany({
    where,
    orderBy: { nombre: 'asc' },
    include: sociedadSelect,
  });
}

export async function getBanco(id: string) {
  const banco = await prisma.banco.findUnique({
    where: { id },
    include: sociedadSelect,
  });
  if (!banco || banco.deletedAt) throw notFound('Banco no encontrado');
  return banco;
}

export async function createBanco(input: CreateBancoInput) {
  const sociedad = await prisma.sociedad.findUnique({ where: { id: input.sociedadId } });
  if (!sociedad || sociedad.deletedAt) throw notFound('Sociedad no encontrada');

  const existing = await prisma.banco.findUnique({ where: { sociedadId: input.sociedadId } });
  if (existing && !existing.deletedAt) {
    throw conflict('La sociedad ya tiene un banco asociado', 'BANCO_ALREADY_EXISTS_FOR_SOCIEDAD');
  }

  return prisma.banco.create({
    data: {
      sociedadId: input.sociedadId,
      nombre: input.nombre,
      numero: input.numero,
      notes: input.notes ?? null,
    },
    include: sociedadSelect,
  });
}

export async function updateBanco(id: string, input: UpdateBancoInput) {
  await getBanco(id);
  const data: Prisma.BancoUpdateInput = {};
  if (input.nombre !== undefined) data.nombre = input.nombre;
  if (input.numero !== undefined) data.numero = input.numero;
  if (input.notes !== undefined) data.notes = input.notes ?? null;
  return prisma.banco.update({ where: { id }, data, include: sociedadSelect });
}

export async function cerrarBanco(id: string) {
  const banco = await getBanco(id);
  if (!banco.isActive) return banco;
  return prisma.banco.update({
    where: { id },
    data: { isActive: false },
    include: sociedadSelect,
  });
}

export async function reabrirBanco(id: string) {
  const banco = await getBanco(id);
  if (banco.isActive) return banco;
  return prisma.banco.update({
    where: { id },
    data: { isActive: true },
    include: sociedadSelect,
  });
}

export async function deleteBanco(id: string) {
  await getBanco(id);
  // Soft-delete (archivar). Los movimientos históricos no bloquean — quedan
  // apuntando al banco archivado vía FK nullable.
  return prisma.banco.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
    include: sociedadSelect,
  });
}

export async function recalcularSaldo(id: string) {
  await getBanco(id);

  // Per-moneda sums: destino (+) minus origen (-). groupBy keeps this to two queries.
  const [destinos, origenes] = await Promise.all([
    prisma.movimiento.groupBy({
      by: ['moneda'],
      where: { destinoBancoId: id },
      _sum: { monto: true },
    }),
    prisma.movimiento.groupBy({
      by: ['moneda'],
      where: { origenBancoId: id },
      _sum: { monto: true },
    }),
  ]);

  const totals: Record<string, bigint> = { ARS: 0n, USD: 0n };
  for (const row of destinos) {
    totals[row.moneda] = (totals[row.moneda] ?? 0n) + (row._sum.monto ?? 0n);
  }
  for (const row of origenes) {
    totals[row.moneda] = (totals[row.moneda] ?? 0n) - (row._sum.monto ?? 0n);
  }

  return prisma.banco.update({
    where: { id },
    data: { saldoArs: totals.ARS ?? 0n, saldoUsd: totals.USD ?? 0n },
    include: sociedadSelect,
  });
}
