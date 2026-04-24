# Plan: Rebuild del modelo de datos y UI operador para alinear con Mariana (post-entrevista 2)

**Fecha:** 2026-04-23
**Última actualización:** 2026-04-24 (revisión decisión por decisión)
**Origen:** `transcripcion-entrevista-2-mariana.md` (reunión 2026-04-23 con Mariana) + screenshots del sistema legacy (contratos con socios, tomados 2026-04-24)
**Scope:** Schema nuevo completo + backend plano (sin doble entrada) + UI operador reorganizada
**Viewer de Alberto:** fuera de scope de este plan. Ver `2026-04-24-viewer-alberto.md`.

---

## Overview

Este plan descarta la arquitectura actual de contabilidad de doble entrada y reescribe el sistema sobre el **modelo mental real de Mariana**, captado en la entrevista:

- **Buckets explícitos** donde vive la plata: caja global (efectivo), bancos de sociedades, y cuentas corrientes de socios/terceros. Cada movimiento sale y/o entra de un bucket concreto.
- **Cuenta corriente como entidad fundamental** (no "persona"). Tiene saldo propio en ARS + USD.
- **Sociedad como agrupación operativa**: socios default + 1 banco. Agrupa propiedades.
- **Propiedad**: metadata de la propiedad física; pertenece a una sociedad; es el lugar donde se atribuyen gastos que sobreviven cambios de inquilino (ABL, expensas).
- **Contrato**: unidad fundamental de alquiler; pertenece a una propiedad; tiene **sus propios socios con %** (pre-cargados desde la sociedad pero editables). Confirmado por los screenshots del legacy.
- **Caja global** (no por sociedad), con filtro por sociedad en la UI.
- **Movimientos planos** con origen + destino que apuntan a buckets. Sin `Entry`, sin doble entrada.

El resultado es un sistema conceptualmente más chico, más cercano a la planilla Excel que reemplaza, y auditable sin complejidad contable.

---

## Interview Summary

Decisiones tomadas en la revisión iterativa (ver historial de conversación):

| # | Decisión | Implicancia |
|---|----------|-------------|
| 1 | Scope: modelo + UI Mariana (viewer Alberto **movido** a plan separado) | 6 fases, sin deadline duro |
| 2 | Schema nuevo completo | Se descartan las migraciones y modelos actuales; se reemplaza todo el dominio |
| 3 | Reset DB + seed mínimo (3 usuarios + 1 cuenta raíz "Financiera") | Mariana carga datos reales en la demo |
| 4 | Una cuenta bancaria por sociedad, con saldos ARS + USD en un solo registro | Relación 1:1 entre Sociedad y Banco |
| 5 | Tirar doble entrada, modelo plano | Se eliminan `Entry`, trigger PG, módulo `ledger`, `Account`, `Transaction` |
| 6 | Multi-moneda: `saldoArs` y `saldoUsd` separados en cada bucket | Movimiento lleva `moneda`, actualiza saldo correcto |
| 7 | Caja global + filtro por sociedad en UI | Un solo `CajaDia` por fecha; movimientos filtrables transitivamente |
| 8 | **Viewer Alberto: movido a plan separado** | Este plan solo toca operador |
| 9 | Sin módulo de facturación | Flag `facturado` + campo `comprobante` en el movimiento |
| 10 | Transferencias: un solo movimiento con origen + destino | Aplica a cualquier combo caja↔banco↔cuenta corriente |
| 11 | Tipos de movimiento: enum cerrado pero amplio + `notes` libre | 12 tipos incluyendo `GASTO_PROPIEDAD` |
| 12 | Settlement on-the-fly, sin tabla | Cálculo en runtime en `/api/reports/posicion` |
| 13 | Solo % actual, sin historial | `SociedadSocio` y `ContratoSocio` solo guardan `percentBps` actual |
| 14 | Hotkeys: no tocar | Cmd+K existente se mantiene, se reapuntan las entradas |
| 15 | Sin modelo "Persona"; `Cuenta` es la entidad | Una persona con N cuentas se distingue por `identifier` + `notes` |
| 16 | Contratos tienen **sus propios socios** (pre-llenados desde Sociedad, editables) | `ContratoSocio` existe; confirmado por screenshots del legacy |
| 17 | Propiedad **existe** como entidad, pertenece a Sociedad | Para continuidad de gastos ABL/expensas entre contratos sucesivos |
| 18 | Alberto siempre tiene % > 0 en toda sociedad/contrato | Reporting no maneja el caso "Alberto = 0%" |
| 19 | Finalización de contrato: status + `finalizadoEn` + `motivoFinalizacion`, distinto de `fechaFin` | `fechaFin` es vencimiento planificado; la finalización es acción explícita |
| 20 | **Buckets para movimientos**: CAJA / BANCO / CUENTA_CORRIENTE. Todo movimiento apunta a al menos un bucket | `Movimiento` tiene `origen*` y `destino*` con discriminador |
| 21 | Cuenta corriente tiene saldo propio (ARS + USD) | Para trackear anticipos/préstamos entre socios y sociedades |

### Reglas de distribución por tipo de movimiento (confirmadas)

| Tipo | Socios usados para reparto |
|---|---|
| `ALQUILER_COBRO`, `ALQUILER_PAGO` | Socios del **Contrato** |
| `GASTO_PROPIEDAD` (ABL, expensas, mantenimiento) | Socios de la **Sociedad** (vía propiedad → sociedad) |
| `COMISION_BANCARIA`, `DEBITO_AUTOMATICO`, `SIRCREB` | Socios de la **Sociedad** (vía banco) |
| `GASTO_SOCIEDAD`, `INGRESO_VARIO` atribuidos a sociedad | Socios de la **Sociedad** |
| `TRANSFERENCIA`, `AJUSTE` | No reparte (solo mueve saldos entre buckets) |

---

## Current State Analysis

### Qué existe hoy

**Backend (`apps/api`):**
- Prisma schema modular en `apps/api/prisma/schema/` (14 archivos .prisma)
- 12 módulos en `apps/api/src/modules/`: auth, entity, ownership, account, period, ledger, property, lease, invoice, settlement, reconciliation, reporting
- Trigger Postgres para validar entries balanceados
- 20 tests (doble entrada, reversos, idempotencia, etc.)
- BigInt → Number en serialización

**Frontend (`apps/web`):**
- Next.js 16 + shadcn v4 + @base-ui/react
- Operador: 11 pantallas en `src/app/(operator)/*`
- Viewer: 4 pantallas en `src/app/(viewer)/viewer/*` (**no se tocan en este plan**; el rediseño va en `2026-04-24-viewer-alberto.md`)
- Auth: JWT en memoria + refresh en cookie SameSite
- `src/lib/shortcuts/` + `src/lib/commands/` (Cmd+K command palette)

