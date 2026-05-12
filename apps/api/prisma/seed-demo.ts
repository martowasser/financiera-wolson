// One-off demo dataset for the Alberto viewer. Idempotent: re-running is safe.
// Run with: pnpm --filter @financiero/api exec tsx prisma/seed-demo.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findOrCreateCuenta(name: string, identifier: string | null, isOwner = false) {
  const existing = identifier
    ? await prisma.cuenta.findUnique({ where: { identifier } })
    : await prisma.cuenta.findFirst({ where: { name, deletedAt: null } });
  if (existing) {
    if (isOwner && !existing.isOwner) {
      await prisma.cuenta.update({ where: { id: existing.id }, data: { isOwner: true } });
    }
    return existing;
  }
  return prisma.cuenta.create({ data: { name, identifier, isOwner } });
}

async function findOrCreateSociedad(name: string, socios: { cuentaId: string; percentBps: number }[]) {
  const existing = await prisma.sociedad.findFirst({ where: { name, deletedAt: null } });
  if (existing) return existing;
  return prisma.sociedad.create({
    data: { name, socios: { create: socios } },
  });
}

async function findOrCreateBanco(sociedadId: string, nombre: string, numero: string, saldoArs: bigint, saldoUsd: bigint) {
  const existing = await prisma.banco.findFirst({ where: { sociedadId, deletedAt: null } });
  if (existing) {
    if (existing.saldoArs !== saldoArs || existing.saldoUsd !== saldoUsd) {
      await prisma.banco.update({ where: { id: existing.id }, data: { saldoArs, saldoUsd } });
    }
    return existing;
  }
  return prisma.banco.create({ data: { sociedadId, nombre, numero, saldoArs, saldoUsd } });
}

async function findOrCreatePropiedad(sociedadId: string, nombre: string, direccion: string) {
  const existing = await prisma.propiedad.findFirst({ where: { sociedadId, nombre, deletedAt: null } });
  if (existing) return existing;
  return prisma.propiedad.create({ data: { sociedadId, nombre, direccion } });
}

async function findOrCreateAlquiler(propiedadId: string, inquilinoId: string, monto: bigint, fechaInicioIso: string, socios: { cuentaId: string; percentBps: number }[], moneda: 'ARS' | 'USD' = 'ARS') {
  const existing = await prisma.alquiler.findFirst({
    where: { propiedadId, inquilinoId, deletedAt: null },
  });
  if (existing) return existing;
  return prisma.alquiler.create({
    data: {
      propiedadId,
      inquilinoId,
      monto,
      moneda,
      fechaInicio: new Date(`${fechaInicioIso}T00:00:00.000Z`),
      socios: { create: socios },
    },
  });
}

async function findOrCreateCajaDia(fechaIso: string) {
  const fecha = new Date(`${fechaIso}T00:00:00.000Z`);
  return prisma.cajaDia.upsert({
    where: { fecha },
    update: {},
    create: { fecha, status: 'OPEN' },
  });
}

async function ensureAlquilerCobro(opts: {
  alquilerId: string;
  bancoId: string;
  monto: bigint;
  moneda?: 'ARS' | 'USD';
  fechaIso: string;
  createdById: string;
  facturado?: boolean;
  comprobante?: string;
}) {
  const existing = await prisma.movimiento.findFirst({
    where: { alquilerId: opts.alquilerId, tipo: 'ALQUILER_COBRO' },
  });
  if (existing) return existing;
  const cajaDia = await findOrCreateCajaDia(opts.fechaIso);
  return prisma.movimiento.create({
    data: {
      fecha: new Date(`${opts.fechaIso}T00:00:00.000Z`),
      cajaDiaId: cajaDia.id,
      tipo: 'ALQUILER_COBRO',
      monto: opts.monto,
      moneda: opts.moneda ?? 'ARS',
      destinoBucket: 'BANCO',
      destinoBancoId: opts.bancoId,
      alquilerId: opts.alquilerId,
      createdById: opts.createdById,
      facturado: opts.facturado ?? false,
      comprobante: opts.comprobante,
    },
  });
}

