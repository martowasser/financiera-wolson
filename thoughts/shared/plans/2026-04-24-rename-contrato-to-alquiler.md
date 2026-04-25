# Rename `Contrato` → `Alquiler` Implementation Plan

**Fecha:** 2026-04-24
**Autor:** Martin (con Claude Opus 4.7)
**Status:** PROPUESTO

---

## Overview

Renombrar la entidad `Contrato` a `Alquiler` en todo el codebase: schema Prisma (modelos, enums, relaciones, FKs, índices), API (módulo, rutas, servicios, schemas Zod), web (rutas, páginas, navegación, command palette, fetch URLs, types, labels), tests, seed, y `HANDOFF.md`. Todo en una sola PR para mantener coherencia.

`MovimientoTipo.ALQUILER_COBRO` permanece intacto — es el tipo de movimiento "cobro de alquiler", no una referencia a la entidad. La frase "cobro del alquiler #1000" sigue teniendo sentido tras el rename.

## Interview Summary

Decisiones tomadas:
1. **Migración DB**: drop + recreate. Las 4 migraciones existentes se borran y se regenera una sola migración inicial limpia con `Alquiler`. Justificación: no hay datos prod todavía, vale la pena el historial limpio.
2. **Label UI**: `Alquiler` (sing.) / `Alquileres` (pl.). Simple y consistente.
3. **Scope PR**: una sola PR. Rename incoherente entre capas dejaría la app rota.
4. **Docs históricos**: `thoughts/shared/plans/2026-04-23-rebuild-modelo-mariana.md` queda intacto (record histórico). Solo `HANDOFF.md` se actualiza.

## Current State Analysis

Inventario completo (relevado vía Explore agent):

### Schema Prisma (`apps/api/prisma/schema/`)
- `contrato.prisma` — modelos `Contrato`, `ContratoSocio`; enum `ContratoStatus`; relación `"ContratoInquilino"`; FK `contratoId` en `ContratoSocio`; 5 índices.
- `cuenta.prisma` — back-refs `contratoMemberships: ContratoSocio[]`, `contratosComoInquilino: Contrato[]`.
- `movimiento.prisma` — FK `contratoId`, relación `contrato`, índice `@@index([contratoId])`.

### API (`apps/api/src/`)
- `modules/contrato/` — `routes.ts`, `service.ts`, `schemas.ts`. ~9 funciones CRUD + socios + finalizar/reactivar.
- Rutas registradas: `/api/contratos`, `/api/contratos/:id`, `/api/contratos/by-numero/:numero`, `/api/contratos/:id/socios`, `/api/contratos/:id/finalizar`, `/api/contratos/:id/reactivar`.
- Otros módulos que usan `prisma.contrato.*`: `cuenta/service.ts:59`, `propiedad/service.ts:91`, `reporting/service.ts:90`, `movimiento/service.ts` (varias líneas: 160-180, 232, 284, 309, 325).
- Test setup: `test-setup.ts:33-34` (cleanup), `e2e-seed.ts:17-18`, `smoke.test.ts` (14 tests, varias referencias).

### Web (`apps/web/src/`)
- Rutas: `app/(operator)/contratos/page.tsx`, `app/(operator)/contratos/[id]/page.tsx`. (No hay rutas en `(viewer)`.)
- Componentes: `ContratosPage`, `ContratoDetailPage`, `SociosSection`, `FinalizarDialog`.
- Forms: `app/(operator)/movimientos/new-movimiento-form.tsx` — `requireContrato` (key del rule), state `contratoId`, fetch `/contratos`, label "Contrato".
- Dashboard: `app/(operator)/dashboard/page.tsx:169,180` — links `/contratos`.
- Tabla en propiedades: `app/(operator)/propiedades/page.tsx:36,105,123` — `_count.contratos`, header "# Contratos".
- Labels helper: `lib/labels.ts:23` — `contratoStatusLabels`.
- Navigation: `lib/commands/navigation.ts:10`, `lib/commands/use-palette-data.ts` (fetch + grupo "Contratos"), `lib/commands/actions.ts` (keywords).