**Qué sobrevive (sin cambios funcionales):**
- `apps/api/src/index.ts` (server bootstrap, CORS, rate limit, helmet)
- Módulo `auth/` entero (login, register, refresh, logout, JWT)
- `User` model + `RefreshToken` model
- `AuditLog` model (reutilizable como bitácora genérica)
- Webframework: Fastify + Zod validation
- Frontend `lib/` (api.ts, auth-context.tsx, hooks.ts, format.ts)
- Componentes genéricos: `DataTable`, `PageHeader`, `Combobox`, `AppSidebar`, `ui/*`
- Command palette actual (Cmd+K) — se mantiene tal cual, las entradas se actualizan para apuntar a las pantallas nuevas
- Login + redirects por rol
- **Todo el viewer actual se deja intacto** en este plan

**Qué se tira:**
- Módulos: `entity`, `ownership`, `account`, `period`, `ledger`, `property`, `lease`, `invoice`, `settlement`, `reconciliation`, `reporting`
- Modelos Prisma: `Entity`, `EntityType` enum, `Ownership`, `Account`, `AccountType`, `SociedadMember`, `Property`, `Lease`, `LeasePrice`, `LeaseManager` enum, `Invoice`, `InvoiceRetention`, `Transaction`, `Entry`, `EntryType`, `OwnerSettlement`, `BankReconciliation`, `BankReconciliationItem`, `Period`, `PeriodStatus`
- Trigger SQL de doble entrada
- Pantallas operador viejas: `accounts`, `entities`, `invoices`, `leases`, `period`, `properties`, `reconciliation`, `settlements`, `transactions`
- Tests del ledger/settlement/invoice/reconciliation

---

## Desired End State

Un sistema donde:

1. El schema Prisma tiene **10 modelos de negocio** (Cuenta, Sociedad, SociedadSocio, Banco, Propiedad, Contrato, ContratoSocio, Movimiento, CajaDia, AuditLog) + 2 de auth (User, RefreshToken).
2. El backend expone **8 módulos de negocio** (auth + cuenta + sociedad + banco + propiedad + contrato + caja + movimiento + reporting), todos sobre el modelo plano con buckets.
3. La UI del operador tiene **7 pantallas** (dashboard, cuentas, sociedades, propiedades, contratos, caja, movimientos) — todas respetan el modelo mental de Mariana. No hay "persona". No aparece "crédito/débito" en flujos normales. Los identificadores son legibles (números incrementales tipo `#1234`).
4. La DB de dev arranca vacía con un seed mínimo (3 usuarios + 1 cuenta raíz "Financiera").
5. Los tests pasan (suite reducida pero coherente: ~20 tests).
6. `HANDOFF.md` actualizado.
7. El viewer actual sigue funcionando pero apuntando a un backend distinto; quedará obsoleto hasta que el plan separado de Alberto lo rehaga. Se marca esa situación explícitamente en HANDOFF.md.

### Verificación manual

- `pnpm db:reset && pnpm db:seed` deja una DB con 3 usuarios + 1 cuenta Financiera.
- Login como `mariana@financiera.com` → dashboard operador limpio.
- Crear cuentas Alberto + Casab + Inquilino-X → crear sociedad "DA" con socios Alberto 50% + Casab 50% → crear banco nº 042 → crear propiedad "Av. Mayo 123 4B" dentro de DA → crear contrato sobre esa propiedad con inquilino Inquilino-X, monto 100k ARS, socios heredados editables → cargar cobro de alquiler → caja del día refleja el ingreso (si fue en efectivo) o el banco (si transferencia) → cierre del día funciona → al día siguiente, historial visible con movimientos de DA filtrables.
- Registrar un anticipo: "Alberto retira 5k del banco DA" → crea movimiento TRANSFERENCIA origen=banco DA, destino=cuenta corriente Alberto → la cuenta corriente de Alberto queda con saldo -5k (debe a la sociedad).

---

## What We're NOT Doing

Explícitamente **fuera del scope** de este plan:

- **Viewer de Alberto (`/viewer/*`).** Se rediseña en el plan separado `thoughts/shared/plans/2026-04-24-viewer-alberto.md`. Las 4 pantallas actuales del viewer quedan temporalmente "rotas" (apuntan a un backend que ya no existe) hasta que se ejecute ese plan — HANDOFF.md documenta esta situación.
- **Conciliación bancaria:** se deja fuera hasta la reunión siguiente con datos reales. Se elimina el módulo actual; el nuevo se planifica después.
- **Hotkeys letra suelta (C/J/O/A/M/E):** explícitamente pedido no tocar. Cmd+K actual se mantiene.
- **Historial de % de socios (validFrom/validUntil):** sin soporte.
- **Sociedades anidadas:** fuera.
- **Facturación con IVA/retenciones:** fuera. Solo flag `facturado` + string `comprobante`.
- **Settlement persistido / aprobaciones:** fuera. Todo on-the-fly.
- **Multiples cuentas bancarias por sociedad:** regla dura 1:1.
- **Conversión automática de moneda / cambio de divisa:** Mariana registra dos movimientos separados ante un cambio ARS↔USD. Sin tipo de cambio almacenado.
- **Tracking de DNI/CUIT/contacto en cuenta corriente:** solo `name` + `identifier` + `notes` por ahora.

---

## Implementation Approach

### Filosofía

- **Rebuild mayor, no migración.** Sin preservar datos. Sin retrocompatibilidad. El POC es nuevo.
- **Schema primero, backend después, UI al final.** Cada fase deja testeable lo anterior.
- **Borrar antes de escribir.** Quitamos código viejo en cada fase antes de agregar el nuevo.
- **Módulos aislados.** Cada módulo backend es un paquete cerrado: rutas + service + schema Zod. Sin cross-imports.
- **Tests focalizados.** Testeamos reglas de negocio nuevas (saldos de cada bucket, cierre de caja, distribución de movimientos, finalización de contrato, consistencia transaccional de saldos).

### Branching

- Trabajo en rama `rebuild/modelo-mariana` (nueva, cortada desde `main`).
- Commits pequeños por fase.
- No se mergea a `main` hasta que las 6 fases estén completas y la demo con Mariana se valide.
- Tag `pre-rebuild-2026-04-23` sobre `main` como safety net.

### Multi-agente

- **Phase 1 (schema)** bloquea todo lo demás.
- **Phases 2.x (módulos backend)** son independientes entre sí una vez schema listo → paralelizables.
- **Phase 3 (frontend operador) depende de Phase 2.** Subfases por pantalla son paralelizables una vez el shell (3.1) esté hecho.
- **Phase 4 (UX polish operador) depende de Phase 3.**
- **Phase 5 (limpieza + handoff)** secuencial, al final.
- **Phase 6 (placeholder de conciliación)** opcional.

---

## Phase 1: Schema nuevo + migraciones + seed mínimo

### Overview

Reemplazar el schema Prisma completo por los 12 modelos del modelo nuevo. Tirar todas las migraciones y generar una migración fresh. Reducir el seed a 3 usuarios + 1 cuenta raíz "Financiera".

**Dependencias:** ninguna. **Bloquea:** Phase 2. **Paralelizable:** no.

### Changes Required

#### 1.1 Backup y limpieza

