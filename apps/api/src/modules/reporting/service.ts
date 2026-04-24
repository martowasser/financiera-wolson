import prisma from '../../lib/prisma.js';
import { distribute } from '../../lib/distribute.js';

/**
 * Posición consolidada: por sociedad → banco saldos + reparto a socios.
 * Plus caja global y cuentas corrientes.
 */
export async function getPosicion() {
  const [sociedades, cuentas, ultimaCajaCerrada, cajaHoy] = await Promise.all([
    prisma.sociedad.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      include: {
        banco: true,
        socios: { include: { cuenta: { select: { id: true, name: true } } } },
      },
    }),
    prisma.cuenta.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, identifier: true, saldoArs: true, saldoUsd: true },
    }),
    prisma.cajaDia.findFirst({ where: { status: 'CLOSED' }, orderBy: { fecha: 'desc' } }),
    prisma.cajaDia.findFirst({ where: { status: 'OPEN' }, orderBy: { fecha: 'desc' } }),
  ]);

  const cajaSaldoBaseArs = ultimaCajaCerrada?.saldoFinalArs ?? cajaHoy?.saldoInicialArs ?? 0n;
  const cajaSaldoBaseUsd = ultimaCajaCerrada?.saldoFinalUsd ?? cajaHoy?.saldoInicialUsd ?? 0n;

  // Adjust caja by today's open-caja movements (if any).
  let cajaSaldoArs = cajaSaldoBaseArs;
  let cajaSaldoUsd = cajaSaldoBaseUsd;
  if (cajaHoy) {
    const movs = await prisma.movimiento.findMany({
      where: { cajaDiaId: cajaHoy.id, OR: [{ origenBucket: 'CAJA' }, { destinoBucket: 'CAJA' }] },
      select: { monto: true, moneda: true, origenBucket: true, destinoBucket: true },
    });
    cajaSaldoArs = cajaHoy.saldoInicialArs;
    cajaSaldoUsd = cajaHoy.saldoInicialUsd;
    for (const m of movs) {
      const sign = m.destinoBucket === 'CAJA' ? 1n : -1n;
      if (m.moneda === 'ARS') cajaSaldoArs += sign * m.monto;
      else cajaSaldoUsd += sign * m.monto;
    }
  }

  const sociedadesOut = sociedades.map((s) => {
    const banco = s.banco
      ? { id: s.banco.id, nombre: s.banco.nombre, numero: s.banco.numero, saldoArs: s.banco.saldoArs, saldoUsd: s.banco.saldoUsd }
      : null;

    const ownerships = s.socios.map((m) => ({ ownerId: m.cuentaId, percentBps: m.percentBps }));
    const repartoArs = banco ? distribute(banco.saldoArs, ownerships) : [];
    const repartoUsd = banco ? distribute(banco.saldoUsd, ownerships) : [];
    const repartoArsByOwner = new Map(repartoArs.map((r) => [r.ownerId, r.amount]));
    const repartoUsdByOwner = new Map(repartoUsd.map((r) => [r.ownerId, r.amount]));

    return {
      id: s.id,
      name: s.name,
      banco,
      socios: s.socios.map((m) => ({
        cuentaId: m.cuentaId,
        name: m.cuenta.name,
        percentBps: m.percentBps,
        correspondeArs: repartoArsByOwner.get(m.cuentaId) ?? 0n,
        correspondeUsd: repartoUsdByOwner.get(m.cuentaId) ?? 0n,
      })),
    };
  });

  return {
    sociedades: sociedadesOut,
    caja: { saldoArs: cajaSaldoArs, saldoUsd: cajaSaldoUsd },
    cuentas,
  };
}

/**
 * Estado del mes para cada contrato ACTIVO o recientemente FINALIZADO.
 * AL_DIA: cobro este mes con facturado=true.
 * SIN_FACTURAR: cobro este mes con facturado=false.
 * PENDIENTE: sin cobro este mes y status=ACTIVO.
 */