### Tests / Seed
- `apps/api/src/smoke.test.ts` — variable `contrato`, FK `contratoId`, POST `/api/contratos`.
- `apps/api/src/e2e-seed.ts:17-18` — cleanup.
- `apps/api/src/test-setup.ts:33-34` — cleanup.
- `apps/api/prisma/seed.ts` — **no menciona Contrato**.

### Docs
- `HANDOFF.md` — 6 menciones a actualizar.
- `thoughts/shared/plans/2026-04-23-rebuild-modelo-mariana.md` — **NO se modifica** (histórico).

### Migraciones existentes (a borrar)
- `20260424200210_rebuild_modelo_mariana/`
- `20260424200211_numero_sequences_start_1000/`
- `20260424210000_drop_operator_role/`
- `20260424213000_drop_alquiler_pago/`

## Desired End State

- Modelos Prisma: `Alquiler`, `AlquilerSocio`, enum `AlquilerStatus`, relación `"AlquilerInquilino"`, FK `alquilerId`, back-refs `alquileresComoInquilino` y `alquilerMemberships`.
- API: módulo `apps/api/src/modules/alquiler/`, rutas `/api/alquileres/*`, todos los identifiers renombrados.
- Web: rutas `/alquileres/*`, componentes `AlquileresPage` / `AlquilerDetailPage`, fetch URLs `/alquileres`, navegación "Alquileres", label form "Alquiler".
- Una sola migración Prisma fresca (los 4 archivos viejos borrados) con tablas `Alquiler` y `AlquilerSocio`.
- `requireContrato` en movimiento rules → `requireAlquiler`.
- `numero` sigue arrancando en 1000 (la sequence se llamará `Alquiler_numero_seq`).
- Smoke tests pasan, typecheck pasa, login + flujo de creación de alquiler funcionan en navegador.

## What We're NOT Doing

- **NO** se renombra `MovimientoTipo.ALQUILER_COBRO` (es enum value de movimientos, ya correcto).
- **NO** se cambia `inquilinoId: Cuenta` por `inquilinoNombre: String` (separadamente discutido — pendiente decisión Mariana sobre saldos).
- **NO** se actualizan plan docs históricos en `thoughts/`.
- **NO** se mantiene compat backward (alias temporal `/api/contratos`). Es rename limpio.
- **NO** se cambia el path del módulo legacy `MovimientoCreadoPor`, `ContratoSocio` becomes `AlquilerSocio` pero relaciones similares en otros modelos quedan intactas.

## Implementation Approach

Orden de ejecución (dentro de la misma PR / commit set):

1. Schema + migración nueva (capa más bajo nivel).
2. API (rutas + servicios + schemas).
3. Web (rutas + componentes + navegación + forms + labels).
4. Tests + seed.
5. HANDOFF.md.
6. Verificación manual en navegador.

Nota: como es rename masivo, una buena estrategia es:
- Hacer find+replace asistidos por archivo (no globales ciegos), porque los identifiers tienen variantes case (`Contrato`, `contrato`, `contratoId`, `ContratoStatus`, `contratosComoInquilino`).
- Después de cada capa, correr `pnpm tsc --noEmit` (web) y `pnpm tsc --noEmit` (api) para detectar referencias rotas.

---

## Phase 1: Schema Prisma + Migración Fresca

### Overview
Renombrar modelos/enums/relaciones en los `.prisma`, borrar las 4 migraciones existentes, regenerar una sola migración inicial.

### Cambios

**File**: `apps/api/prisma/schema/contrato.prisma` → renombrar a `alquiler.prisma`
- `model Contrato` → `model Alquiler`
- `model ContratoSocio` → `model AlquilerSocio`
- `enum ContratoStatus` → `enum AlquilerStatus`
- Relación `"ContratoInquilino"` → `"AlquilerInquilino"`
- Field `contratoId` (en `AlquilerSocio`) → `alquilerId`
- Field `status: ContratoStatus` → `status: AlquilerStatus`
- Índice `@@index([inquilinoId])` etc. — los nombres son automáticos, no requieren cambio textual.
- Comentarios de cabecera: "Contrato de alquiler" → "Alquiler" (o similar).