- Tag git: `git tag pre-rebuild-2026-04-23`.
- Branch: `rebuild/modelo-mariana`.
- Eliminar `apps/api/prisma/migrations/` (mantener solo `migration_lock.toml`).

#### 1.2 Reescribir `apps/api/prisma/schema/`

Borrar todos los .prisma excepto `@main.prisma` y `user.prisma`. Crear los siguientes nuevos:

**Archivo NUEVO:** `apps/api/prisma/schema/cuenta.prisma`
```prisma
// Cuenta corriente: entidad fundamental. Representa socios, inquilinos, contrapartes.
// No existe el concepto separado de "Persona". Una persona física puede tener N cuentas,
// distinguidas por `identifier` + `notes`.
// Tiene saldo propio en ARS y USD (denormalizado, actualizado transaccionalmente).
model Cuenta {
  id         String   @id @default(cuid())
  name       String
  identifier String?  @unique
  notes      String?
  saldoArs   BigInt   @default(0) // centavos; puede ser negativo
  saldoUsd   BigInt   @default(0)
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  deletedAt  DateTime?

  sociedadMemberships    SociedadSocio[]
  contratoMemberships    ContratoSocio[]
  contratosComoInquilino Contrato[]      @relation("ContratoInquilino")
  movimientosOrigen      Movimiento[]    @relation("MovimientoOrigenCuenta")
  movimientosDestino     Movimiento[]    @relation("MovimientoDestinoCuenta")

  @@index([name])
  @@index([identifier])
}
```

**Archivo NUEVO:** `apps/api/prisma/schema/sociedad.prisma`
```prisma
// Sociedad: agrupación operativa. 1 banco + N socios + N propiedades.
model Sociedad {
  id        String   @id @default(cuid())
  name      String   @unique
  notes     String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  socios       SociedadSocio[]
  banco        Banco?
  propiedades  Propiedad[]
  movimientos  Movimiento[] // movimientos con atribución explícita a esta sociedad

  @@index([name])
}

// Socios default de la sociedad. Suma percentBps == 10000 (100%).
// Usados para reparto de gastos bancarios y de propiedad.
model SociedadSocio {
  id         String   @id @default(cuid())
  sociedadId String
  cuentaId   String
  percentBps Int
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  sociedad Sociedad @relation(fields: [sociedadId], references: [id], onDelete: Cascade)
  cuenta   Cuenta   @relation(fields: [cuentaId], references: [id])

  @@unique([sociedadId, cuentaId])
  @@index([sociedadId])
  @@index([cuentaId])
}
```

**Archivo NUEVO:** `apps/api/prisma/schema/banco.prisma`
```prisma
// Banco: 1:1 con sociedad. Saldos ARS+USD denormalizados.
model Banco {
  id         String   @id @default(cuid())
  sociedadId String   @unique
  nombre     String
  numero     String
  saldoArs   BigInt   @default(0)
  saldoUsd   BigInt   @default(0)
  isActive   Boolean  @default(true)
  notes      String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  deletedAt  DateTime?

  sociedad           Sociedad     @relation(fields: [sociedadId], references: [id], onDelete: Cascade)
  movimientosOrigen  Movimiento[] @relation("MovimientoOrigenBanco")
  movimientosDestino Movimiento[] @relation("MovimientoDestinoBanco")

  @@index([sociedadId])
  @@index([numero])
}
```

**Archivo NUEVO:** `apps/api/prisma/schema/propiedad.prisma`
```prisma
// Propiedad: metadata física. Pertenece a una sociedad. Cobija contratos sucesivos.
// Gastos atribuibles a propiedad (ABL, expensas) sobreviven cambios de inquilino.
model Propiedad {
  id          String   @id @default(cuid())
  sociedadId  String
  nombre      String
  direccion   String
  descripcion String?
  isActive    Boolean  @default(true)
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  sociedad    Sociedad     @relation(fields: [sociedadId], references: [id])
  contratos   Contrato[]
  movimientos Movimiento[]

  @@index([sociedadId])
  @@index([nombre])
}
```

**Archivo NUEVO:** `apps/api/prisma/schema/contrato.prisma`
```prisma
// Contrato de alquiler. Pertenece a una propiedad. Tiene sus propios socios con %.
// Al crear, socios se pre-llenan con los de la sociedad; Mariana puede editarlos.
// `numero` es incremental desde 1000 (tipo legacy).
model Contrato {
  id                  String          @id @default(cuid())
  numero              Int             @unique @default(autoincrement())
  propiedadId         String
  inquilinoId         String
  monto               BigInt
  moneda              Moneda
  fechaInicio         DateTime        @db.Date
  fechaFin            DateTime?       @db.Date // vencimiento planificado
  status              ContratoStatus  @default(ACTIVO)
  finalizadoEn        DateTime?       @db.Date // fecha real de finalización
  motivoFinalizacion  String?
  notes               String?
  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt
  deletedAt           DateTime?

  propiedad   Propiedad       @relation(fields: [propiedadId], references: [id])
  inquilino   Cuenta          @relation("ContratoInquilino", fields: [inquilinoId], references: [id])
  socios      ContratoSocio[]
  movimientos Movimiento[]

  @@index([status])
  @@index([fechaInicio])
  @@index([inquilinoId])
  @@index([propiedadId])
  @@index([numero])
}

enum ContratoStatus {
  ACTIVO
  FINALIZADO
}

enum Moneda {
  ARS
  USD
}

// Socios del contrato con %. Suma percentBps == 10000.
model ContratoSocio {
  id         String   @id @default(cuid())
  contratoId String
  cuentaId   String
  percentBps Int
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  contrato Contrato @relation(fields: [contratoId], references: [id], onDelete: Cascade)
  cuenta   Cuenta   @relation(fields: [cuentaId], references: [id])

  @@unique([contratoId, cuentaId])
  @@index([contratoId])
  @@index([cuentaId])
}
```

**Archivo NUEVO:** `apps/api/prisma/schema/caja-dia.prisma`
```prisma
// Caja del día: singleton global por fecha. Saldos iniciales = saldos finales del día anterior cerrado.
model CajaDia {
  id              String     @id @default(cuid())
  fecha           DateTime   @unique @db.Date
  status          CajaStatus @default(OPEN)
  saldoInicialArs BigInt     @default(0)
  saldoInicialUsd BigInt     @default(0)
  saldoFinalArs   BigInt?
  saldoFinalUsd   BigInt?
  cerradoEn       DateTime?
  cerradoPorId    String?
  notes           String?

  cerradoPor  User?        @relation("CajaCerradoPor", fields: [cerradoPorId], references: [id])
  movimientos Movimiento[]

  @@index([fecha])
  @@index([status])
}

enum CajaStatus {
  OPEN
  CLOSED
}
```

