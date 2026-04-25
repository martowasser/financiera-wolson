import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './build-app.js';
import { createTestUser, getAuthToken, authHeader, prisma } from './test-helpers.js';

let app: FastifyInstance;
let authToken: string;

beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});

// Builds a full scenario once per test (beforeEach wipes DB) so each test is
// independent. Returns key IDs for assertions.
async function seedScenario() {
  const user = await createTestUser({ username: 'op', role: 'ADMIN' });
  authToken = getAuthToken(user);
  const headers = authHeader(authToken);

  const alberto = await post('/api/cuentas', headers, { name: 'Alberto', identifier: 'ALB' });
  const casab   = await post('/api/cuentas', headers, { name: 'Casab',   identifier: 'CAS' });
  const inq     = await post('/api/cuentas', headers, { name: 'Inquilino-X' });

  const sociedad = await post('/api/sociedades', headers, {
    name: 'DA',
    socios: [
      { cuentaId: alberto.id, percentBps: 5000 },
      { cuentaId: casab.id,   percentBps: 5000 },
    ],
  });

  const banco = await post('/api/bancos', headers, { sociedadId: sociedad.id, nombre: 'Banco DA', numero: '042' });

  const propiedad = await post('/api/propiedades', headers, {
    sociedadId: sociedad.id,
    nombre: 'Av. Mayo 123 4B',
    direccion: 'Av. Mayo 123, Piso 4 B, CABA',
  });

  const contrato = await post('/api/contratos', headers, {
    propiedadId: propiedad.id,
    inquilinoId: inq.id,
    monto: '10000000',
    moneda: 'ARS',
    fechaInicio: '2026-04-01',
  });

  return { user, alberto, casab, inq, sociedad, banco, propiedad, contrato };
}

async function post(url: string, headers: Record<string, string>, body: unknown) {
  const res = await app.inject({ method: 'POST', url, headers, payload: body as object });
  if (res.statusCode >= 400) {
    throw new Error(`${res.statusCode} ${url}: ${res.body}`);
  }
  return res.json();
}

async function get(url: string, headers: Record<string, string>) {
  const res = await app.inject({ method: 'GET', url, headers });
  if (res.statusCode >= 400) throw new Error(`${res.statusCode} ${url}: ${res.body}`);
  return res.json();
}

describe('Smoke: full happy path', () => {
  it('cobro alquiler a banco → saldo banco sube', async () => {
    const { banco, contrato } = await seedScenario();
    const headers = authHeader(authToken);

    await post('/api/movimientos', headers, {
      fecha: '2026-04-10',
      tipo: 'ALQUILER_COBRO',
      monto: '10000000',
      moneda: 'ARS',
      destinoBucket: 'BANCO',
      destinoBancoId: banco.id,
      contratoId: contrato.id,
    });

    const after = await get(`/api/bancos/${banco.id}`, headers);
    expect(after.saldoArs).toBe('10000000');
  });

  it('transferencia banco→caja baja saldo banco; caja de ese día refleja el ingreso', async () => {
    const { banco } = await seedScenario();
    const headers = authHeader(authToken);

    // Seed banco with 10M via INGRESO_VARIO
    await post('/api/movimientos', headers, {
      fecha: '2026-04-10', tipo: 'INGRESO_VARIO', monto: '10000000', moneda: 'ARS',
      destinoBucket: 'BANCO', destinoBancoId: banco.id,
    });

    await post('/api/movimientos', headers, {
      fecha: '2026-04-10', tipo: 'TRANSFERENCIA', monto: '3000000', moneda: 'ARS',
      origenBucket: 'BANCO', origenBancoId: banco.id,
      destinoBucket: 'CAJA',
    });

    const after = await get(`/api/bancos/${banco.id}`, headers);
    expect(after.saldoArs).toBe('7000000');

    const caja = await get('/api/caja/2026-04-10', headers);
    expect(caja.currentSaldoArs).toBe('3000000');
  });

  it('gasto propiedad desde banco baja saldo banco', async () => {
    const { banco, propiedad } = await seedScenario();
    const headers = authHeader(authToken);
    await post('/api/movimientos', headers, {
      fecha: '2026-04-10', tipo: 'INGRESO_VARIO', monto: '5000000', moneda: 'ARS',
      destinoBucket: 'BANCO', destinoBancoId: banco.id,
    });
    await post('/api/movimientos', headers, {
      fecha: '2026-04-10', tipo: 'GASTO_PROPIEDAD', monto: '1000000', moneda: 'ARS',
      origenBucket: 'BANCO', origenBancoId: banco.id,
      propiedadId: propiedad.id,
    });
    const after = await get(`/api/bancos/${banco.id}`, headers);
    expect(after.saldoArs).toBe('4000000');
  });

  it('transfer banco→cuenta corriente deja la CC en saldo negativo (anticipo a socio)', async () => {
    const { banco, alberto } = await seedScenario();
    const headers = authHeader(authToken);
    await post('/api/movimientos', headers, {
      fecha: '2026-04-10', tipo: 'INGRESO_VARIO', monto: '10000000', moneda: 'ARS',
      destinoBucket: 'BANCO', destinoBancoId: banco.id,
    });
    await post('/api/movimientos', headers, {
      fecha: '2026-04-10', tipo: 'TRANSFERENCIA', monto: '500000', moneda: 'ARS',
      origenBucket: 'BANCO', origenBancoId: banco.id,
      destinoBucket: 'CUENTA_CORRIENTE', destinoCuentaId: alberto.id,
    });
    const cuenta = await get(`/api/cuentas/${alberto.id}`, headers);
    expect(cuenta.saldoArs).toBe('500000');
  });
});