**File**: `apps/api/prisma/schema/cuenta.prisma`
- `contratoMemberships ContratoSocio[]` → `alquilerMemberships AlquilerSocio[]`
- `contratosComoInquilino Contrato[] @relation("ContratoInquilino")` → `alquileresComoInquilino Alquiler[] @relation("AlquilerInquilino")`

**File**: `apps/api/prisma/schema/movimiento.prisma`
- `contratoId String?` → `alquilerId String?`
- `contrato Contrato? @relation(...)` → `alquiler Alquiler? @relation(...)`
- `@@index([contratoId])` → `@@index([alquilerId])`

**Migración**:
- Borrar:
  - `apps/api/prisma/schema/migrations/20260424200210_rebuild_modelo_mariana/`
  - `apps/api/prisma/schema/migrations/20260424200211_numero_sequences_start_1000/`
  - `apps/api/prisma/schema/migrations/20260424210000_drop_operator_role/`
  - `apps/api/prisma/schema/migrations/20260424213000_drop_alquiler_pago/`
- Resetear DB local: `pnpm prisma migrate reset --force` (borra DB + corre seed).
- Generar nueva migración: `pnpm prisma migrate dev --name initial_schema`.
- Verificar que la nueva migración SQL contenga `CREATE TABLE "Alquiler"` y `CREATE TABLE "AlquilerSocio"` sin rastro de `Contrato`.
- Re-aplicar la lógica de `numero_sequences_start_1000`: editar la migración generada para que las secuencias `Alquiler_numero_seq` y `Movimiento_numero_seq` empiecen en 1000 (o agregar manualmente `ALTER SEQUENCE`).

### Success Criteria
#### Automated
- [ ] `pnpm prisma generate` succeeds.
- [ ] `pnpm prisma migrate status` muestra DB in sync.
- [ ] El SQL generado **no contiene** la string `Contrato`.

#### Manual
- [ ] Inspeccionar la migración SQL nueva — confirmar `Alquiler`, `AlquilerSocio`, FKs y secuencias.
- [ ] `psql` o pgAdmin: tablas `Alquiler` y `AlquilerSocio` existen, sin `Contrato`.

---

## Phase 2: API Module Rename

### Overview
Renombrar el módulo entero, todas las funciones, schemas Zod, rutas, y referencias cruzadas en otros módulos.

### Cambios

**Directory rename**: `apps/api/src/modules/contrato/` → `apps/api/src/modules/alquiler/`

**File**: `apps/api/src/modules/alquiler/routes.ts`
- Path: `/contratos` → `/alquileres` en cada `fastify.get`/`post`/`put`/`delete`.
- Path: `/contratos/by-numero/:numero` → `/alquileres/by-numero/:numero`.
- Path: `/contratos/:id/socios|finalizar|reactivar` → `/alquileres/:id/socios|finalizar|reactivar`.
- Funciones renombradas:
  - `listContratos` → `listAlquileres`
  - `getContrato` → `getAlquiler`
  - `getContratoByNumero` → `getAlquilerByNumero`
  - `createContrato` → `createAlquiler`
  - `updateContrato` → `updateAlquiler`
  - `replaceContratoSocios` → `replaceAlquilerSocios`
  - `finalizarContrato` → `finalizarAlquiler`
  - `reactivarContrato` → `reactivarAlquiler`
  - `deleteContrato` → `deleteAlquiler`

**File**: `apps/api/src/modules/alquiler/service.ts`
- Mismos renames de funciones.
- `prisma.contrato.*` → `prisma.alquiler.*`
- `prisma.contratoSocio.*` → `prisma.alquilerSocio.*`
- Types: `ContratoWhereInput` → `AlquilerWhereInput`, `ContratoUpdateInput` → `AlquilerUpdateInput`.
- En `include`: `inquilino` (relación `Cuenta`) — mantener (no cambia).

**File**: `apps/api/src/modules/alquiler/schemas.ts`
- `createContratoSchema` → `createAlquilerSchema`
- `updateContratoSchema` → `updateAlquilerSchema`
- `replaceContratoSociosSchema` → `replaceAlquilerSociosSchema`
- `finalizarContratoSchema` → `finalizarAlquilerSchema`
- `listContratosQuerySchema` → `listAlquileresQuerySchema`
- Types correspondientes (`CreateContratoInput` → `CreateAlquilerInput`, etc.)

