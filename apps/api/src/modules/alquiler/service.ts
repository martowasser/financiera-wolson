import prisma from '../../lib/prisma.js';
import { notFound, unprocessable } from '../../lib/errors.js';
import type {
  CreateAlquilerInput,
  UpdateAlquilerInput,
  ReplaceAlquilerSociosInput,
  FinalizarAlquilerInput,
  ListAlquileresQuery,
} from './schemas.js';
import type { Prisma } from '@prisma/client';

type SocioInput = { cuentaId: string; percentBps: number };

function validateSocios(socios: SocioInput[]) {
  const seen = new Set<string>();
  for (const s of socios) {
    if (seen.has(s.cuentaId)) {
      throw unprocessable(
        `Cada cuenta puede aparecer una sola vez entre los socios (duplicada: ${s.cuentaId})`,
        'ALQUILER_SOCIOS_DUPLICATE_CUENTA',
      );
    }
    seen.add(s.cuentaId);
  }
  const sum = socios.reduce((acc, s) => acc + s.percentBps, 0);
  if (sum !== 10000) {
    throw unprocessable(
      `La suma de percentBps de los socios debe ser 10000 (100%); recibido ${sum}`,
      'ALQUILER_SOCIOS_PERCENT_SUM_INVALID',
    );
  }
}

async function assertCuentasActive(socios: SocioInput[]) {
  const cuentas = await prisma.cuenta.findMany({
    where: { id: { in: socios.map((s) => s.cuentaId) }, deletedAt: null, isActive: true },
    select: { id: true },
  });
  if (cuentas.length !== socios.length) {
    throw unprocessable(
      'Al menos una de las cuentas indicadas como socio no existe o no está activa',
      'ALQUILER_SOCIOS_CUENTA_INVALID',
    );
  }
}

export async function listAlquileres(opts: ListAlquileresQuery) {
  const where: Prisma.AlquilerWhereInput = {};
  if (opts.showArchived !== 'true') where.deletedAt = null;
  if (opts.status) where.status = opts.status;
  if (opts.propiedadId) where.propiedadId = opts.propiedadId;
  if (opts.inquilinoId) where.inquilinoId = opts.inquilinoId;
  // sociedadId is transitive via propiedad; filter through the relation.
  if (opts.sociedadId) where.propiedad = { sociedadId: opts.sociedadId };
  if (opts.q) {
    where.OR = [
      { inquilino: { name: { contains: opts.q, mode: 'insensitive' } } },
      { propiedad: { nombre: { contains: opts.q, mode: 'insensitive' } } },
    ];
  }
  return prisma.alquiler.findMany({
    where,
    orderBy: [{ status: 'asc' }, { fechaInicio: 'desc' }],
    include: {
      propiedad: {
        select: {
          id: true,
          nombre: true,
          direccion: true,
          sociedad: { select: { id: true, name: true } },
        },
      },
      inquilino: { select: { id: true, name: true } },
      _count: { select: { socios: true } },
    },
  });
}