**Archivo NUEVO:** `apps/api/prisma/schema/movimiento.prisma`
```prisma
// Movimiento de plata entre buckets.
// Un movimiento debe tener al menos un lado (origen o destino) apuntando a un bucket nuestro.
// Buckets: CAJA (efectivo global, moneda en el propio campo) | BANCO (de sociedad) | CUENTA_CORRIENTE (de socio/tercero).
//
// Semántica:
//   - INGRESO: origen=null (externo), destino=bucket interno
//   - EGRESO:  origen=bucket interno, destino=null (externo)
//   - TRANSFERENCIA: origen=bucket interno, destino=bucket interno, distintos
//
// `tipo` clasifica el movimiento para reporting (alquiler, gasto bancario, etc.).
// `sociedadId`, `propiedadId`, `contratoId`, `cuentaId` son referencias de contexto
// (para filtrado transitivo y para reparto en reporting).
//
// `numero` autoincremental desde 1000 (tipo legacy).
model Movimiento {
  id             String         @id @default(cuid())
  numero         Int            @unique @default(autoincrement())
  fecha          DateTime       @db.Date
  cajaDiaId      String
  tipo           MovimientoTipo
  monto          BigInt         // centavos, siempre positivo
  moneda         Moneda

  // Origen (required si EGRESO o TRANSFERENCIA)
  origenBucket   BucketTipo?
  origenBancoId  String?
  origenCuentaId String?

  // Destino (required si INGRESO o TRANSFERENCIA)
  destinoBucket   BucketTipo?
  destinoBancoId  String?
  destinoCuentaId String?

  // Contexto
  sociedadId     String?
  propiedadId    String?
  contratoId     String?
  cuentaContraparteId String? // inquilino, tercero, etc. Solo informativo.

  comprobante    String?
  facturado      Boolean        @default(false)
  notes          String?

  reversoDeId    String?        @unique
  reversadoPor   Movimiento?    @relation("MovimientoReverso", fields: [reversoDeId], references: [id])
  reversos       Movimiento[]   @relation("MovimientoReverso")

  createdAt      DateTime       @default(now())
  createdById    String
  createdBy      User           @relation("MovimientoCreadoPor", fields: [createdById], references: [id])

  cajaDia        CajaDia        @relation(fields: [cajaDiaId], references: [id])
  bancoOrigen    Banco?         @relation("MovimientoOrigenBanco",  fields: [origenBancoId],   references: [id])
  bancoDestino   Banco?         @relation("MovimientoDestinoBanco", fields: [destinoBancoId],  references: [id])
  cuentaOrigen   Cuenta?        @relation("MovimientoOrigenCuenta",  fields: [origenCuentaId],  references: [id])
  cuentaDestino  Cuenta?        @relation("MovimientoDestinoCuenta", fields: [destinoCuentaId], references: [id])
  sociedad       Sociedad?      @relation(fields: [sociedadId], references: [id])
  propiedad      Propiedad?     @relation(fields: [propiedadId], references: [id])
  contrato       Contrato?      @relation(fields: [contratoId], references: [id])

  @@index([fecha])
  @@index([cajaDiaId])
  @@index([sociedadId])
  @@index([propiedadId])
  @@index([contratoId])
  @@index([tipo])
  @@index([numero])
}

enum BucketTipo {
  CAJA
  BANCO
  CUENTA_CORRIENTE
}

enum MovimientoTipo {
  ALQUILER_COBRO      // cobro de alquiler (usa socios del contrato)
  ALQUILER_PAGO       // pago de alquiler a terceros
  GASTO               // gasto genérico sin atribución (efectivo suelto)
  GASTO_SOCIEDAD      // gasto atribuido a sociedad (usa socios de sociedad)
  GASTO_PROPIEDAD     // ABL, expensas, mantenimiento (usa socios de sociedad)
  INGRESO_VARIO       // ingreso excepcional
  TRANSFERENCIA       // mueve plata entre dos buckets internos
  COMISION_BANCARIA
  DEBITO_AUTOMATICO
  RECUPERO
  AJUSTE              // ajuste manual; requiere notes
  OTRO                // requiere notes
}
```

**Archivo NUEVO/EDITAR:** `apps/api/prisma/schema/audit-log.prisma`
```prisma
model AuditLog {
  id        String   @id @default(cuid())
  entity    String
  entityId  String
  action    String
  before    Json?
  after     Json?
  userId    String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([entity, entityId])
  @@index([userId])
  @@index([createdAt])
}
```

#### 1.3 Primera migración

```bash
# Desde apps/api/
pnpm prisma migrate dev --name rebuild_modelo_mariana --create-only
# Revisar manualmente: sin triggers de doble entrada
pnpm prisma migrate dev
pnpm prisma generate
```

#### 1.4 Reemplazar seed

**Archivo:** `apps/api/prisma/seed.ts`

```ts
// Seed mínimo: solo usuarios y cuenta raíz "Financiera".
// Mariana carga el resto en vivo.
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10)

  await prisma.user.createMany({
    data: [
      { email: 'admin@financiera.com',   passwordHash, name: 'Admin',   role: 'ADMIN' },
      { email: 'mariana@financiera.com', passwordHash, name: 'Mariana', role: 'OPERATOR' },
      { email: 'alberto@financiera.com', passwordHash, name: 'Alberto', role: 'VIEWER' },
    ],
    skipDuplicates: true,
  })

  await prisma.cuenta.upsert({
    where: { identifier: 'FIN' },
    update: {},
    create: { name: 'Financiera (casa matriz)', identifier: 'FIN', notes: 'Entidad raíz del sistema.' },
  })

  console.log('Seed mínimo completado.')
}

main().finally(() => prisma.$disconnect())
```

#### 1.5 Shared types

**Archivo:** `packages/shared/src/types.ts`

Eliminar exports de tipos viejos. Re-exportar:

```ts
export type {
  Cuenta,
  Sociedad,
  SociedadSocio,
  Banco,
  Propiedad,
  Contrato,
  ContratoSocio,
  CajaDia,
  Movimiento,
  MovimientoTipo,
  BucketTipo,
  ContratoStatus,
  CajaStatus,
  Moneda,
} from '@prisma/client'
```

### Success Criteria

#### Automated
- [ ] `pnpm db:reset` sin error.
- [ ] `pnpm db:seed` crea 3 users + 1 Cuenta.
- [ ] `pnpm prisma generate` sin warnings.
- [ ] `pnpm -w typecheck` pasa en api y shared.

#### Manual
- [ ] Prisma Studio muestra las 10 tablas de negocio + 2 de auth. Ninguna vieja.
- [ ] Migración fresh, sin referencias a triggers de doble entrada.

---

## Phase 2: Backend — módulos nuevos

**Dependencias:** Phase 1. **Paralelizable por subfase.**

### 2.0 Borrar módulos viejos

```bash
cd apps/api/src/modules
rm -rf account entity ownership ledger period property lease invoice settlement reconciliation reporting
```

Actualizar `apps/api/src/index.ts`: comentar los registers viejos. Quedan `auth` y `health`.

### 2.1 Módulo `cuenta`

**Files:** `apps/api/src/modules/cuenta/{routes,service,schemas}.ts`

