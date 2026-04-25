import prisma from '../../lib/prisma.js';
import { conflict, notFound, unprocessable } from '../../lib/errors.js';
import type {
  CreateSociedadInput,
  UpdateSociedadInput,
  ReplaceSociosInput,
} from './schemas.js';
import type { Prisma } from '@prisma/client';

type SocioInput = { cuentaId: string; percentBps: number };

function validateSocios(socios: SocioInput[]) {
  const seen = new Set<string>();
  for (const s of socios) {
    if (seen.has(s.cuentaId)) {
      throw unprocessable(
        `Cada cuenta puede aparecer una sola vez entre los socios (duplicada: ${s.cuentaId})`,
        'SOCIEDAD_SOCIOS_DUPLICATE_CUENTA',
      );
    }
    seen.add(s.cuentaId);
  }
  const sum = socios.reduce((acc, s) => acc + s.percentBps, 0);
  if (sum !== 10000) {
    throw unprocessable(
      `La suma de percentBps de los socios debe ser 10000 (100%); recibido ${sum}`,
      'SOCIEDAD_SOCIOS_PERCENT_SUM_INVALID',
    );
  }
}

export async function listSociedades(opts: {
  q?: string;
  active?: 'true' | 'false';
  includeSocios?: 'true' | 'false';
  includeBanco?: 'true' | 'false';
  includePropiedades?: 'true' | 'false';
}) {
  const where: Prisma.SociedadWhereInput = { deletedAt: null };
  // Active-only by default; ?active=false drops the filter so inactive sociedades are included too.
  if (opts.active !== 'false') {
    where.isActive = true;
  }
  if (opts.q) {
    where.name = { contains: opts.q, mode: 'insensitive' };
  }
  const include: Prisma.SociedadInclude = {};
  if (opts.includeSocios === 'true') {
    include.socios = { include: { cuenta: true } };
  }
  if (opts.includeBanco === 'true') {
    include.banco = true;
  }
  if (opts.includePropiedades === 'true') {
    include.propiedades = { where: { deletedAt: null } };
  }
  return prisma.sociedad.findMany({
    where,
    orderBy: { name: 'asc' },
    include: Object.keys(include).length > 0 ? include : undefined,
  });
}

export async function getSociedad(id: string) {
  const sociedad = await prisma.sociedad.findUnique({
    where: { id },
    include: {
      socios: { include: { cuenta: true } },
      banco: true,
      propiedades: { where: { deletedAt: null }, orderBy: { nombre: 'asc' } },
    },
  });
  if (!sociedad || sociedad.deletedAt) throw notFound('Sociedad no encontrada');
  return sociedad;
}

export async function createSociedad(input: CreateSociedadInput) {
  const existing = await prisma.sociedad.findUnique({ where: { name: input.name } });
  if (existing) throw conflict('Ya existe una sociedad con ese nombre');

  if (input.socios && input.socios.length > 0) {
    validateSocios(input.socios);
    const cuentas = await prisma.cuenta.findMany({
      where: { id: { in: input.socios.map((s) => s.cuentaId) }, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (cuentas.length !== input.socios.length) {
      throw unprocessable(
        'Al menos una de las cuentas indicadas como socio no existe o no está activa',
        'SOCIEDAD_SOCIOS_CUENTA_INVALID',
      );
    }
  }

  const sociosToCreate = input.socios ?? [];
  return prisma.$transaction(async (tx) => {
    const sociedad = await tx.sociedad.create({
      data: {
        name: input.name,
        notes: input.notes ?? null,
      },
    });
    if (sociosToCreate.length > 0) {
      await tx.sociedadSocio.createMany({
        data: sociosToCreate.map((s) => ({
          sociedadId: sociedad.id,
          cuentaId: s.cuentaId,
          percentBps: s.percentBps,
        })),
      });
    }
    return tx.sociedad.findUniqueOrThrow({
      where: { id: sociedad.id },
      include: {
        socios: { include: { cuenta: true } },
        banco: true,
        _count: { select: { propiedades: { where: { deletedAt: null } } } },
      },
    });
  });
}

export async function updateSociedad(id: string, input: UpdateSociedadInput) {
  await getSociedad(id);
  if (input.name) {
    const existing = await prisma.sociedad.findUnique({ where: { name: input.name } });
    if (existing && existing.id !== id) {
      throw conflict('Ya existe una sociedad con ese nombre');
    }
  }
  const data: Prisma.SociedadUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.notes !== undefined) data.notes = input.notes ?? null;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  return prisma.sociedad.update({ where: { id }, data });
}

export async function replaceSocios(id: string, input: ReplaceSociosInput) {
  await getSociedad(id);
  validateSocios(input.socios);
  const cuentas = await prisma.cuenta.findMany({
    where: { id: { in: input.socios.map((s) => s.cuentaId) }, deletedAt: null, isActive: true },
    select: { id: true },
  });
  if (cuentas.length !== input.socios.length) {
    throw unprocessable(
      'Al menos una de las cuentas indicadas como socio no existe o no está activa',
      'SOCIEDAD_SOCIOS_CUENTA_INVALID',
    );
  }
  return prisma.$transaction(async (tx) => {
    await tx.sociedadSocio.deleteMany({ where: { sociedadId: id } });
    await tx.sociedadSocio.createMany({
      data: input.socios.map((s) => ({
        sociedadId: id,
        cuentaId: s.cuentaId,
        percentBps: s.percentBps,
      })),
    });
    return tx.sociedad.findUniqueOrThrow({
      where: { id },
      include: {
        socios: { include: { cuenta: true } },
        banco: true,
        _count: { select: { propiedades: { where: { deletedAt: null } } } },
      },
    });
  });
}

export async function deleteSociedad(id: string) {
  await getSociedad(id);
  const [activePropiedades, movimientosCount] = await Promise.all([
    prisma.propiedad.count({ where: { sociedadId: id, deletedAt: null, isActive: true } }),
    prisma.movimiento.count({ where: { sociedadId: id } }),
  ]);
  if (activePropiedades > 0 || movimientosCount > 0) {
    throw unprocessable(
      'No se puede eliminar: la sociedad tiene propiedades activas o movimientos asociados',
      'SOCIEDAD_HAS_DEPENDENCIES',
    );
  }
  return prisma.sociedad.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
}