describe('Smoke: business rules', () => {
  it('contrato FINALIZADO rechaza ALQUILER_COBRO con fecha posterior', async () => {
    const { contrato, banco } = await seedScenario();
    const headers = authHeader(authToken);

    await post(`/api/contratos/${contrato.id}/finalizar`, headers, {
      finalizadoEn: '2026-04-15',
      motivoFinalizacion: 'Inquilino se fue',
    });

    const res = await app.inject({
      method: 'POST', url: '/api/movimientos', headers,
      payload: {
        fecha: '2026-04-20', tipo: 'ALQUILER_COBRO', monto: '10000000', moneda: 'ARS',
        destinoBucket: 'BANCO', destinoBancoId: banco.id,
        contratoId: contrato.id,
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CONTRATO_FINALIZADO_FECHA_POSTERIOR');
  });

  it('sociedad.replaceSocios valida suma bps==10000', async () => {
    const { sociedad, alberto } = await seedScenario();
    const headers = authHeader(authToken);
    const res = await app.inject({
      method: 'POST', url: `/api/sociedades/${sociedad.id}/socios`, headers,
      payload: { socios: [{ cuentaId: alberto.id, percentBps: 6000 }] },
    });
    expect(res.statusCode).toBe(422);
  });

  it('reversar invierte saldos; doble-reversar rechaza', async () => {
    const { banco } = await seedScenario();
    const headers = authHeader(authToken);

    const mov = await post('/api/movimientos', headers, {
      fecha: '2026-04-10', tipo: 'INGRESO_VARIO', monto: '2500000', moneda: 'ARS',
      destinoBucket: 'BANCO', destinoBancoId: banco.id,
    });

    let after = await get(`/api/bancos/${banco.id}`, headers);
    expect(after.saldoArs).toBe('2500000');

    await post(`/api/movimientos/${mov.id}/reversar`, headers, { motivo: 'error de carga' });

    after = await get(`/api/bancos/${banco.id}`, headers);
    expect(after.saldoArs).toBe('0');

    // segunda reversa sobre el mismo original → rechazada
    const second = await app.inject({
      method: 'POST', url: `/api/movimientos/${mov.id}/reversar`, headers,
      payload: { motivo: 'otra' },
    });
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe('MOV_ALREADY_REVERSED');
  });

  it('caja CLOSED rechaza movimiento nuevo en esa fecha', async () => {
    const { banco } = await seedScenario();
    const headers = authHeader(authToken);
    // Create today's caja by touching it, then close it.
    const today = new Date().toISOString().slice(0, 10);
    await post('/api/movimientos', headers, {
      fecha: today, tipo: 'INGRESO_VARIO', monto: '1000', moneda: 'ARS',
      destinoBucket: 'BANCO', destinoBancoId: banco.id,
    });
    const caja = await get(`/api/caja/${today}`, headers);
    await post(`/api/caja/${caja.id}/cerrar`, headers, {});

    const res = await app.inject({
      method: 'POST', url: '/api/movimientos', headers,
      payload: {
        fecha: today, tipo: 'INGRESO_VARIO', monto: '500', moneda: 'ARS',
        destinoBucket: 'BANCO', destinoBancoId: banco.id,
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CAJA_CLOSED');
  });

  it('caja cerrar arrastra saldos finales como inicial del día siguiente', async () => {
    const { banco } = await seedScenario();
    const headers = authHeader(authToken);

    // Movimiento que entra a caja el 2026-04-10.
    await post('/api/movimientos', headers, {
      fecha: '2026-04-10', tipo: 'INGRESO_VARIO', monto: '7000000', moneda: 'ARS',
      destinoBucket: 'CAJA',
    });

    const caja = await get('/api/caja/2026-04-10', headers);
    await post(`/api/caja/${caja.id}/cerrar`, headers, {});

    const cerrada = await get('/api/caja/2026-04-10', headers);
    expect(cerrada.status).toBe('CLOSED');
    expect(cerrada.saldoFinalArs).toBe('7000000');

    const siguiente = await get('/api/caja/2026-04-11', headers);
    expect(siguiente.status).toBe('OPEN');
    expect(siguiente.saldoInicialArs).toBe('7000000');

    void banco;
  });

  it('reports/posicion reparte saldo de banco entre socios según bps', async () => {
    const { banco, alberto, casab } = await seedScenario();
    const headers = authHeader(authToken);
    await post('/api/movimientos', headers, {
      fecha: '2026-04-10', tipo: 'INGRESO_VARIO', monto: '10000000', moneda: 'ARS',
      destinoBucket: 'BANCO', destinoBancoId: banco.id,
    });
    const posicion = await get('/api/reports/posicion', headers);
    const daSociedad = posicion.sociedades.find((s: { name: string }) => s.name === 'DA');
    expect(daSociedad.banco.saldoArs).toBe('10000000');
    const porSocio = Object.fromEntries(
      daSociedad.socios.map((s: { cuentaId: string; correspondeArs: string }) => [s.cuentaId, s.correspondeArs]),
    );
    expect(porSocio[alberto.id]).toBe('5000000');
    expect(porSocio[casab.id]).toBe('5000000');
  });

  it('contrato.POST pre-llena socios desde la sociedad si no se pasan', async () => {
    const { contrato, alberto, casab } = await seedScenario();
    const headers = authHeader(authToken);
    const full = await get(`/api/contratos/${contrato.id}`, headers);
    const cuentaIds = full.socios.map((s: { cuentaId: string }) => s.cuentaId).sort();
    expect(cuentaIds).toEqual([alberto.id, casab.id].sort());
    const totalBps = full.socios.reduce((s: number, x: { percentBps: number }) => s + x.percentBps, 0);
    expect(totalBps).toBe(10000);
  });

  it('alquileres report marca PENDIENTE cuando no hubo cobro este mes', async () => {
    const { contrato } = await seedScenario();
    const headers = authHeader(authToken);
    const alquileres = await get('/api/reports/alquileres', headers);
    const c = alquileres.find((a: { id: string }) => a.id === contrato.id);
    expect(c.estadoDelMes).toBe('PENDIENTE');
  });

  it('banco 1:1 con sociedad — rechaza segundo banco', async () => {
    const { sociedad } = await seedScenario();
    const headers = authHeader(authToken);
    const res = await app.inject({
      method: 'POST', url: '/api/bancos', headers,
      payload: { sociedadId: sociedad.id, nombre: 'Otro', numero: '999' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('BANCO_ALREADY_EXISTS_FOR_SOCIEDAD');
  });
});

describe('Smoke: serialization', () => {
  it('BigInt se serializa como string (no Number) para preservar precisión', async () => {
    const { banco } = await seedScenario();
    const headers = authHeader(authToken);
    await post('/api/movimientos', headers, {
      fecha: '2026-04-10', tipo: 'INGRESO_VARIO', monto: '1234567890', moneda: 'ARS',
      destinoBucket: 'BANCO', destinoBancoId: banco.id,
    });
    const res = await app.inject({ method: 'GET', url: `/api/bancos/${banco.id}`, headers });
    const raw = res.body;
    expect(raw).toContain('"saldoArs":"1234567890"');

    // Make sure sample non-BigInt fields remain their native types.
    const parsed = JSON.parse(raw);
    expect(parsed.isActive).toBe(true);
  });
});

void prisma; // keep import for setup side-effects
