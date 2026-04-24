import prisma from '../../lib/prisma.js';
import { conflict, notFound, unprocessable } from '../../lib/errors.js';
import type { CreateMovimientoInput, UpdateMovimientoInput } from './schemas.js';
import type { Prisma, BucketTipo, Moneda, MovimientoTipo } from '@prisma/client';

type Side = { bucket?: BucketTipo; bancoId?: string; cuentaId?: string };

/**
 * Per-tipo rules: which side(s) are required and which buckets are allowed.
 * Buckets:
 *   I = INGRESO  (origen=null, destino=any allowed bucket)
 *   E = EGRESO   (origen=any allowed bucket, destino=null)
 *   T = TRANSFER (both required, distinct)
 *   F = FREE     (at least one side; structure validated only loosely)
 */
type TipoRule = {
  flow: 'I' | 'E' | 'T' | 'F';
  origenAllowed?: BucketTipo[];
  destinoAllowed?: BucketTipo[];
  requireContrato?: boolean;
  requirePropiedad?: boolean;
  requireSociedad?: boolean;
  requireBancoOrigen?: boolean;
  requireNotes?: boolean;
};

const RULES: Record<MovimientoTipo, TipoRule> = {
  ALQUILER_COBRO:    { flow: 'I', destinoAllowed: ['CAJA', 'BANCO'], requireContrato: true },
  ALQUILER_PAGO:     { flow: 'E', origenAllowed: ['CAJA', 'BANCO'],  requireContrato: true },
  GASTO:             { flow: 'E', origenAllowed: ['CAJA', 'BANCO', 'CUENTA_CORRIENTE'] },
  GASTO_SOCIEDAD:    { flow: 'E', origenAllowed: ['CAJA', 'BANCO'],  requireSociedad: true },
  GASTO_PROPIEDAD:   { flow: 'E', origenAllowed: ['CAJA', 'BANCO'],  requirePropiedad: true },
  INGRESO_VARIO:     { flow: 'I', destinoAllowed: ['CAJA', 'BANCO', 'CUENTA_CORRIENTE'] },
  TRANSFERENCIA:     { flow: 'T', origenAllowed: ['CAJA', 'BANCO', 'CUENTA_CORRIENTE'], destinoAllowed: ['CAJA', 'BANCO', 'CUENTA_CORRIENTE'] },
  COMISION_BANCARIA: { flow: 'E', origenAllowed: ['BANCO'], requireBancoOrigen: true },
  DEBITO_AUTOMATICO: { flow: 'E', origenAllowed: ['BANCO'], requireBancoOrigen: true },
  RECUPERO:          { flow: 'I', destinoAllowed: ['CAJA', 'BANCO', 'CUENTA_CORRIENTE'] },
  AJUSTE:            { flow: 'F', requireNotes: true },
  OTRO:              { flow: 'F', requireNotes: true },
};

function validateSide(side: 'origen' | 'destino', s: Side, allowed?: BucketTipo[]) {
  if (!s.bucket) {
    throw unprocessable(`Falta ${side}Bucket`, 'MOV_BUCKET_REQUIRED');
  }
  if (allowed && !allowed.includes(s.bucket)) {
    throw unprocessable(
      `Bucket de ${side} '${s.bucket}' no permitido para este tipo`,
      'MOV_BUCKET_NOT_ALLOWED',
    );
  }
  if (s.bucket === 'BANCO' && !s.bancoId) {
    throw unprocessable(`Falta ${side}BancoId`, 'MOV_BANCO_ID_REQUIRED');
  }
  if (s.bucket === 'CUENTA_CORRIENTE' && !s.cuentaId) {
    throw unprocessable(`Falta ${side}CuentaId`, 'MOV_CUENTA_ID_REQUIRED');
  }
  if (s.bucket === 'CAJA' && (s.bancoId || s.cuentaId)) {
    throw unprocessable(`Para bucket CAJA no se aceptan ${side}BancoId/CuentaId`, 'MOV_CAJA_NO_REF');
  }
}