**File**: `apps/api/src/app.ts` (o donde se registren las rutas)
- Cambiar `import contratoRoutes from './modules/contrato/routes'` → `'./modules/alquiler/routes'`.
- Cambiar prefijo `/api/contratos` → `/api/alquileres` (o lo que use el `register`).

**File**: `apps/api/src/modules/movimiento/service.ts`
- Rule key `requireContrato` → `requireAlquiler` (en `MOVIMIENTO_RULES` o equivalente).
- Validaciones: `input.contratoId` → `input.alquilerId`.
- Prisma includes: `contrato: {...}` → `alquiler: {...}`.

**File**: `apps/api/src/modules/movimiento/schemas.ts`
- Si tiene `contratoId` en el schema → `alquilerId`.

**File**: `apps/api/src/modules/cuenta/service.ts:59`
- `prisma.contrato.count()` → `prisma.alquiler.count()`.

**File**: `apps/api/src/modules/propiedad/service.ts:91`
- `prisma.contrato.count()` → `prisma.alquiler.count()`. Si retorna `_count.contratos` para web → `_count.alquileres`.

**File**: `apps/api/src/modules/reporting/service.ts:90`
- `prisma.contrato.findMany()` → `prisma.alquiler.findMany()`.

### Success Criteria
#### Automated
- [ ] `pnpm --filter api typecheck` (o equivalente `tsc --noEmit`) pasa.
- [ ] `pnpm --filter api build` exitoso.
- [ ] `pnpm --filter api dev` arranca sin errores.

#### Manual
- [ ] `curl http://localhost:3001/api/alquileres` responde 200 (con auth) o 401 (sin).
- [ ] `curl http://localhost:3001/api/contratos` responde 404.

---

## Phase 3: Web Routes + UI

### Overview
Renombrar carpeta de rutas, componentes, navegación, fetches, types y todos los strings user-facing.

### Cambios

**Directory rename**: `apps/web/src/app/(operator)/contratos/` → `apps/web/src/app/(operator)/alquileres/`

**File**: `apps/web/src/app/(operator)/alquileres/page.tsx`
- Component `ContratosPage` → `AlquileresPage`.
- Type local `Contrato` → `Alquiler`.
- `useQuery<Contrato[]>('/contratos', ...)` → `useQuery<Alquiler[]>('/alquileres', ...)`.
- Header de página "Contratos" → "Alquileres".
- Cualquier label en filtros/tabla.

**File**: `apps/web/src/app/(operator)/alquileres/[id]/page.tsx`
- Component `ContratoDetailPage` → `AlquilerDetailPage`.
- Subcomponents `SociosSection`, `FinalizarDialog` (mantener nombres si no aluden a contrato; si dicen `ContratoSociosSection` → renombrar).
- Type local `Contrato` → `Alquiler`.
- Fetches `/contratos/${id}` → `/alquileres/${id}`.
- Mutations `/contratos/${id}/socios` → `/alquileres/${id}/socios`, idem `/finalizar`.
- Strings: "Contrato #1000" → "Alquiler #1000", "Finalizar contrato" → "Finalizar alquiler", etc.

**File**: `apps/web/src/app/(operator)/movimientos/new-movimiento-form.tsx`
- Type local `Contrato` → `Alquiler`.
- State `contratoId` / `setContratoId` → `alquilerId` / `setAlquilerId`.
- `useQuery<Contrato[]>('/contratos', { status: 'ACTIVO' })` → `useQuery<Alquiler[]>('/alquileres', { status: 'ACTIVO' })`.
- `requireContrato` (key del rule) → `requireAlquiler`.
- `<Label>Contrato</Label>` → `<Label>Alquiler</Label>`.
- Variable `contratos` (data) → `alquileres`.