**Endpoints:**
- `GET /api/cuentas` — list con filtros `?q=`, `?active=true`.
- `GET /api/cuentas/:id`
- `POST /api/cuentas` — `{ name, identifier?, notes? }`.
- `PUT /api/cuentas/:id`
- `DELETE /api/cuentas/:id` — soft delete; valida sin memberships activas.
- `GET /api/cuentas/:id/movimientos` — movimientos donde esta cuenta es origen, destino, o contraparte.

**Reglas:**
- `identifier` único si presente.
- `saldoArs` y `saldoUsd` no se editan directo; se recalculan desde movimientos.

**Tests (`cuenta.service.test.ts`):** CRUD + soft delete con dependencias.

### 2.2 Módulo `sociedad`

**Files:** `apps/api/src/modules/sociedad/{routes,service,schemas}.ts`

**Endpoints:**
- `GET /api/sociedades` — list con flags `?includeSocios`, `?includeBanco`, `?includePropiedades`.
- `GET /api/sociedades/:id`
- `POST /api/sociedades` — `{ name, notes?, socios?: [{cuentaId, percentBps}] }`. Suma==10000 si se pasan socios.
- `PUT /api/sociedades/:id`
- `POST /api/sociedades/:id/socios` — reemplaza set de socios. Suma==10000.
- `DELETE /api/sociedades/:id` — soft delete; rechaza con movimientos activos.

**Reglas:**
- Suma de `percentBps` de socios activos == 10000.
- Cada cuenta solo una vez por sociedad.

**Tests:** crear con socios, validación %, update.

### 2.3 Módulo `banco`

**Files:** `apps/api/src/modules/banco/{routes,service,schemas}.ts`

**Endpoints:**
- `GET /api/bancos` — list con filtros.
- `GET /api/bancos/:id`
- `POST /api/bancos` — `{ sociedadId, nombre, numero, notes? }`. 1:1 con sociedad (rechaza si ya existe).
- `PUT /api/bancos/:id`
- `POST /api/bancos/:id/cerrar` — `isActive=false`. No acepta movimientos nuevos pero histórico visible.
- `POST /api/bancos/:id/reabrir`
- `POST /api/bancos/:id/recalcular-saldo` — admin only. Recomputa `saldoArs`/`saldoUsd` desde movimientos.

**Reglas:** 1:1, saldos empiezan 0.

**Tests:** crear 1:1, rechazar segundo, cerrar/reabrir, recalcular.

### 2.4 Módulo `propiedad` **[NUEVO]**

**Files:** `apps/api/src/modules/propiedad/{routes,service,schemas}.ts`

**Endpoints:**
- `GET /api/propiedades` — list con `?sociedadId=`, `?active=true`.
- `GET /api/propiedades/:id` — incluye contratos (ACTIVO y FINALIZADO).
- `POST /api/propiedades` — `{ sociedadId, nombre, direccion, descripcion?, notes? }`.
- `PUT /api/propiedades/:id`
- `DELETE /api/propiedades/:id` — soft delete; rechaza con contratos o movimientos activos.

**Reglas:**
- Una propiedad requiere sociedad.
- No validar unicidad de dirección (Mariana puede tener varias unidades en la misma dirección).

**Tests:** crear bajo sociedad, rechazar delete con contratos.

### 2.5 Módulo `contrato`

**Files:** `apps/api/src/modules/contrato/{routes,service,schemas}.ts`

**Endpoints:**
- `GET /api/contratos` — filtros `?status`, `?propiedadId`, `?inquilinoId`, `?sociedadId`.
- `GET /api/contratos/:id` — full con socios e inquilino.
- `POST /api/contratos` — `{ propiedadId, inquilinoId, monto, moneda, fechaInicio, fechaFin?, notes?, socios?: [...] }`. Si `socios` no se pasa, se pre-llena con los de la sociedad de la propiedad.
- `PUT /api/contratos/:id` — campos editables excepto `propiedadId`, `status`.
- `POST /api/contratos/:id/socios` — reemplaza set de socios. Suma==10000.
- `POST /api/contratos/:id/finalizar` — `{ finalizadoEn, motivoFinalizacion }`. Status → FINALIZADO.
- `POST /api/contratos/:id/reactivar` — admin only.
- `DELETE /api/contratos/:id` — soft delete; rechaza con movimientos.

**Reglas:**
- Socios suma 100%.
- Finalización bloquea `ALQUILER_COBRO`/`ALQUILER_PAGO` con fecha > `finalizadoEn`.
- `fechaFin` es planificada; no implica finalización automática.

**Tests:** crear con pre-llenado, finalizar, rechazar cobro post-finalización, reactivar.

### 2.6 Módulo `caja`

**Files:** `apps/api/src/modules/caja/{routes,service,schemas}.ts`

**Endpoints:**
- `GET /api/caja/today` — caja de hoy; crea si no existe arrastrando saldos.
- `GET /api/caja/:fecha` — YYYY-MM-DD.
- `GET /api/caja` — list paginada descendente con `?from=&to=`.
- `POST /api/caja/:id/cerrar` — `{ notes? }`. Status → CLOSED, computa saldos finales, crea caja del día siguiente.
- `POST /api/caja/:id/reabrir` — admin only; solo si la caja del día siguiente no tiene movimientos.

**Reglas:**
- 1 caja por fecha.
- Caja nueva arrastra saldos del último CLOSED.
- Caja CLOSED no acepta movimientos.

**Tests:** abrir, cerrar, arrastre de saldos.

### 2.7 Módulo `movimiento` **[CORE]**

**Files:** `apps/api/src/modules/movimiento/{routes,service,schemas}.ts`

**Endpoints:**
- `GET /api/movimientos` — filtros amplios: `?fecha`, `?from=&to=`, `?sociedadId`, `?propiedadId`, `?contratoId`, `?bancoId`, `?cuentaId`, `?tipo`, `?q`.
  - **Filtro por sociedad es transitivo:** incluye movimientos con `sociedadId` directo, o donde `origenBancoId`/`destinoBancoId` pertenezca a la sociedad, o donde `contratoId.propiedad.sociedadId == X`.
- `GET /api/movimientos/:id`
- `GET /api/movimientos/by-numero/:numero`
- `POST /api/movimientos` — discriminated union por tipo (ver abajo).
- `POST /api/movimientos/:id/reversar` — `{ motivo }`. Crea espejo, actualiza saldos inversamente.
- `PUT /api/movimientos/:id` — solo `notes`, `comprobante`, `facturado`. Resto no editable.