export async function getAlquiler(id: string) {
  const alquiler = await prisma.alquiler.findUnique({
    where: { id },
    include: {
      propiedad: {
        include: { sociedad: { select: { id: true, name: true } } },
      },
      inquilino: true,
      socios: {
        include: { cuenta: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!alquiler || alquiler.deletedAt) throw notFound('Alquiler no encontrado');
  return alquiler;
}

export async function getAlquilerByNumero(numero: number) {
  const alquiler = await prisma.alquiler.findUnique({
    where: { numero },
    include: {
      propiedad: {
        include: { sociedad: { select: { id: true, name: true } } },
      },
      inquilino: true,
      socios: {
        include: { cuenta: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!alquiler || alquiler.deletedAt) throw notFound('Alquiler no encontrado');
  return alquiler;
}

export async function createAlquiler(input: CreateAlquilerInput) {
  // Validate parent propiedad exists, not soft-deleted; load its sociedad socios for the default copy.
  const propiedad = await prisma.propiedad.findUnique({
    where: { id: input.propiedadId },
    include: {
      sociedad: { include: { socios: true } },
    },
  });
  if (!propiedad || propiedad.deletedAt) {
    throw unprocessable('Propiedad no encontrada o eliminada', 'PROPIEDAD_NOT_FOUND');
  }

  const inquilino = await prisma.cuenta.findUnique({ where: { id: input.inquilinoId } });
  if (!inquilino || inquilino.deletedAt) {
    throw unprocessable('Inquilino no encontrado o eliminado', 'INQUILINO_NOT_FOUND');
  }

  // Pre-fill socios from the propiedad's sociedad when caller omits them — matches how Mariana
  // usually wants the alquiler to mirror the sociedad's ownership split.
  const sociosToCreate: SocioInput[] =
    input.socios && input.socios.length > 0
      ? input.socios
      : propiedad.sociedad.socios.map((s) => ({ cuentaId: s.cuentaId, percentBps: s.percentBps }));

  if (sociosToCreate.length === 0) {
    throw unprocessable(
      'No hay socios para asignar al alquiler (ni se pasaron, ni la sociedad los tiene)',
      'ALQUILER_SOCIOS_EMPTY',
    );
  }

  validateSocios(sociosToCreate);
  await assertCuentasActive(sociosToCreate);

  return prisma.$transaction(async (tx) => {
    const alquiler = await tx.alquiler.create({
      data: {
        propiedadId: input.propiedadId,
        inquilinoId: input.inquilinoId,
        monto: input.monto,
        moneda: input.moneda,
        fechaInicio: new Date(input.fechaInicio),
        fechaFin: input.fechaFin ? new Date(input.fechaFin) : null,
        notes: input.notes ?? null,
      },
    });
    await tx.alquilerSocio.createMany({
      data: sociosToCreate.map((s) => ({
        alquilerId: alquiler.id,
        cuentaId: s.cuentaId,
        percentBps: s.percentBps,
      })),
    });
    return tx.alquiler.findUniqueOrThrow({
      where: { id: alquiler.id },
      include: {
        propiedad: { include: { sociedad: { select: { id: true, name: true } } } },
        inquilino: true,
        socios: { include: { cuenta: true }, orderBy: { createdAt: 'asc' } },
      },
    });
  });
}

export async function updateAlquiler(id: string, input: UpdateAlquilerInput) {
  await getAlquiler(id);
  const data: Prisma.AlquilerUpdateInput = {};
  if (input.monto !== undefined) data.monto = input.monto;
  if (input.moneda !== undefined) data.moneda = input.moneda;
  if (input.fechaInicio !== undefined) data.fechaInicio = new Date(input.fechaInicio);
  if (input.fechaFin !== undefined) {
    data.fechaFin = input.fechaFin ? new Date(input.fechaFin) : null;
  }
  if (input.notes !== undefined) data.notes = input.notes ?? null;
  return prisma.alquiler.update({
    where: { id },
    data,
    include: {
      propiedad: { include: { sociedad: { select: { id: true, name: true } } } },
      inquilino: true,
      socios: { include: { cuenta: true }, orderBy: { createdAt: 'asc' } },
    },
  });
}

export async function replaceAlquilerSocios(id: string, input: ReplaceAlquilerSociosInput) {
  await getAlquiler(id);
  validateSocios(input.socios);
  await assertCuentasActive(input.socios);
  return prisma.$transaction(async (tx) => {
    await tx.alquilerSocio.deleteMany({ where: { alquilerId: id } });
    await tx.alquilerSocio.createMany({
      data: input.socios.map((s) => ({
        alquilerId: id,
        cuentaId: s.cuentaId,
        percentBps: s.percentBps,
      })),
    });
    return tx.alquiler.findUniqueOrThrow({
      where: { id },
      include: {
        propiedad: { include: { sociedad: { select: { id: true, name: true } } } },
        inquilino: true,
        socios: { include: { cuenta: true }, orderBy: { createdAt: 'asc' } },
      },
    });
  });
}

export async function finalizarAlquiler(id: string, input: FinalizarAlquilerInput) {
  const existing = await getAlquiler(id);
  if (existing.status === 'FINALIZADO') {
    throw unprocessable('El alquiler ya está finalizado', 'ALQUILER_YA_FINALIZADO');
  }
  return prisma.alquiler.update({
    where: { id },
    data: {
      status: 'FINALIZADO',
      finalizadoEn: new Date(input.finalizadoEn),
      motivoFinalizacion: input.motivoFinalizacion,
    },
  });
}

export async function reactivarAlquiler(id: string) {
  const existing = await getAlquiler(id);
  if (existing.status === 'ACTIVO') {
    throw unprocessable('El alquiler ya está activo', 'ALQUILER_YA_ACTIVO');
  }
  return prisma.alquiler.update({
    where: { id },
    data: {
      status: 'ACTIVO',
      finalizadoEn: null,
      motivoFinalizacion: null,
    },
  });
}

export async function deleteAlquiler(id: string) {
  await getAlquiler(id);
  // Soft-delete (archivar). No bloqueamos por movimientos históricos —
  // se preservan vía la FK alquilerId nullable en Movimiento.
  return prisma.alquiler.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
