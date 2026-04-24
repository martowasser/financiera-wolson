import prisma from '../../lib/prisma.js';
import { notFound, unprocessable } from '../../lib/errors.js';
import type {
  CreateContratoInput,
  UpdateContratoInput,
  ReplaceContratoSociosInput,
  FinalizarContratoInput,
  ListContratosQuery,
} from './schemas.js';
import type { Prisma } from '@prisma/client';

type SocioInput = { cuentaId: string; percentBps: number };

function validateSocios(socios: SocioInput[]) {
  const seen = new Set<string>();
  for (const s of socios) {
    if (seen.has(s.cuentaId)) {
      throw unprocessable(
        `Cada cuenta puede aparecer una sola vez entre los socios (duplicada: ${s.cuentaId})`,
        'CONTRATO_SOCIOS_DUPLICATE_CUENTA',
      );
    }
    seen.add(s.cuentaId);
  }
  const sum = socios.reduce((acc, s) => acc + s.percentBps, 0);
  if (sum !== 10000) {
    throw unprocessable(
      `La suma de percentBps de los socios debe ser 10000 (100%); recibido ${sum}`,
      'CONTRATO_SOCIOS_PERCENT_SUM_INVALID',
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
      'CONTRATO_SOCIOS_CUENTA_INVALID',
    );
  }
}

export async function listContratos(opts: ListContratosQuery) {
  const where: Prisma.ContratoWhereInput = { deletedAt: null };
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
  return prisma.contrato.findMany({
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

export async function getContrato(id: string) {
  const contrato = await prisma.contrato.findUnique({
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
  if (!contrato || contrato.deletedAt) throw notFound('Contrato no encontrado');
  return contrato;
}

export async function getContratoByNumero(numero: number) {
  const contrato = await prisma.contrato.findUnique({
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
  if (!contrato || contrato.deletedAt) throw notFound('Contrato no encontrado');
  return contrato;
}

export async function createContrato(input: CreateContratoInput) {
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
  // usually wants the contract to mirror the sociedad's ownership split.
  const sociosToCreate: SocioInput[] =
    input.socios && input.socios.length > 0
      ? input.socios
      : propiedad.sociedad.socios.map((s) => ({ cuentaId: s.cuentaId, percentBps: s.percentBps }));

  if (sociosToCreate.length === 0) {
    throw unprocessable(
      'No hay socios para asignar al contrato (ni se pasaron, ni la sociedad los tiene)',
      'CONTRATO_SOCIOS_EMPTY',
    );
  }

  validateSocios(sociosToCreate);
  await assertCuentasActive(sociosToCreate);

  return prisma.$transaction(async (tx) => {
    const contrato = await tx.contrato.create({
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
    await tx.contratoSocio.createMany({
      data: sociosToCreate.map((s) => ({
        contratoId: contrato.id,
        cuentaId: s.cuentaId,
        percentBps: s.percentBps,
      })),
    });
    return tx.contrato.findUniqueOrThrow({
      where: { id: contrato.id },
      include: {
        propiedad: { include: { sociedad: { select: { id: true, name: true } } } },
        inquilino: true,
        socios: { include: { cuenta: true }, orderBy: { createdAt: 'asc' } },
      },
    });
  });
}

export async function updateContrato(id: string, input: UpdateContratoInput) {
  await getContrato(id);
  const data: Prisma.ContratoUpdateInput = {};
  if (input.monto !== undefined) data.monto = input.monto;
  if (input.moneda !== undefined) data.moneda = input.moneda;
  if (input.fechaInicio !== undefined) data.fechaInicio = new Date(input.fechaInicio);
  if (input.fechaFin !== undefined) {
    data.fechaFin = input.fechaFin ? new Date(input.fechaFin) : null;
  }
  if (input.notes !== undefined) data.notes = input.notes ?? null;
  return prisma.contrato.update({
    where: { id },
    data,
    include: {
      propiedad: { include: { sociedad: { select: { id: true, name: true } } } },
      inquilino: true,
      socios: { include: { cuenta: true }, orderBy: { createdAt: 'asc' } },
    },
  });
}

export async function replaceContratoSocios(id: string, input: ReplaceContratoSociosInput) {
  await getContrato(id);
  validateSocios(input.socios);
  await assertCuentasActive(input.socios);
  return prisma.$transaction(async (tx) => {
    await tx.contratoSocio.deleteMany({ where: { contratoId: id } });
    await tx.contratoSocio.createMany({
      data: input.socios.map((s) => ({
        contratoId: id,
        cuentaId: s.cuentaId,
        percentBps: s.percentBps,
      })),
    });
    return tx.contrato.findUniqueOrThrow({
      where: { id },
      include: {
        propiedad: { include: { sociedad: { select: { id: true, name: true } } } },
        inquilino: true,
        socios: { include: { cuenta: true }, orderBy: { createdAt: 'asc' } },
      },
    });
  });
}

export async function finalizarContrato(id: string, input: FinalizarContratoInput) {
  const existing = await getContrato(id);
  if (existing.status === 'FINALIZADO') {
    throw unprocessable('El contrato ya está finalizado', 'CONTRATO_YA_FINALIZADO');
  }
  return prisma.contrato.update({
    where: { id },
    data: {
      status: 'FINALIZADO',
      finalizadoEn: new Date(input.finalizadoEn),
      motivoFinalizacion: input.motivoFinalizacion,
    },
  });
}

export async function reactivarContrato(id: string) {
  const existing = await getContrato(id);
  if (existing.status === 'ACTIVO') {
    throw unprocessable('El contrato ya está activo', 'CONTRATO_YA_ACTIVO');
  }
  return prisma.contrato.update({
    where: { id },
    data: {
      status: 'ACTIVO',
      finalizadoEn: null,
      motivoFinalizacion: null,
    },
  });
}

export async function deleteContrato(id: string) {
  await getContrato(id);
  // Preserve movement history: if any movimiento references this contrato we refuse to soft-delete.
  const movimientos = await prisma.movimiento.count({ where: { contratoId: id } });
  if (movimientos > 0) {
    throw unprocessable(
      'No se puede eliminar: el contrato tiene movimientos asociados',
      'CONTRATO_HAS_MOVIMIENTOS',
    );
  }
  return prisma.contrato.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