function sidesEqual(a: Side, b: Side) {
  if (a.bucket !== b.bucket) return false;
  if (a.bucket === 'CAJA') return true;
  if (a.bucket === 'BANCO') return a.bancoId === b.bancoId;
  if (a.bucket === 'CUENTA_CORRIENTE') return a.cuentaId === b.cuentaId;
  return false;
}

async function getOrCreateCajaForFecha(tx: Prisma.TransactionClient, fechaIso: string) {
  const fecha = new Date(`${fechaIso}T00:00:00.000Z`);
  let caja = await tx.cajaDia.findUnique({ where: { fecha } });
  if (caja) {
    if (caja.status === 'CLOSED') {
      throw conflict('La caja de ese día está cerrada', 'CAJA_CLOSED');
    }
    return caja;
  }
  const lastClosed = await tx.cajaDia.findFirst({
    where: { status: 'CLOSED' },
    orderBy: { fecha: 'desc' },
  });
  caja = await tx.cajaDia.create({
    data: {
      fecha,
      saldoInicialArs: lastClosed?.saldoFinalArs ?? 0n,
      saldoInicialUsd: lastClosed?.saldoFinalUsd ?? 0n,
    },
  });
  return caja;
}

async function applyDelta(
  tx: Prisma.TransactionClient,
  side: Side,
  moneda: Moneda,
  delta: bigint,
) {
  if (!side.bucket || side.bucket === 'CAJA') return;
  const field = moneda === 'ARS' ? 'saldoArs' : 'saldoUsd';
  if (side.bucket === 'BANCO' && side.bancoId) {
    await tx.banco.update({
      where: { id: side.bancoId },
      data: { [field]: { increment: delta } },
    });
  } else if (side.bucket === 'CUENTA_CORRIENTE' && side.cuentaId) {
    await tx.cuenta.update({
      where: { id: side.cuentaId },
      data: { [field]: { increment: delta } },
    });
  }
}

