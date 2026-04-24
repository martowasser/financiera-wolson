import prisma from '../../lib/prisma.js';
import { conflict, notFound, unprocessable } from '../../lib/errors.js';
import type { CerrarCajaInput, ListCajasQuery } from './schemas.js';
import type { CajaDia, Prisma } from '@prisma/client';

// YYYY-MM-DD → UTC-midnight Date, matching the @db.Date storage convention
// so equality lookups against `fecha` round-trip correctly.
function parseFecha(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

// Today's business date in UTC. We use plain UTC (not BUSINESS_TZ) per spec —
// POC assumes operator is in the same rough TZ as server date bucketing.
function todayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// Next UTC-midnight day. Used when auto-creating tomorrow's caja on close.
function nextDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

// Sum caja-affecting movimientos for a given caja day. A movimiento touches
// CAJA when either origen or destino bucket is CAJA; destino=CAJA is a +,
// origen=CAJA is a -. We do this in JS rather than a fancy SQL aggregate
// because the volume per day is tiny and we need per-moneda branching.
export async function computeCajaSaldos(
  cajaDiaId: string,
  saldoInicialArs: bigint,
  saldoInicialUsd: bigint,
  tx: Prisma.TransactionClient = prisma,
): Promise<{ saldoArs: bigint; saldoUsd: bigint }> {
  const movs = await tx.movimiento.findMany({
    where: {
      cajaDiaId,
      OR: [{ origenBucket: 'CAJA' }, { destinoBucket: 'CAJA' }],
    },
    select: {
      monto: true,
      moneda: true,
      origenBucket: true,
      destinoBucket: true,
    },
  });
  let saldoArs = saldoInicialArs;
  let saldoUsd = saldoInicialUsd;
  for (const m of movs) {
    const isArs = m.moneda === 'ARS';
    if (m.destinoBucket === 'CAJA') {
      if (isArs) saldoArs += m.monto;
      else saldoUsd += m.monto;
    }
    if (m.origenBucket === 'CAJA') {
      if (isArs) saldoArs -= m.monto;
      else saldoUsd -= m.monto;
    }
  }
  return { saldoArs, saldoUsd };
}

async function decorateWithCurrentSaldo(caja: CajaDia) {
  const { saldoArs, saldoUsd } = await computeCajaSaldos(
    caja.id,
    caja.saldoInicialArs,
    caja.saldoInicialUsd,
  );
  return { ...caja, currentSaldoArs: saldoArs, currentSaldoUsd: saldoUsd };
}

export async function getOrCreateToday() {
  const today = todayUtc();
  const existing = await prisma.cajaDia.findUnique({ where: { fecha: today } });
  if (existing) return decorateWithCurrentSaldo(existing);

  // First caja ever → start at zero. Otherwise carry forward the most recent
  // CLOSED caja's saldoFinal (may be an older date if no one closed yesterday).
  const prevClosed = await prisma.cajaDia.findFirst({
    where: { status: 'CLOSED', fecha: { lt: today } },
    orderBy: { fecha: 'desc' },
  });
  const saldoInicialArs = prevClosed?.saldoFinalArs ?? 0n;
  const saldoInicialUsd = prevClosed?.saldoFinalUsd ?? 0n;
  const created = await prisma.cajaDia.create({
    data: {
      fecha: today,
      status: 'OPEN',
      saldoInicialArs,
      saldoInicialUsd,
    },
  });
  return decorateWithCurrentSaldo(created);
}

export async function getByFecha(fecha: string) {
  const caja = await prisma.cajaDia.findUnique({ where: { fecha: parseFecha(fecha) } });
  if (!caja) throw notFound('Caja del día no encontrada');
  return decorateWithCurrentSaldo(caja);
}

export async function listCajas(opts: ListCajasQuery) {
  // Default window = last 60 days inclusive so the listing is bounded even
  // when the frontend omits both params.
  const today = todayUtc();
  const defaultFrom = new Date(today);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 60);
  const from = opts.from ? parseFecha(opts.from) : defaultFrom;
  const to = opts.to ? parseFecha(opts.to) : today;

  return prisma.cajaDia.findMany({
    where: { fecha: { gte: from, lte: to } },
    orderBy: { fecha: 'desc' },
    include: {
      cerradoPor: { select: { id: true, username: true } },
      _count: { select: { movimientos: true } },
    },
  });
}

export async function cerrarCaja(
  id: string,
  input: CerrarCajaInput,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    const caja = await tx.cajaDia.findUnique({ where: { id } });
    if (!caja) throw notFound('Caja del día no encontrada');
    if (caja.status === 'CLOSED') {
      throw conflict('La caja ya está cerrada', 'CAJA_ALREADY_CLOSED');
    }

    const { saldoArs, saldoUsd } = await computeCajaSaldos(
      caja.id,
      caja.saldoInicialArs,
      caja.saldoInicialUsd,
      tx,
    );

    const closed = await tx.cajaDia.update({
      where: { id },
      data: {
        status: 'CLOSED',
        saldoFinalArs: saldoArs,
        saldoFinalUsd: saldoUsd,
        cerradoEn: new Date(),
        cerradoPorId: userId,
        notes: input.notes ?? caja.notes,
      },
    });

    // Seed the next day so operators can start recording immediately. If it
    // already exists (e.g. someone pre-created it manually), just sync its
    // saldoInicial to keep the chain consistent.
    const tomorrow = nextDay(caja.fecha);
    const existingNext = await tx.cajaDia.findUnique({ where: { fecha: tomorrow } });
    if (existingNext) {
      await tx.cajaDia.update({
        where: { id: existingNext.id },
        data: { saldoInicialArs: saldoArs, saldoInicialUsd: saldoUsd },
      });
    } else {
      await tx.cajaDia.create({
        data: {
          fecha: tomorrow,
          status: 'OPEN',
          saldoInicialArs: saldoArs,
          saldoInicialUsd: saldoUsd,
        },
      });
    }

    return closed;
  });
}

export async function reabrirCaja(id: string) {
  return prisma.$transaction(async (tx) => {
    const caja = await tx.cajaDia.findUnique({ where: { id } });
    if (!caja) throw notFound('Caja del día no encontrada');
    if (caja.status === 'OPEN') {
      throw conflict('La caja ya está abierta', 'CAJA_ALREADY_OPEN');
    }

    // If the next day's caja already has activity, reopening this one would
    // desynchronize the saldo chain — refuse rather than silently truncate.
    const tomorrow = nextDay(caja.fecha);
    const nextCaja = await tx.cajaDia.findUnique({
      where: { fecha: tomorrow },
      include: { _count: { select: { movimientos: true } } },
    });
    if (nextCaja && nextCaja._count.movimientos > 0) {
      throw unprocessable(
        'No se puede reabrir: el día siguiente ya tiene movimientos registrados',
        'CAJA_NEXT_DAY_HAS_MOVIMIENTOS',
      );
    }

    if (nextCaja) {
      await tx.cajaDia.delete({ where: { id: nextCaja.id } });
    }

    return tx.cajaDia.update({
      where: { id },
      data: {
        status: 'OPEN',
        saldoFinalArs: null,
        saldoFinalUsd: null,
        cerradoEn: null,
        cerradoPorId: null,
      },
    });
  });
}