async function main() {
  const admin = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (!admin) throw new Error('admin user not found — run `pnpm db:seed` first');

  const alberto = await findOrCreateCuenta('Alberto', 'ALB', true);
  const casab   = await findOrCreateCuenta('Casab',   'CAS', false);
  const juan    = await findOrCreateCuenta('Juan Pérez',     null, false);
  const maria   = await findOrCreateCuenta('María González',  null, false);
  const carlos  = await findOrCreateCuenta('Carlos López',    null, false);
  const sofia   = await findOrCreateCuenta('Sofía Martínez',  null, false);

  const sociedad = await findOrCreateSociedad('DA S.A.', [
    { cuentaId: alberto.id, percentBps: 5000 },
    { cuentaId: casab.id,   percentBps: 5000 },
  ]);

  const banco = await findOrCreateBanco(
    sociedad.id, 'Banco DA', '042',
    35_000_00n, 1_500_00n,
  );

  const propMayo       = await findOrCreatePropiedad(sociedad.id, 'Av. Mayo 123 4B',     'Av. Mayo 123, Piso 4 B, CABA');
  const propBelgrano   = await findOrCreatePropiedad(sociedad.id, 'Belgrano 4567',       'Av. Belgrano 4567, CABA');
  const propCorrientes = await findOrCreatePropiedad(sociedad.id, 'Corrientes 800 PB',   'Av. Corrientes 800, PB, CABA');
  const propQuintana   = await findOrCreatePropiedad(sociedad.id, 'Quintana 500 6°A',    'Av. Quintana 500, Piso 6 A, CABA');

  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const cobroFecha = `${yyyy}-${mm}-05`; // 5to del mes actual
  const cobroFecha2 = `${yyyy}-${mm}-03`; // 3ro del mes actual (para variedad)

  const sociosDA = [
    { cuentaId: alberto.id, percentBps: 5000 },
    { cuentaId: casab.id,   percentBps: 5000 },
  ];

  // 1. SIN_FACTURAR: cobrado pero sin facturar
  const alqMayo = await findOrCreateAlquiler(propMayo.id, juan.id, 12_000_00n, '2026-01-01', sociosDA);
  await ensureAlquilerCobro({
    alquilerId: alqMayo.id, bancoId: banco.id, monto: 12_000_00n,
    fechaIso: cobroFecha, createdById: admin.id, facturado: false,
  });

  // 2. PENDIENTE: alquiler activo sin cobro este mes
  await findOrCreateAlquiler(propBelgrano.id, maria.id, 18_000_00n, '2025-09-01', sociosDA);

  // 3. AL_DIA: cobrado y facturado
  const alqCorrientes = await findOrCreateAlquiler(propCorrientes.id, carlos.id, 9_500_00n, '2025-11-01', sociosDA);
  await ensureAlquilerCobro({
    alquilerId: alqCorrientes.id, bancoId: banco.id, monto: 9_500_00n,
    fechaIso: cobroFecha2, createdById: admin.id, facturado: true, comprobante: 'FC-A-0001-0042',
  });

  // 4. PENDIENTE en USD
  await findOrCreateAlquiler(propQuintana.id, sofia.id, 1_200_00n, '2025-08-01', sociosDA, 'USD');

  console.log('Demo dataset ready.');
  console.log(`  Alberto cuenta (isOwner): ${alberto.id}`);
  console.log(`  Sociedad: ${sociedad.name} (banco $${(Number(banco.saldoArs) / 100).toLocaleString('es-AR')} / US$${(Number(banco.saldoUsd) / 100).toLocaleString('es-AR')})`);
  console.log(`  Alquileres:`);
  console.log(`    1. Av. Mayo 123 — Juan Pérez — $12.000 — cobrado ${cobroFecha} sin factura`);
  console.log(`    2. Belgrano 4567 — María González — $18.000 — sin cobro este mes (PENDIENTE)`);
  console.log(`    3. Corrientes 800 — Carlos López — $9.500 — cobrado ${cobroFecha2} con factura FC-A-0001-0042`);
  console.log(`    4. Quintana 500 — Sofía Martínez — US$ 1.200 — sin cobro este mes (PENDIENTE USD)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