**Input `POST /api/movimientos`:**
```ts
type Base = {
  fecha: string              // ISO date
  monto: string              // BigInt as string
  moneda: 'ARS' | 'USD'
  notes?: string
  comprobante?: string
  facturado?: boolean
}

// Según tipo, cambian los campos de origen/destino/contexto:

type AlquilerCobro = Base & {
  tipo: 'ALQUILER_COBRO'
  contratoId: string        // requerido
  destinoBucket: 'CAJA' | 'BANCO'
  destinoBancoId?: string   // si destinoBucket=BANCO
}

type AlquilerPago = Base & {
  tipo: 'ALQUILER_PAGO'
  contratoId: string
  origenBucket: 'CAJA' | 'BANCO'
  origenBancoId?: string
}

type Gasto = Base & {
  tipo: 'GASTO'
  origenBucket: 'CAJA' | 'BANCO' | 'CUENTA_CORRIENTE'
  origenBancoId?: string
  origenCuentaId?: string
  cuentaContraparteId?: string
}

type GastoSociedad = Base & {
  tipo: 'GASTO_SOCIEDAD'
  sociedadId: string        // requerido
  origenBucket: 'CAJA' | 'BANCO'
  origenBancoId?: string
}

type GastoPropiedad = Base & {
  tipo: 'GASTO_PROPIEDAD'
  propiedadId: string       // requerido; sociedad se deriva
  origenBucket: 'CAJA' | 'BANCO'
  origenBancoId?: string
}

type IngresoVario = Base & {
  tipo: 'INGRESO_VARIO'
  destinoBucket: 'CAJA' | 'BANCO' | 'CUENTA_CORRIENTE'
  destinoBancoId?: string
  destinoCuentaId?: string
  sociedadId?: string
  cuentaContraparteId?: string
}

type Transferencia = Base & {
  tipo: 'TRANSFERENCIA'
  origenBucket: 'CAJA' | 'BANCO' | 'CUENTA_CORRIENTE'
  origenBancoId?: string
  origenCuentaId?: string
  destinoBucket: 'CAJA' | 'BANCO' | 'CUENTA_CORRIENTE'
  destinoBancoId?: string
  destinoCuentaId?: string
  // Validación: origen y destino distintos
}

type ComisionBancaria | DebitoAutomatico = Base & {
  tipo: 'COMISION_BANCARIA' | 'DEBITO_AUTOMATICO'
  origenBancoId: string     // requerido
  // sociedad derivada del banco
}

type Recupero = Base & {
  tipo: 'RECUPERO'
  destinoBucket: 'CAJA' | 'BANCO' | 'CUENTA_CORRIENTE'
  destinoBancoId?: string
  destinoCuentaId?: string
  sociedadId?: string
  propiedadId?: string
}

type Ajuste = Base & {
  tipo: 'AJUSTE'
  notes: string             // requerido
  origenBucket?: ...; destinoBucket?: ...  // al menos uno
}

type Otro = Base & {
  tipo: 'OTRO'
  notes: string
  origenBucket?: ...; destinoBucket?: ...  // al menos uno
}
```

**Reglas de negocio (en service):**
1. Obtener/crear `CajaDia` por `fecha`. Validar no CLOSED.
2. Validar que bancos/cuentas referenciadas existan y estén activas.
3. Si el tipo implica contexto requerido (contratoId, propiedadId, sociedadId) → validar presente.
4. Si `contratoId` presente → si contrato FINALIZADO y tipo=ALQUILER_COBRO/PAGO → rechazar si fecha > `finalizadoEn`.
5. Si `propiedadId` presente y `sociedadId` no → derivar `sociedadId = propiedad.sociedadId`.
6. Si banco presente y `sociedadId` no → derivar `sociedadId = banco.sociedadId`.
7. Validación buckets:
   - INGRESO: destino requerido, origen null.
   - EGRESO: origen requerido, destino null.
   - TRANSFERENCIA: ambos requeridos, distintos.
   - COMISION_BANCARIA / DEBITO_AUTOMATICO: origen=BANCO siempre (no hay destino, es egreso).
   - AJUSTE/OTRO: al menos uno de los dos; flexibilidad controlada.
8. **Todo dentro de `prisma.$transaction`:**
   - Crear Movimiento.
   - Actualizar saldos de buckets afectados (`saldoArs` o `saldoUsd` del banco/cuenta, o no tocar si es caja — caja se recalcula diferente).
   - Para caja: no hay campo `saldo` actual; saldos de caja se calculan desde `CajaDia.saldoInicial + movimientos del día`. Nota: esto se expone en endpoint `GET /api/caja/today` calculando en runtime.
9. Números BigInt en requests/responses como strings (siguiendo el patrón actual de la app).

**Concurrencia:** `prisma.$transaction` con `isolationLevel: 'Serializable'` para operaciones que tocan saldos. Alternativamente, `UPDATE ... SET saldoArs = saldoArs + ?` atómico (Prisma `increment`).

**Reversar:** crea Movimiento espejo con `reversoDeId`. Aplica delta inverso en saldos. No se puede reversar un reverso.

**Tests (`movimiento.service.test.ts`):**
- Crear cada tipo básico (cobro alquiler a caja, a banco, gasto, transferencia, comisión).
- Transferencia banco→caja: saldo banco baja, saldo caja lo refleja.
- Alquiler cobro contra contrato FINALIZADO con fecha post: rechaza.
- Reversar movimiento: saldos vuelven.
- Reversar reverso: rechaza.
- Concurrencia: 5 inserts paralelos al mismo banco → saldo final correcto.
- Caja CERRADA rechaza movimiento nuevo.

### 2.8 Módulo `reporting`

**Files:** `apps/api/src/modules/reporting/{routes,service}.ts`

**Endpoints:**
- `GET /api/reports/posicion` — posición consolidada por entidad con reparto por socios. Estructura:
  ```ts
  {
    sociedades: [{
      id, name,
      banco: { saldoArs, saldoUsd } | null,
      socios: [{ cuentaId, name, percentBps, correspondeArs, correspondeUsd }]
    }],
    caja: { saldoArs, saldoUsd },
    cuentas: [{ id, name, saldoArs, saldoUsd }]  // saldos de cuentas corrientes
  }
  ```
- `GET /api/reports/alquileres` — lista de contratos con estado de cobro del mes.
  ```ts
  [{
    id, numero, propiedad: { nombre, direccion }, inquilinoName,
    monto, moneda, status, fechaInicio, fechaFin, finalizadoEn,
    socios: [{cuentaName, percentBps}],
    estadoDelMes: 'AL_DIA' | 'PENDIENTE' | 'SIN_FACTURAR',
    ultimoCobro: { fecha, comprobante } | null
  }]
  ```
- `GET /api/reports/sociedad/:id/movimientos` — reusa `GET /movimientos` con filtro transitivo.
- `GET /api/reports/caja/:fecha/resumen` — saldos apertura/cierre, totales por tipo.

**"Estado del mes":**
- Ventana: primer día del mes actual.
- AL_DIA: existe ALQUILER_COBRO en este mes, facturado=true.
- SIN_FACTURAR: existe ALQUILER_COBRO en este mes, facturado=false.
- PENDIENTE: no existe ALQUILER_COBRO en este mes y contrato está ACTIVO.

**Tests:** verificar cálculos con casos semilla.

### 2.9 Registrar routes

**Archivo:** `apps/api/src/index.ts`