export async function createMovimiento(input: CreateMovimientoInput, userId: string) {
  const rule = RULES[input.tipo];

  const origen: Side = {
    bucket: input.origenBucket,
    bancoId: input.origenBancoId,
    cuentaId: input.origenCuentaId,
  };
  const destino: Side = {
    bucket: input.destinoBucket,
    bancoId: input.destinoBancoId,
    cuentaId: input.destinoCuentaId,
  };

  // Flow validation
  switch (rule.flow) {
    case 'I':
      if (origen.bucket) throw unprocessable('Este tipo no admite origen', 'MOV_FLOW_INGRESO');
      validateSide('destino', destino, rule.destinoAllowed);
      break;
    case 'E':
      if (destino.bucket) throw unprocessable('Este tipo no admite destino', 'MOV_FLOW_EGRESO');
      validateSide('origen', origen, rule.origenAllowed);
      break;
    case 'T':
      validateSide('origen', origen, rule.origenAllowed);
      validateSide('destino', destino, rule.destinoAllowed);
      if (sidesEqual(origen, destino)) {
        throw unprocessable('Origen y destino no pueden ser iguales', 'MOV_TRANSFER_SAME');
      }
      break;
    case 'F':
      if (!origen.bucket && !destino.bucket) {
        throw unprocessable('Se requiere al menos origen o destino', 'MOV_BUCKET_MISSING');
      }
      if (origen.bucket) validateSide('origen', origen);
      if (destino.bucket) validateSide('destino', destino);
      if (origen.bucket && destino.bucket && sidesEqual(origen, destino)) {
        throw unprocessable('Origen y destino no pueden ser iguales', 'MOV_TRANSFER_SAME');
      }
      break;
  }

  if (rule.requireNotes && !input.notes) {
    throw unprocessable('notes es requerido para este tipo', 'MOV_NOTES_REQUIRED');
  }
  if (rule.requireContrato && !input.contratoId) {
    throw unprocessable('contratoId es requerido', 'MOV_CONTRATO_REQUIRED');
  }
  if (rule.requirePropiedad && !input.propiedadId) {
    throw unprocessable('propiedadId es requerido', 'MOV_PROPIEDAD_REQUIRED');
  }
  if (rule.requireSociedad && !input.sociedadId) {
    throw unprocessable('sociedadId es requerido', 'MOV_SOCIEDAD_REQUIRED');
  }
  if (rule.requireBancoOrigen && !input.origenBancoId) {
    throw unprocessable('origenBancoId es requerido', 'MOV_BANCO_REQUIRED');
  }

  return prisma.$transaction(async (tx) => {
    // Validate referenced bancos/cuentas exist & active.
    const [origenBanco, destinoBanco, origenCuenta, destinoCuenta, contratoCheck, propiedadCheck, sociedadCheck, contraparteCheck] = await Promise.all([
      input.origenBancoId  ? tx.banco.findUnique({ where: { id: input.origenBancoId } })   : null,
      input.destinoBancoId ? tx.banco.findUnique({ where: { id: input.destinoBancoId } })  : null,
      input.origenCuentaId ? tx.cuenta.findUnique({ where: { id: input.origenCuentaId } }) : null,
      input.destinoCuentaId? tx.cuenta.findUnique({ where: { id: input.destinoCuentaId } }): null,
      input.contratoId     ? tx.contrato.findUnique({ where: { id: input.contratoId }, include: { propiedad: true } }) : null,
      input.propiedadId    ? tx.propiedad.findUnique({ where: { id: input.propiedadId } }) : null,
      input.sociedadId     ? tx.sociedad.findUnique({ where: { id: input.sociedadId } })   : null,
      input.cuentaContraparteId ? tx.cuenta.findUnique({ where: { id: input.cuentaContraparteId } }) : null,
    ]);

    if (input.origenBancoId  && (!origenBanco  || origenBanco.deletedAt  || !origenBanco.isActive))   throw unprocessable('Banco origen inválido o cerrado',   'MOV_BANCO_ORIGEN_INVALID');
    if (input.destinoBancoId && (!destinoBanco || destinoBanco.deletedAt || !destinoBanco.isActive))  throw unprocessable('Banco destino inválido o cerrado',  'MOV_BANCO_DESTINO_INVALID');
    if (input.origenCuentaId && (!origenCuenta || origenCuenta.deletedAt || !origenCuenta.isActive))  throw unprocessable('Cuenta origen inválida o inactiva',  'MOV_CUENTA_ORIGEN_INVALID');
    if (input.destinoCuentaId && (!destinoCuenta || destinoCuenta.deletedAt || !destinoCuenta.isActive)) throw unprocessable('Cuenta destino inválida o inactiva', 'MOV_CUENTA_DESTINO_INVALID');
    if (input.contratoId  && (!contratoCheck  || contratoCheck.deletedAt))    throw unprocessable('Contrato inválido',  'MOV_CONTRATO_INVALID');
    if (input.propiedadId && (!propiedadCheck || propiedadCheck.deletedAt))   throw unprocessable('Propiedad inválida', 'MOV_PROPIEDAD_INVALID');
    if (input.sociedadId  && (!sociedadCheck  || sociedadCheck.deletedAt))    throw unprocessable('Sociedad inválida',  'MOV_SOCIEDAD_INVALID');
    if (input.cuentaContraparteId && (!contraparteCheck || contraparteCheck.deletedAt)) throw unprocessable('Cuenta contraparte inválida', 'MOV_CONTRAPARTE_INVALID');

    // Reject post-finalización ALQUILER on FINALIZADO contracts.
    if (contratoCheck && (input.tipo === 'ALQUILER_COBRO' || input.tipo === 'ALQUILER_PAGO')) {
      if (contratoCheck.status === 'FINALIZADO' && contratoCheck.finalizadoEn) {
        const fechaInput = new Date(`${input.fecha}T00:00:00.000Z`);
        if (fechaInput > contratoCheck.finalizadoEn) {
          throw conflict(
            'No se puede registrar alquiler con fecha posterior a la finalización del contrato',
            'CONTRATO_FINALIZADO_FECHA_POSTERIOR',
          );
        }
      }
    }

    // Derive sociedadId from banco/propiedad if not provided.
    let sociedadId = input.sociedadId;
    if (!sociedadId && input.propiedadId && propiedadCheck) sociedadId = propiedadCheck.sociedadId;
    if (!sociedadId && contratoCheck) sociedadId = contratoCheck.propiedad.sociedadId;
    if (!sociedadId && origenBanco) sociedadId = origenBanco.sociedadId;
    if (!sociedadId && destinoBanco) sociedadId = destinoBanco.sociedadId;

    const cajaDia = await getOrCreateCajaForFecha(tx, input.fecha);

    const created = await tx.movimiento.create({
      data: {
        fecha: new Date(`${input.fecha}T00:00:00.000Z`),
        cajaDiaId: cajaDia.id,
        tipo: input.tipo,
        monto: input.monto,
        moneda: input.moneda,
        origenBucket: input.origenBucket,
        origenBancoId: input.origenBancoId,
        origenCuentaId: input.origenCuentaId,
        destinoBucket: input.destinoBucket,
        destinoBancoId: input.destinoBancoId,
        destinoCuentaId: input.destinoCuentaId,
        sociedadId,
        propiedadId: input.propiedadId,
        contratoId: input.contratoId,
        cuentaContraparteId: input.cuentaContraparteId,
        comprobante: input.comprobante ?? null,
        facturado: input.facturado ?? false,
        notes: input.notes ?? null,
        createdById: userId,
      },
    });

    // Update saldos: origen subtracts, destino adds. Caja itself has no
    // persisted saldo column; computed at read time from CajaDia + movs.
    if (origen.bucket) await applyDelta(tx, origen, input.moneda, -input.monto);
    if (destino.bucket) await applyDelta(tx, destino, input.moneda, input.monto);

    return created;
  }, { isolationLevel: 'Serializable' });
}

