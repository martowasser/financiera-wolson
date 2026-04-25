import prisma from '../../lib/prisma.js';
import { notFound, unprocessable } from '../../lib/errors.js';
import type {
  CreatePropiedadInput,
  UpdatePropiedadInput,
  ListPropiedadesQuery,
} from './schemas.js';
import type { Prisma } from '@prisma/client';

export async function listPropiedades(opts: ListPropiedadesQuery) {
  const where: Prisma.PropiedadWhereInput = { deletedAt: null };
  if (opts.sociedadId) where.sociedadId = opts.sociedadId;
  if (opts.active === 'true') where.isActive = true;
  if (opts.active === 'false') where.isActive = false;
  if (opts.q) {
    where.OR = [
      { nombre: { contains: opts.q, mode: 'insensitive' } },
      { direccion: { contains: opts.q, mode: 'insensitive' } },
    ];
  }
  return prisma.propiedad.findMany({
    where,
    orderBy: { nombre: 'asc' },
    include: {
      sociedad: { select: { id: true, name: true } },
      // Active-alquileres count surfaces occupancy at-a-glance in the list view.
      _count: { select: { alquileres: { where: { status: 'ACTIVO', deletedAt: null } } } },
    },
  });
}

export async function getPropiedad(id: string) {
  const propiedad = await prisma.propiedad.findUnique({
    where: { id },
    include: {
      sociedad: { select: { id: true, name: true } },
      alquileres: {
        where: { deletedAt: null, status: { in: ['ACTIVO', 'FINALIZADO'] } },
        orderBy: [{ status: 'asc' }, { fechaInicio: 'desc' }],
        select: {
          id: true,
          numero: true,
          status: true,
          fechaInicio: true,
          fechaFin: true,
          finalizadoEn: true,
          inquilino: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!propiedad || propiedad.deletedAt) throw notFound('Propiedad no encontrada');
  return propiedad;
}

export async function createPropiedad(input: CreatePropiedadInput) {
  // Parent sociedad must exist and not be deleted — avoids dangling FKs on soft-deleted owners.
  const sociedad = await prisma.sociedad.findUnique({ where: { id: input.sociedadId } });
  if (!sociedad || sociedad.deletedAt) {
    throw unprocessable('Sociedad no encontrada o eliminada', 'SOCIEDAD_NOT_FOUND');
  }
  return prisma.propiedad.create({
    data: {
      sociedadId: input.sociedadId,
      nombre: input.nombre,
      direccion: input.direccion,
      descripcion: input.descripcion ?? null,
      notes: input.notes ?? null,
    },
  });
}

export async function updatePropiedad(id: string, input: UpdatePropiedadInput) {
  const existing = await prisma.propiedad.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw notFound('Propiedad no encontrada');
  const data: Prisma.PropiedadUpdateInput = {};
  if (input.nombre !== undefined) data.nombre = input.nombre;
  if (input.direccion !== undefined) data.direccion = input.direccion;
  if (input.descripcion !== undefined) data.descripcion = input.descripcion ?? null;
  if (input.notes !== undefined) data.notes = input.notes ?? null;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  return prisma.propiedad.update({ where: { id }, data });
}

export async function deletePropiedad(id: string) {
  const existing = await prisma.propiedad.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw notFound('Propiedad no encontrada');
  // Block soft-delete while active alquileres or any historic movimientos reference this propiedad,
  // so ABL/expensas history and current rentals stay intact.
  const [activeAlquileres, movimientos] = await Promise.all([
    prisma.alquiler.count({ where: { propiedadId: id, status: 'ACTIVO', deletedAt: null } }),
    prisma.movimiento.count({ where: { propiedadId: id } }),
  ]);
  if (activeAlquileres > 0 || movimientos > 0) {
    throw unprocessable(
      'No se puede eliminar: la propiedad tiene alquileres activos o movimientos asociados',
      'PROPIEDAD_HAS_DEPENDENCIES',
    );
  }
  return prisma.propiedad.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
}