```ts
await fastify.register(cuentaRoutes,     { prefix: '/api/cuentas' })
await fastify.register(sociedadRoutes,   { prefix: '/api/sociedades' })
await fastify.register(bancoRoutes,      { prefix: '/api/bancos' })
await fastify.register(propiedadRoutes,  { prefix: '/api/propiedades' })
await fastify.register(contratoRoutes,   { prefix: '/api/contratos' })
await fastify.register(cajaRoutes,       { prefix: '/api/caja' })
await fastify.register(movimientoRoutes, { prefix: '/api/movimientos' })
await fastify.register(reportingRoutes,  { prefix: '/api/reports' })
```

### Success Criteria (Phase 2)

#### Automated
- [ ] `pnpm -w test` verde, ~20 tests.
- [ ] `pnpm -w typecheck` verde.
- [ ] `pnpm -w build` verde.

#### Manual (flujo end-to-end via curl o Bruno)
1. POST cuentas Alberto + Casab + Inquilino-X.
2. POST sociedad DA con socios Alberto 50% / Casab 50%.
3. POST banco para DA nº "042".
4. POST propiedad bajo DA "Av. Mayo 123 4B".
5. POST contrato sobre esa propiedad: Inquilino-X, 100k ARS, socios heredados.
6. GET caja/today → abre caja del día.
7. POST movimiento ALQUILER_COBRO 100k ARS al banco → saldo banco +100k.
8. POST movimiento TRANSFERENCIA 50k ARS banco→caja → saldo banco 50k.
9. POST movimiento GASTO_PROPIEDAD 10k ARS desde banco → saldo banco 40k.
10. POST movimiento TRANSFERENCIA banco→cuenta corriente Alberto 5k → cuenta Alberto saldo -5k.
11. POST caja/:id/cerrar → saldo final 50k ARS en caja (cierre global).
12. GET reports/posicion → DA saldo banco 40k ARS; Alberto corresponde 20k (50%); cuenta Alberto saldo -5k.
13. POST contrato/:id/finalizar → status FINALIZADO.
14. POST ALQUILER_COBRO con fecha post finalización → 409.

---

## Phase 3: Frontend operador — pantallas core

**Dependencias:** Phase 2. **Paralelizable** por subfase una vez shell (3.1) hecho.

### 3.0 Borrar pantallas viejas

```bash
cd apps/web/src/app/\(operator\)
rm -rf accounts entities invoices leases period properties reconciliation settlements transactions
# Dejar: dashboard y layout
```

### 3.1 Shell operador

**Files:**
- `apps/web/src/app/(operator)/layout.tsx`
- `apps/web/src/components/app-sidebar.tsx`
- `apps/web/src/lib/commands/index.ts`

Sidebar y Cmd+K con 7 items: Dashboard, Cuentas, Sociedades, Propiedades, Contratos, Caja, Movimientos.

Header con saldo rápido caja del día (ARS + USD) de `/api/caja/today`.

### 3.2 Dashboard (`/dashboard`)

- Cards: saldo caja ARS/USD, suma de saldos bancarios ARS/USD.
- Tabla: últimos 10 movimientos de hoy.
- Tabla: alquileres pendientes del mes.
- Accesos rápidos: "Cargar movimiento", "Cerrar caja".

### 3.3 Cuentas (`/cuentas`)

- Tabla: name, identifier, saldoArs, saldoUsd, activa.
- Filtros: búsqueda, toggle inactivas.
- Modal crear/editar.
- Detalle: movimientos de la cuenta (origen + destino + contraparte).

### 3.4 Sociedades (`/sociedades` + `/sociedades/[id]`)

**List:** name, # socios, banco nº, saldo banco ARS+USD, # propiedades.

**Detail:** header, sección Banco (datos + saldo + botón cerrar/reabrir + crear si no existe), sección Socios (tabla editable, suma 100%), sección Propiedades (lista con link), sección Movimientos (filtrados transitivamente).

### 3.5 Propiedades (`/propiedades` + `/propiedades/[id]`) **[NUEVO]**

**List:** nombre, dirección, sociedad, # contratos, activa. Filtro por sociedad.

**Detail:** datos propiedad, lista de contratos (activos + finalizados), movimientos atribuidos a la propiedad (GASTO_PROPIEDAD, RECUPERO).

### 3.6 Contratos (`/contratos` + `/contratos/[id]`)

**List:** `#numero`, dirección (propiedad), inquilino, monto + moneda, status, fechaInicio, fechaFin.

**Detail:** datos, propiedad (link), inquilino, socios (tabla editable; suma 100%), botón Finalizar (modal con fecha + motivo), banner si FINALIZADO + botón Reactivar (admin), historial de movimientos ALQUILER_*.

### 3.7 Caja (`/caja` + `/caja/[fecha]`)

**Hoy:** saldo ARS/USD, lista movimientos del día (filtros sociedad, tipo), botones "Cargar movimiento" y "Cerrar caja".

**Histórico:** calendario + sidebar con días cerrados. Vista idéntica en read-only + "Resumen de cierre" (saldo inicial, final, totales por tipo).

### 3.8 Movimientos (`/movimientos`)

**Tabla:** `#numero`, fecha, tipo (badge), monto+moneda, **origen → destino** (con etiquetas legibles tipo "Caja ARS → Banco DA ARS"), contexto (sociedad/contrato/propiedad), notas truncadas.

**Filtros:** rango fecha, tipo, sociedad, propiedad, contrato, banco, cuenta, búsqueda libre.

**Formulario Nuevo movimiento:**
- Paso 1: seleccionar tipo (segmented control o dropdown).
- Paso 2: campos según tipo (discriminated union mappea al form):
  - Selector de **origen** (si aplica): Caja / Banco X / Cuenta Corriente Y.
  - Selector de **destino** (si aplica): idem.
  - Fecha, monto, moneda.
  - Contexto (contrato, propiedad, sociedad, contraparte) según tipo.
  - Comprobante, facturado, notas.
- Validación client + server-side.
- Keyboard-first (Enter avanza, Ctrl+Enter guarda).
- **Sin palabras "débito"/"crédito".** Etiquetas: "De dónde sale" / "A dónde va" / "Entra" / "Sale".

**Detalle de movimiento:** botón Reversar + modal con motivo.

### Success Criteria (Phase 3)

- [ ] `pnpm -w build` verde.
- [ ] Flujo UI completo (mismo end-to-end que Phase 2, pero vía pantallas).
- [ ] Número legible `#1000+` en todas las vistas de movimientos.
- [ ] Formulario de movimiento no menciona débito/crédito.
- [ ] Al crear contrato, socios se pre-llenan con los de la sociedad.

---

## Phase 4: UX polish operador

**Dependencias:** Phase 3.

### 4.1 Identificadores legibles

Verificar en todas las vistas (caja, histórico, detalle de contrato/sociedad/propiedad) que aparece `#1234` y no cuids.

### 4.2 Sin débito/crédito en UI

Auditoría manual: buscar "débito", "crédito", "debit", "credit" en `apps/web/src/` (excluyendo comentarios internos si aplica) y reemplazar en UI por "entra/sale" o etiquetas equivalentes.

### 4.3 Campos de origen/destino claros