export async function reversarMovimiento(id: string, motivo: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const original = await tx.movimiento.findUnique({ where: { id } });
    if (!original) throw notFound('Movimiento no encontrado');
    if (original.reversoDeId) {
      throw conflict('No se puede reversar un movimiento que ya es un reverso', 'MOV_IS_REVERSO');
    }
    const existingReverso = await tx.movimiento.findFirst({ where: { reversoDeId: id } });
    if (existingReverso) {
      throw conflict('Este movimiento ya fue reversado', 'MOV_ALREADY_REVERSED');
    }

    const cajaDia = await getOrCreateCajaForFecha(
      tx,
      new Date().toISOString().slice(0, 10),
    );

    // Reverso flips origen ↔ destino so saldos are mirrored when applied with
    // the same +/- direction the create used.
    const reverso = await tx.movimiento.create({
      data: {
        fecha: cajaDia.fecha,
        cajaDiaId: cajaDia.id,
        tipo: original.tipo,
        monto: original.monto,
        moneda: original.moneda,
        origenBucket: original.destinoBucket,
        origenBancoId: original.destinoBancoId,
        origenCuentaId: original.destinoCuentaId,
        destinoBucket: original.origenBucket,
        destinoBancoId: original.origenBancoId,
        destinoCuentaId: original.origenCuentaId,
        sociedadId: original.sociedadId,
        propiedadId: original.propiedadId,
        contratoId: original.contratoId,
        cuentaContraparteId: original.cuentaContraparteId,
        comprobante: original.comprobante,
        facturado: false,
        notes: `Reverso de #${original.numero}: ${motivo}`,
        reversoDeId: id,
        createdById: userId,
      },
    });

    const newOrigen: Side = { bucket: original.destinoBucket ?? undefined, bancoId: original.destinoBancoId ?? undefined, cuentaId: original.destinoCuentaId ?? undefined };
    const newDestino: Side = { bucket: original.origenBucket  ?? undefined, bancoId: original.origenBancoId  ?? undefined, cuentaId: original.origenCuentaId  ?? undefined };
    if (newOrigen.bucket)  await applyDelta(tx, newOrigen,  original.moneda, -original.monto);
    if (newDestino.bucket) await applyDelta(tx, newDestino, original.moneda,  original.monto);

    return reverso;
  }, { isolationLevel: 'Serializable' });
}