export async function getAlquileres() {
  const now = new Date();
  const inicioMes = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const inicioMesSig = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const contratos = await prisma.contrato.findMany({
    where: { deletedAt: null },
    orderBy: [{ status: 'asc' }, { numero: 'desc' }],
    include: {
      propiedad: { select: { id: true, nombre: true, direccion: true, sociedad: { select: { id: true, name: true } } } },
      inquilino: { select: { id: true, name: true } },
      socios: { include: { cuenta: { select: { id: true, name: true } } } },
      movimientos: {
        where: {
          tipo: 'ALQUILER_COBRO',
          fecha: { gte: inicioMes, lt: inicioMesSig },
        },
        orderBy: { fecha: 'desc' },
        select: { id: true, fecha: true, comprobante: true, facturado: true, monto: true, moneda: true },
      },
    },
  });

  return contratos.map((c) => {
    const cobroMes = c.movimientos[0] ?? null;
    let estadoDelMes: 'AL_DIA' | 'SIN_FACTURAR' | 'PENDIENTE' | 'NO_APLICA';
    if (c.status === 'FINALIZADO') {
      estadoDelMes = 'NO_APLICA';
    } else if (cobroMes) {
      estadoDelMes = cobroMes.facturado ? 'AL_DIA' : 'SIN_FACTURAR';
    } else {
      estadoDelMes = 'PENDIENTE';
    }
    return {
      id: c.id,
      numero: c.numero,
      propiedad: c.propiedad,
      inquilino: c.inquilino,
      monto: c.monto,
      moneda: c.moneda,
      status: c.status,
      fechaInicio: c.fechaInicio,
      fechaFin: c.fechaFin,
      finalizadoEn: c.finalizadoEn,
      socios: c.socios.map((s) => ({ cuentaId: s.cuentaId, cuentaName: s.cuenta.name, percentBps: s.percentBps })),
      estadoDelMes,
      ultimoCobro: cobroMes ? { id: cobroMes.id, fecha: cobroMes.fecha, comprobante: cobroMes.comprobante, monto: cobroMes.monto, moneda: cobroMes.moneda } : null,
    };
  });
}

export async function getCajaResumen(fechaIso: string) {
  const fecha = new Date(`${fechaIso}T00:00:00.000Z`);
  const caja = await prisma.cajaDia.findUnique({
    where: { fecha },
    include: { cerradoPor: { select: { id: true, username: true, name: true } } },
  });
  if (!caja) return null;

  const movs = await prisma.movimiento.findMany({
    where: { cajaDiaId: caja.id },
    select: { tipo: true, monto: true, moneda: true, origenBucket: true, destinoBucket: true },
  });

  const totalesPorTipo = new Map<string, { ingresoArs: bigint; ingresoUsd: bigint; egresoArs: bigint; egresoUsd: bigint }>();
  let cajaSaldoArs = caja.saldoInicialArs;
  let cajaSaldoUsd = caja.saldoInicialUsd;
  for (const m of movs) {
    if (m.destinoBucket === 'CAJA') {
      if (m.moneda === 'ARS') cajaSaldoArs += m.monto;
      else cajaSaldoUsd += m.monto;
    }
    if (m.origenBucket === 'CAJA') {
      if (m.moneda === 'ARS') cajaSaldoArs -= m.monto;
      else cajaSaldoUsd -= m.monto;
    }
    const cur = totalesPorTipo.get(m.tipo) ?? { ingresoArs: 0n, ingresoUsd: 0n, egresoArs: 0n, egresoUsd: 0n };
    if (m.destinoBucket && !m.origenBucket) {
      if (m.moneda === 'ARS') cur.ingresoArs += m.monto;
      else cur.ingresoUsd += m.monto;
    } else if (m.origenBucket && !m.destinoBucket) {
      if (m.moneda === 'ARS') cur.egresoArs += m.monto;
      else cur.egresoUsd += m.monto;
    }
    totalesPorTipo.set(m.tipo, cur);
  }

  return {
    caja: {
      ...caja,
      currentSaldoArs: cajaSaldoArs,
      currentSaldoUsd: cajaSaldoUsd,
    },
    totalCount: movs.length,
    totalesPorTipo: Object.fromEntries(totalesPorTipo),
  };
}