Auditar formulario de movimiento: labels inequívocos según bucket seleccionado. Ejemplo: si Mariana elige `CUENTA_CORRIENTE` como origen, el selector siguiente dice "De qué cuenta corriente" y lista las cuentas.

### 4.4 Bancos cerrados fuera de dropdowns

- Dropdowns de "Banco origen/destino" en formulario solo listan bancos activos.
- Movimientos históricos con banco cerrado siguen visibles.
- Detalle de banco cerrado muestra badge "Cerrado" + histórico.

### 4.5 Movimientos excepcionales a cuenta corriente

Verificar que los tipos `INGRESO_VARIO`, `RECUPERO`, `AJUSTE`, `OTRO` permiten seleccionar `CUENTA_CORRIENTE` como destino/origen y que la UI lo refleja.

### 4.6 Historial de cajas

Ya cubierto en 3.7. Smoke test manual: abrir día cerrado, ver lista completa de movimientos + resumen.

### Success Criteria

- Auditoría manual positiva para cada 4.x.

---

## Phase 5: Limpieza + handoff

**Dependencias:** Phases 1-4.

### 5.1 Actualizar HANDOFF.md

- Marcar Fases 1-3 originales como "pre-rebuild".
- Nueva sección "Fase 4 — Rebuild post-entrevista Mariana (2026-04-23/24)" con:
  - Qué cambió a nivel schema.
  - Lista de módulos activos + endpoints.
  - Lista de módulos eliminados.
  - Comandos actualizados (`pnpm db:reset && pnpm db:seed` → DB vacía con 3 users).
  - Usuarios de prueba.
- **Nota explícita: el viewer `/viewer/*` quedó temporalmente roto después de este plan.** Ver `thoughts/shared/plans/2026-04-24-viewer-alberto.md` para el rediseño. Mientras ese plan no se ejecute, evitar loguearse con `alberto@financiera.com` o redirigir al login.

### 5.2 Quitar el viewer viejo del path crítico

- Opción pragmática: en `apps/web/src/app/(viewer)/layout.tsx`, mostrar un mensaje tipo "Vista temporalmente no disponible; estamos trabajando en una nueva" en lugar de intentar renderizar las 4 pantallas viejas (que llamarían a endpoints que ya no existen).
- Redirigir VIEWER al login o a un placeholder mientras el plan de Alberto no esté hecho.

### 5.3 Actualizar memoria

Agregar en `memory/`:
- `modelo_datos_2026-04-24.md` — resumen del nuevo modelo (buckets, sociedades, propiedades, contratos).

### 5.4 QA final

```bash
pnpm -w typecheck
pnpm -w build
pnpm -w test
```

### 5.5 Commit + PR

- Commits atómicos por fase.
- PR hacia `main` con descripción apuntando a este plan.

---

## Phase 6 (opcional): Placeholder de conciliación

**File NUEVO:** `apps/web/src/app/(operator)/conciliacion/page.tsx`

Página que dice "La conciliación bancaria se está rediseñando para trabajar con datos reales. La retomaremos en la próxima reunión." Entrada en sidebar con indicador "próximamente".

---

## Edge Cases Addressed

| Caso | Tratamiento |
|------|-------------|
| Sociedad sin socios | Se permite crear; bloqueo para distribución hasta sumar 100% |
| Banco cerrado + intento de movimiento | 409 |
| Caja CLOSED + retrocarga | Admin puede reabrir (si día siguiente está vacío); operador no |
| Contrato FINALIZADO + cobro posterior | Rechazado |
| Reversar reverso | Rechazado |
| Concurrencia sobre saldo de banco | `prisma.$transaction` con Serializable / update atómico con `increment` |
| Saldo bancario o de cuenta corriente negativo | Permitido; UI rojo |
| Identifier duplicado en Cuenta | 409 por índice único |
| Socios suman 99.99% o 100.01% | 422 (suma exacta a 10000 bps) |
| CajaDia hoy no existe al cargar mov | Se crea auto, arrastra saldos |
| Sin día CLOSED previo | Saldos iniciales 0 |
| Propiedad sin sociedad | No permitido (required en schema) |
| Movimiento sin origen y sin destino | 422 |
| Movimiento con origen == destino | 422 (solo relevante en transferencia; validado) |
| ALQUILER_COBRO sin contratoId | 422 |
| GASTO_PROPIEDAD sin propiedadId | 422 |
| Bucket=BANCO sin bancoId | 422 |
| Bucket=CUENTA_CORRIENTE sin cuentaId | 422 |

---

## Testing Strategy

### Unit tests backend (~20)

- `cuenta.service`: CRUD + delete con dependencias (3).
- `sociedad.service`: crear/editar socios + validación % (3).
- `banco.service`: 1:1, cerrar/reabrir, recalcular (3).
- `propiedad.service`: CRUD bajo sociedad (2).
- `contrato.service`: crear con pre-llenado, finalizar, rechazar post-finalización (3).
- `caja.service`: abrir/cerrar/arrastre (2).
- `movimiento.service`: tipos representativos + transferencia + concurrencia + reverso (6).
- `reporting.service`: posición + estado del mes (2).

### Integration

Un flujo end-to-end via supertest: todo el flujo descrito en Phase 2 Success Criteria.

### Frontend

- `pnpm build` de Next.
- Playwright: reescribir los e2e existentes contra el modelo nuevo (al menos login + crear sociedad + cargar movimiento).

---

## References

- `/transcripcion-entrevista-2-mariana.md` — transcripción de la reunión.
- Screenshots del sistema legacy (2026-04-24, carpeta `~/Documents/Screenshot 2026-04-24 at 12.14.43 AM.png` y `...12.15.08 AM.png`) — confirman socios a nivel de contrato.
- Memorias relevantes: `mariana_workflow.md`, `seed_vs_prod.md`, `alberto_viewer_profile.md`.
- HANDOFF.md actual (se actualiza en Phase 5).
- Plan vecino: `thoughts/shared/plans/2026-04-24-viewer-alberto.md` (rediseño del viewer de Alberto, independiente).

---

## Orden de ejecución recomendado para multi-agente

```
Phase 1 [secuencial] ─┬─ Phase 2.1 cuenta
                      ├─ Phase 2.2 sociedad
                      ├─ Phase 2.3 banco
                      ├─ Phase 2.4 propiedad
                      ├─ Phase 2.5 contrato
                      ├─ Phase 2.6 caja
                      ├─ Phase 2.7 movimiento   ← clave, más pesado
                      └─ Phase 2.8 reporting
                             │
                             ▼
                      Phase 2.9 register routes [secuencial, tras todos]
                             │
                             ▼
                      Phase 3.1 shell
                             │
         ┌───────┬─────┬─────┼─────┬─────┬─────┐
         ▼       ▼     ▼     ▼     ▼     ▼     ▼
       3.2    3.3   3.4   3.5   3.6   3.7   3.8   [paralelos]
         │
         ▼
       Phase 4 UX polish [tras 3]
         │
         ▼
       Phase 5 limpieza + handoff
         │
         ▼
       Phase 6 placeholder conciliación (opcional)
```