export async function listMovimientos(opts: {
  fecha?: string;
  from?: string;
  to?: string;
  sociedadId?: string;
  propiedadId?: string;
  contratoId?: string;
  bancoId?: string;
  cuentaId?: string;
  tipo?: MovimientoTipo;
  q?: string;
  limit?: number;
}) {
  const where: Prisma.MovimientoWhereInput = {};
  if (opts.fecha) {
    where.fecha = new Date(`${opts.fecha}T00:00:00.000Z`);
  } else if (opts.from || opts.to) {
    where.fecha = {};
    if (opts.from) (where.fecha as Prisma.DateTimeFilter).gte = new Date(`${opts.from}T00:00:00.000Z`);
    if (opts.to)   (where.fecha as Prisma.DateTimeFilter).lte = new Date(`${opts.to}T00:00:00.000Z`);
  }
  if (opts.tipo) where.tipo = opts.tipo;
  if (opts.contratoId) where.contratoId = opts.contratoId;
  if (opts.propiedadId) where.propiedadId = opts.propiedadId;
  if (opts.bancoId) {
    where.OR = [{ origenBancoId: opts.bancoId }, { destinoBancoId: opts.bancoId }];
  }
  if (opts.cuentaId) {
    where.OR = [
      { origenCuentaId: opts.cuentaId },
      { destinoCuentaId: opts.cuentaId },
      { cuentaContraparteId: opts.cuentaId },
    ];
  }
  if (opts.sociedadId) {
    // Transitive: direct, via banco origen/destino, or via contrato.propiedad.sociedad.
    where.OR = [
      ...(where.OR ?? []),
      { sociedadId: opts.sociedadId },
      { bancoOrigen:  { sociedadId: opts.sociedadId } },
      { bancoDestino: { sociedadId: opts.sociedadId } },
      { contrato: { propiedad: { sociedadId: opts.sociedadId } } },
      { propiedad: { sociedadId: opts.sociedadId } },
    ];
  }
  if (opts.q) {
    where.AND = [
      ...((where.AND as Prisma.MovimientoWhereInput[]) ?? []),
      {
        OR: [
          { notes: { contains: opts.q, mode: 'insensitive' } },
          { comprobante: { contains: opts.q, mode: 'insensitive' } },
        ],
      },
    ];
  }

  return prisma.movimiento.findMany({
    where,
    orderBy: [{ fecha: 'desc' }, { numero: 'desc' }],
    take: opts.limit ?? 100,
    include: {
      bancoOrigen:  { select: { id: true, nombre: true, numero: true } },
      bancoDestino: { select: { id: true, nombre: true, numero: true } },
      cuentaOrigen: { select: { id: true, name: true } },
      cuentaDestino:{ select: { id: true, name: true } },
      cuentaContraparte: { select: { id: true, name: true } },
      sociedad: { select: { id: true, name: true } },
      propiedad:{ select: { id: true, nombre: true } },
      contrato: { select: { id: true, numero: true } },
    },
  });
}

export async function getMovimiento(id: string) {
  const mov = await prisma.movimiento.findUnique({
    where: { id },
    include: {
      bancoOrigen: true,
      bancoDestino: true,
      cuentaOrigen: true,
      cuentaDestino: true,
      cuentaContraparte: true,
      sociedad: true,
      propiedad: true,
      contrato: { include: { propiedad: true, inquilino: true } },
      cajaDia: true,
      createdBy: { select: { id: true, username: true, name: true } },
    },
  });
  if (!mov) throw notFound('Movimiento no encontrado');
  return mov;
}

export async function getMovimientoByNumero(numero: number) {
  const mov = await prisma.movimiento.findUnique({ where: { numero } });
  if (!mov) throw notFound('Movimiento no encontrado');
  return mov;
}

export async function updateMovimiento(id: string, input: UpdateMovimientoInput) {
  const mov = await prisma.movimiento.findUnique({ where: { id } });
  if (!mov) throw notFound('Movimiento no encontrado');
  const data: Prisma.MovimientoUpdateInput = {};
  if (input.notes !== undefined)       data.notes       = input.notes ?? null;
  if (input.comprobante !== undefined) data.comprobante = input.comprobante ?? null;
  if (input.facturado !== undefined)   data.facturado   = input.facturado;
  return prisma.movimiento.update({ where: { id }, data });
}