**File**: `apps/web/src/app/(operator)/movimientos/page.tsx:256`
- Link `/contratos/${mov.contrato.id}` → `/alquileres/${mov.alquiler.id}`.
- Label "Contrato:" → "Alquiler:".
- Field `mov.contrato` → `mov.alquiler` (asume API ya devuelve `alquiler`).

**File**: `apps/web/src/app/(operator)/dashboard/page.tsx`
- Línea 42: type field `inquilino` (mantener).
- Línea 169: `<Link href="/contratos">Ver contratos</Link>` → `href="/alquileres">Ver alquileres`.
- Línea 180: `href={\`/contratos/${a.id}\`}` → `\`/alquileres/${a.id}\``.
- Línea 181: si dice "contrato" en algún span, cambiar.

**File**: `apps/web/src/app/(operator)/propiedades/page.tsx`
- Línea 36: `_count: { contratos: number }` → `_count: { alquileres: number }`.
- Línea 105: `<th>"# Contratos"</th>` → `<th>"# Alquileres"</th>`.
- Línea 123: `{p._count.contratos}` → `{p._count.alquileres}`.

**File**: `apps/web/src/lib/labels.ts:23`
- `contratoStatusLabels` → `alquilerStatusLabels`.
- Importadores: actualizar import statements.

**File**: `apps/web/src/lib/commands/navigation.ts`
- `{ href: '/contratos', label: 'Contratos', keywords: [...] }` → `{ href: '/alquileres', label: 'Alquileres', keywords: ['contratos', 'leases'] }`. Mantener "contratos" en keywords para que la búsqueda en command palette siga funcionando para usuarios acostumbrados al término viejo.

**File**: `apps/web/src/lib/commands/use-palette-data.ts`
- Type `ContratoSummary` → `AlquilerSummary`.
- `useQuery<ContratoSummary[]>('/contratos')` → `useQuery<AlquilerSummary[]>('/alquileres')`.
- Variable `contratos` → `alquileres`.
- `router.push(\`/contratos/${c.id}\`)` → `\`/alquileres/${c.id}\``.
- `group: 'Contratos'` → `group: 'Alquileres'`.

**File**: `apps/web/src/lib/commands/actions.ts`
- Si tiene action "Crear contrato" → "Crear alquiler".
- keywords: cambiar 'inquilino' OK, agregar/mover 'contrato' a keywords si la action principal cambia label.

### Success Criteria
#### Automated
- [ ] `pnpm --filter web typecheck` pasa.
- [ ] `pnpm --filter web build` exitoso.
- [ ] `grep -r "/contratos" apps/web/src/` retorna 0.
- [ ] `grep -r "Contrato" apps/web/src/` retorna 0 (excepto comentarios histórico si decidimos preservar — none expected).

#### Manual
- [ ] Navegar a `http://localhost:3000/alquileres` muestra la lista.
- [ ] `http://localhost:3000/contratos` retorna 404 de Next.
- [ ] Crear un nuevo alquiler funciona (formulario, persiste, redirige).
- [ ] Detail page muestra socios + acciones (finalizar, reactivar).
- [ ] Crear un movimiento `ALQUILER_COBRO` muestra el dropdown "Alquiler" y guarda con `alquilerId`.

---

## Phase 4: Tests + Seed

### Overview
Actualizar tests funcionales para usar nuevos paths y identifiers.

### Cambios

**File**: `apps/api/src/test-setup.ts:33-34`
- `prisma.contratoSocio.deleteMany()` → `prisma.alquilerSocio.deleteMany()`.
- `prisma.contrato.deleteMany()` → `prisma.alquiler.deleteMany()`.

**File**: `apps/api/src/e2e-seed.ts:17-18`
- Mismos renames.

**File**: `apps/api/src/smoke.test.ts`
- Variable `contrato` → `alquiler` (todas las referencias).
- POST `/api/contratos` → `/api/alquileres`.
- Body field `contratoId` → `alquilerId`.
- Test names: si dicen "crea contrato" → "crea alquiler".

**File**: `apps/api/prisma/seed.ts`
- No requiere cambios (no menciona Contrato).

### Success Criteria
#### Automated
- [ ] `pnpm --filter api test` — los 14 smoke tests pasan.
- [ ] `pnpm --filter api test --reporter=verbose` — confirmar nombres legibles.

#### Manual
- [ ] N/A (cubierto por automated).

---

## Phase 5: Docs (HANDOFF.md)

### Overview
Actualizar el doc vivo de handoff. NO tocar `thoughts/shared/plans/`.

### Cambios

**File**: `HANDOFF.md`
- Línea 27: `\`Contrato\` + \`ContratoSocio\`` → `\`Alquiler\` + \`AlquilerSocio\``.
- Línea 43: `/api/contratos — contrato — CRUD ...` → `/api/alquileres — alquiler — CRUD ...`.
- Línea 51: path UI `contratos + [id]` → `alquileres + [id]`.
- Línea 60: descripción smoke tests si menciona "contrato" → "alquiler".
- Línea 84: `Contrato.POST pre-llena socios` → `Alquiler.POST pre-llena socios`.
- Línea 97: "Crear contrato sobre esa propiedad… contrato #1000" → "Crear alquiler sobre esa propiedad… alquiler #1000".

### Success Criteria
#### Manual
- [ ] `grep -in "contrato" HANDOFF.md` retorna 0.

---

## Phase 6: Verificación Manual End-to-End

### Overview
Smoke manual en navegador, golden path completo.

### Pasos
1. `pnpm --filter api dev` + `pnpm --filter web dev`.
2. Login como `mariana / admin123`.
3. Navegar a "Alquileres" desde sidebar / command palette (Cmd+K → "alquileres").
4. Crear un nuevo alquiler:
   - Seleccionar propiedad existente.
   - Seleccionar inquilino (Cuenta).
   - Monto + moneda + fecha inicio.
   - Confirmar socios pre-llenados desde la sociedad.
5. Verificar que el alquiler aparece con `numero` (ej. #1000) en la lista.
6. Abrir detalle, finalizar el alquiler, reactivar.
7. Crear un movimiento `ALQUILER_COBRO`:
   - Verificar que el dropdown "Alquiler" muestra los alquileres activos.
   - Guardar el movimiento.
8. Volver al dashboard — confirmar que "Ver alquileres" linkea bien.
9. Ir a `/propiedades` — confirmar columna "# Alquileres".

### Success Criteria
- [ ] Todos los pasos completan sin errores.
- [ ] No hay 404s en network tab.
- [ ] No hay errores en consola del navegador o de Fastify.

---

## Edge Cases Addressed

1. **Colisión de vocabulario con `ALQUILER_COBRO`**: el enum se queda; "cobro del alquiler #1000" sigue siendo coherente.
2. **Command palette búsqueda por término viejo**: keywords mantiene "contratos" para que Mariana pueda seguir buscando con la palabra vieja durante la transición.
3. **Migration squash**: borramos las 4 migraciones existentes — esto rompe ambientes ya migrados (no aplica acá: solo dev local + sin prod), pero deja el schema histórico-limpio.
4. **Sequences `numero` arrancando en 1000**: la migración generada por `prisma migrate dev` no setea el start de la sequence; hay que editarla manualmente o agregar un `ALTER SEQUENCE` post-create.
5. **Forms con `requireContrato` rule key**: este es un identifier interno (no string user-facing) pero coupled con el form — debe renombrarse en API y Web simultáneamente para evitar drift.
6. **`thoughts/` plan docs**: quedan con vocabulario viejo "Contrato". Esto es intencional (record histórico). Si alguien los lee en el futuro, va a ver Contrato — esto es OK.

## Testing Strategy

- **Schema**: Prisma generate + migrate reset valida que el schema compila y se aplica.
- **API**: smoke tests (14) + typecheck + build.
- **Web**: typecheck + build + smoke manual en navegador.
- **Integración**: el smoke manual cubre el flujo completo (crear alquiler → crear movimiento que lo referencia → ver en dashboard).

## References

- Inventario completo: ver Step 1 de este plan (sección "Current State Analysis").
- Plan de rebuild original: `thoughts/shared/plans/2026-04-23-rebuild-modelo-mariana.md` (NO modificar).
- Decisión sobre inquilino-as-Cuenta: pendiente, separada de este rename.
