# Handoff — Sistema Financiero

## Estado actual
- [x] Fase 1 — Backend completo (completada 2026-04-09) — **pre-rebuild, ver Fase 4**
- [x] Fase 2 — Frontend OPERATOR (completada 2026-04-10) — **pre-rebuild, ver Fase 4**
- [x] Fase 3 — Frontend VIEWER (completada 2026-04-10) — **reemplazado por placeholder, ver Fase 4**
- [x] Fase 4 — Rebuild post-entrevista Mariana (completada 2026-04-24)

---

## Fase 4 — Rebuild post-entrevista Mariana (2026-04-24)

### Contexto
Tras la segunda entrevista con Mariana (`transcripcion-entrevista-2-mariana.md`, 2026-04-23) y screenshots del sistema legacy, se reescribió el sistema sobre **su modelo mental real**, no sobre contabilidad de doble entrada.

Plan con decisiones: `thoughts/shared/plans/2026-04-23-rebuild-modelo-mariana.md`.
Tag safety: `pre-rebuild-2026-04-23` en `main`.

### Schema nuevo
Se tiraron Entity, Account, Transaction, Entry, Period, Ownership, Property, Lease, Invoice, OwnerSettlement, BankReconciliation, SociedadMember + trigger PG de doble entrada.

10 modelos de negocio + 2 auth:
- `Cuenta` (reemplaza Person/Entity; saldos ARS+USD propios)
- `Sociedad` + `SociedadSocio` (bps==10000)
- `Banco` (1:1 con sociedad, saldos ARS+USD)
- `Propiedad`
- `Contrato` + `ContratoSocio` (socios pre-llenados desde sociedad, editables). `numero` desde 1000
- `CajaDia` (singleton por fecha, arrastra saldos)
- `Movimiento` (`origenBucket` + `destinoBucket`: CAJA | BANCO | CUENTA_CORRIENTE). `numero` desde 1000
- `AuditLog` (genérico before/after — **no escrito por ningún módulo aún**)

Migraciones fresh: `20260424200210_rebuild_modelo_mariana` + `20260424200211_numero_sequences_start_1000`.

### Módulos backend

| Prefijo | Módulo |
|---|---|
| `/api/auth` | auth (sin cambios) |
| `/api/cuentas` | cuenta — CRUD + `GET /:id/movimientos` |
| `/api/sociedades` | sociedad — CRUD + `POST /:id/socios` (reemplaza, suma==10000) |
| `/api/bancos` | banco — CRUD + cerrar/reabrir + admin `POST /:id/recalcular-saldo` |
| `/api/propiedades` | propiedad — CRUD |
| `/api/contratos` | contrato — CRUD + socios + finalizar + admin reactivar |
| `/api/caja` | caja — today auto-create, cerrar (crea día siguiente), admin reabrir |
| `/api/movimientos` | movimiento — POST con flow rules per-tipo, reversar, PUT notes/comprobante/facturado |
| `/api/reports` | reporting — `/posicion`, `/alquileres`, `/caja/:fecha/resumen` |

Eliminados: account, entity, ownership, period, ledger, property, lease, invoice, settlement, reconciliation, reporting viejo, sociedad-member.

### UI operator — 7 pantallas en `apps/web/src/app/(operator)/`
`/dashboard`, `/cuentas` + `[id]`, `/sociedades` + `[id]`, `/propiedades` + `[id]`, `/contratos` + `[id]`, `/caja` + `[fecha]`, `/movimientos`.

Movimientos es el core — modal con flow rules mirrored del server (I/E/T/F) y etiquetas "De dónde sale" / "A dónde va". **Sin "débito"/"crédito".** Cmd+K + sidebar reapuntados.

### Viewer
`/viewer/*` es un placeholder "Vista temporalmente no disponible" (`apps/web/src/app/(viewer)/viewer/page.tsx`). Rediseño: `thoughts/shared/plans/2026-04-24-viewer-alberto.md`.

### Comandos
```bash
pnpm db:reset && pnpm db:seed     # DB vacía + 3 users + 1 cuenta Financiera
pnpm --filter @financiero/api build
pnpm --filter @financiero/api test    # --passWithNoTests (ver deuda técnica)
pnpm --filter @financiero/web build
```

### Usuarios seed
- `admin` / `admin123` — ADMIN
- `mariana` / `admin123` — OPERATOR
- `alberto` / `admin123` — VIEWER (solo ve placeholder)

### BigInt serialization
Cambió a `value.toString()` en `apps/api/src/{index,build-app}.ts`. El frontend nuevo trata montos como strings y los pasa a `formatMoney()`.

### Smoke tests (apps/api/src/smoke.test.ts — 14 tests, 100% pass)
Se escribieron smoke tests de integración cubriendo el happy path de la demo y las reglas críticas:
- Flujo completo: alquiler cobro al banco, transfer banco→caja, gasto propiedad, transfer banco→CC (anticipo a socio).
- Contrato FINALIZADO rechaza cobro posterior con code `CONTRATO_FINALIZADO_FECHA_POSTERIOR`.
- Sociedad.replaceSocios valida suma bps==10000 (rechaza con 422).
- Reverso invierte saldos; doble-reverso sobre el mismo original se rechaza.
- Caja CLOSED rechaza movimiento nuevo (`CAJA_CLOSED`).
- Caja cerrar arrastra saldos al día siguiente.
- Reports/posición reparte saldo de banco entre socios según bps.
- Contrato.POST pre-llena socios desde la sociedad si no se pasan.
- Alquileres report marca `PENDIENTE` cuando no hubo cobro este mes.
- Banco 1:1 con sociedad (segundo banco → 409 `BANCO_ALREADY_EXISTS_FOR_SOCIEDAD`).
- BigInt serializa como string (no Number) para preservar precisión.

Corrí `pnpm --filter @financiero/api test` — 14/14 verde.

### Validación manual end-to-end (2026-04-24, via curl contra el dev server)
Se ejecutó el flujo descrito en la sección "Verificación manual" del plan, desde DB limpia (solo cuenta seed "Financiera"):
1. Login como mariana OK.
2. Crear cuentas Alberto (ALB), Casab (CAS), Inquilino-X OK.
3. Crear sociedad DA con socios 50/50 OK.
4. Crear banco 042 para DA OK.
5. Crear propiedad Av. Mayo 123 4B bajo DA OK.
6. Crear contrato sobre esa propiedad por 100k ARS → contrato **#1000** (sequence start verificado).
7. ALQUILER_COBRO 100k → Banco DA saldo 10,000,000 ✓.
8. TRANSFERENCIA 50k Banco→Caja → Banco 5,000,000, Caja 5,000,000 ✓.
9. GASTO_PROPIEDAD 10k desde Banco → Banco 4,000,000 ✓.
10. TRANSFERENCIA 5k Banco→CC Alberto → CC Alberto 500,000, Banco 3,500,000 ✓.
11. Cerrar caja → saldoFinalArs 5,000,000 ✓.
12. /reports/posicion → Alberto corresponde 1,750,000 (50% de 3.5M), Casab 1,750,000 ✓.
13. Finalizar contrato #1000 con motivo ✓.
14. ALQUILER_COBRO con fecha futura → HTTP 409 `CONTRATO_FINALIZADO_FECHA_POSTERIOR` ✓.

Todas las pantallas operator renderizan SSR con HTTP 200 (`/login`, `/dashboard`, `/cuentas`, `/sociedades`, `/propiedades`, `/contratos`, `/caja`, `/movimientos`). **No se hizo click-through visual en browser** — hay que hacerlo antes de la demo con Mariana para validar interacciones del form de movimiento.

### Deuda técnica (Fase 4)
- **Tests backend ampliados.** Hay 14 smoke tests de integración. Faltan: concurrencia (5 inserts paralelos al mismo banco saldo), propiedades específicas como soft-delete con dependencias, admin-only endpoints (reactivar contrato, recalcular saldo, reabrir caja).
- **AuditLog** no se escribe. Decidir: hook Fastify global vs. por-service.
- **Edit modals** de datos básicos no conectados en detail pages de cuenta/sociedad/propiedad/contrato (socios sí; el resto no). Endpoints PUT existen.
- **Reactivar contrato** / **recalcular banco** — endpoints admin existen, no hay UI.
- **Conciliación bancaria** fuera de scope; Phase 6 opcional del plan no implementada.
- **Serializable isolation** solo en `movimiento.create`/`reversar`.

---

## Fase 1 — Notas del handoff

### Qué se construyó

**Scaffolding:**
- Monorepo con workspaces: `apps/api/`, `apps/web/` (scaffold vacío), `packages/shared/`
- Fastify 5 con TypeScript en modo ESM
- Prisma 6 con schema modular (14 archivos .prisma)
- Docker Compose con PostgreSQL 16 (dev en puerto 5434, test en puerto 5435)
- Primera migración con todas las tablas + trigger de validación de doble entrada
- Seed con datos realistas: la financiera, 2 sociedades (DA S.A., MR Inversiones), socios con porcentajes, 10 entidades, 15 cuentas, 4 propiedades, 4 contratos de alquiler, 3 transacciones de ejemplo

**Módulos implementados (12):**

| Módulo | Endpoints | Archivo |
|--------|-----------|---------|
| **auth** | POST login, register, refresh, logout | `modules/auth/` |
| **entity** | CRUD (GET list, GET :id, POST, PUT, DELETE soft) | `modules/entity/` |
| **ownership** | CRUD + validación porcentajes + historial temporal | `modules/ownership/` |
| **account** | CRUD + jerarquía ":" + balance cacheado + hierarchy query | `modules/account/` |
| **period** | GET list, GET today (auto-create), GET :id, POST close (snapshot) | `modules/period/` |
| **ledger** | POST create (doble entrada + locking + idempotency), POST reverse, GET list/detail | `modules/ledger/` |
| **property** | CRUD | `modules/property/` |
| **lease** | CRUD + POST prices (historial versionado), DIRECT/THIRD_PARTY | `modules/lease/` |
| **invoice** | POST create (base + IVA + InvoiceRetention), POST collect → genera Transaction | `modules/invoice/` |
| **settlement** | POST calculate (largest remainder), POST approve | `modules/settlement/` |
| **reconciliation** | CRUD sesión, POST items, POST match, POST globalize, POST complete | `modules/reconciliation/` |
| **reporting** | GET entity balances, weighted balances, movements by period, lease status, cash flow | `modules/reporting/` |

**Transversal:**
- AuditLog automático en operaciones del ledger (create + reverse)
- Validaciones con Zod en todos los endpoints
- Formato de errores consistente: `{ error: { code, message, details? } }`
- CORS configurado (`@fastify/cors`)
- Helmet para headers de seguridad (`@fastify/helmet`)
- Rate limiting: 100 req/min general (`@fastify/rate-limit`)
- JWT access tokens (15 min) + refresh tokens opacos (7 días en BD)
- 3 roles: ADMIN, OPERATOR, VIEWER con middleware de autorización
- Health check endpoint: `GET /health`

**Tests (20 tests, todos pasan):**
- Doble entrada: crea transacción balanceada, rechaza desbalanceada
- Reversiones: crea reversa con entries espejo, rechaza doble reversión
- Período cerrado: rechaza transacciones en período cerrado
- Idempotencia: retorna transacción existente sin re-ejecutar
- Locking: serializa 5 transacciones concurrentes correctamente
- Trigger PostgreSQL: rechaza entries desbalanceados a nivel de BD
- Distribución (largest remainder): 7 tests incluyendo edge cases
- Flujo de cobro de alquiler: crear invoice con retenciones → cobrar → verificar transaction + balances

### Decisiones tomadas durante la construcción (Fase 1)

1. **Puertos Docker:** Se usan puertos 5434 (dev) y 5435 (test) en vez de 5432 para evitar conflictos con PostgreSQL local existente.

2. **RefreshToken como modelo:** Se agregó el modelo `RefreshToken` al schema de Prisma (no estaba en el plan original) para implementar la rotación de refresh tokens descrita en la sección 13.5.

3. **Auth middleware doble función:** `authenticate` valida el token, `requireRole(...roles)` valida token + rol. Los endpoints usan `requireRole` como preHandler para rutas protegidas.

4. **Invoice.collect no usa ledger service directamente:** La función `collect` en invoice service crea la transacción directamente con Prisma (incluyendo actualización de balances) en vez de llamar al ledger service, para mantener todo dentro de una sola transacción de BD. Esto duplica algo de lógica pero garantiza atomicidad del flujo completo (crear txn + actualizar invoice status).

5. **BigInt serialization:** Se agregó un hook `preSerialization` en Fastify que convierte BigInt a Number en las respuestas JSON. Esto fue anticipado en la Fase 1 como posible necesidad para la Fase 2.

6. **Prisma schema folder:** Se removió `previewFeatures = ["prismaSchemaFolder"]` ya que está deprecado en Prisma 6.19 — la funcionalidad de schema modular ya está disponible sin preview feature.

## Fase 2 — Notas del handoff

### Qué se construyó

**Setup:**
- Next.js 16.2.3 con App Router en `apps/web/`
- shadcn/ui v4 (basado en `@base-ui/react`) como base de componentes (25 componentes instalados)
- Tailwind CSS 4 con tema shadcn
- Conexión al API en `http://localhost:3001/api`
- Auth: access token en memoria JS + refresh token en cookie (SameSite=Strict, 7 días)
- Auto-refresh de sesión al cargar la app si hay refresh token en cookie
- API client con retry automático en 401 (refresh + retry)

**Pantallas implementadas (11):**

| Pantalla | Ruta | Funcionalidad |
|----------|------|---------------|
| **Login** | `/login` | Email + password, redirect a dashboard |
| **Dashboard operativo** | `/dashboard` | Saldos efectivo ARS/USD, transacciones del día, alquileres pendientes, accesos rápidos |
| **Transacciones** | `/transactions` | Carga keyboard-first (Tab, Ctrl+Enter para guardar), autocomplete fuzzy cuentas, validación balance en tiempo real, medio de pago, filtros, detalle, botón Revertir |
| **Cierre de período** | `/period` | Resumen saldos, navegación entre días (anteriores = read-only), diálogo de confirmación con notas |
| **Entidades** | `/entities` | CRUD + detalle con Ownership: agregar socios, porcentajes, validación suma 100%, historial |
| **Cuentas** | `/accounts` | CRUD, vista lista con filtros, vista jerarquía (árbol), saldos en tiempo real |
| **Propiedades** | `/properties` | CRUD con datos físicos, tipo (departamento/comercial/oficina/etc), entidad propietaria |
| **Contratos** | `/leases` | CRUD de Lease + detalle con historial de precios (LeasePrice). Soporte DIRECT y THIRD_PARTY |
| **Cobro de alquileres** | `/invoices` | Crear Invoice (contrato + base + IVA + retenciones flexibles) → registrar cobro con medio de pago → transacción automática |
| **Liquidaciones** | `/settlements` | Seleccionar sociedad + período + moneda → calcular distribución → ver preview → aprobar |
| **Conciliación bancaria** | `/reconciliation` | Vista split-screen: items del banco (izquierda) vs transacciones del sistema (derecha). Agregar items, match manual, globalización (agrupar N items), color coding (verde=conciliado, amarillo=agrupado), barra de progreso, completar |

**Componentes reutilizables:**
- `Combobox` — Autocomplete fuzzy para entidades, cuentas, propiedades (popover + command con búsqueda)
- `DataTable` — Tabla genérica con tipado, loading skeletons, empty states, click en fila
- `PageHeader` — Header de página con título, descripción y acciones
- `AppSidebar` — Navegación lateral con highlight de ruta activa

**UX transversal:**
- Keyboard-first: Tab entre campos, Enter/Ctrl+Enter para guardar
- Autocomplete fuzzy en todos los selectores de entidad/cuenta/propiedad
- Validación en tiempo real del balance de asientos (Débitos = Créditos)
- Navegación rápida entre módulos via sidebar
- Toasts para feedback (éxito/error) con sonner
- Loading skeletons mientras cargan datos
- Responsive (uso principal desktop)

**Infraestructura frontend:**
- `lib/api.ts` — API client con manejo de tokens, auto-refresh, error handling
- `lib/auth-context.tsx` — React Context para auth (login/logout/user state)
- `lib/hooks.ts` — `useQuery` y `useMutation` hooks para data fetching
- `lib/format.ts` — Formateo de montos (centavos → pesos con separador de miles), fechas

### Cómo correr el proyecto

```bash
# 1. Iniciar PostgreSQL
docker compose up -d

# 2. Instalar dependencias
pnpm install

# 3. Aplicar migraciones
pnpm db:migrate

# 4. Seed con datos de prueba
pnpm db:seed
# Usuarios: admin@financiera.com, mariana@financiera.com, alberto@financiera.com (password: admin123)

# 5. Iniciar todos los dev servers (API + Web + shared watch)
pnpm dev
# API → http://localhost:3001
# Web → http://localhost:3000

# 6. O iniciar por separado
pnpm dev:api   # Solo API
pnpm dev:web   # Solo frontend

# 7. Correr tests del backend
DATABASE_URL="postgresql://financiero:financiero_test@localhost:5435/financiero_test?schema=public" pnpm test

# 8. Build de todo
pnpm build

# 9. Otros comandos útiles
pnpm db:generate   # Regenerar Prisma client
pnpm db:reset      # Reset BD completo
pnpm db:studio     # Prisma Studio (GUI)
```

### Decisiones tomadas durante la construcción (Fase 2)

1. **Next.js 16 + shadcn/ui v4:** La versión actual de shadcn usa `@base-ui/react` en lugar de Radix. Cambios clave: no hay `asChild` prop (usar `render` prop en su lugar), `Select.onValueChange` recibe `string | null`, y `Tabs.onValueChange` recibe `string | null`.

2. **Auth sin httpOnly cookie del servidor:** El backend devuelve el refresh token como string en el body de login. El frontend lo almacena en una cookie SameSite=Strict desde JavaScript. Esto no es httpOnly (el JS puede leerlo), pero es aceptable para el POC. Para producción, considerar un endpoint que setee la cookie httpOnly desde el backend.

3. **Hooks propios vs TanStack Query:** Se usaron hooks `useQuery`/`useMutation` propios en vez de TanStack Query. Para una app de 3-4 usuarios con CRUD simple, la complejidad de una librería de caching no se justifica.

4. **BigInt → Number en API:** Se agregó un hook `preSerialization` en Fastify (modificación en `apps/api/src/index.ts`) que convierte todos los BigInt a Number en las respuestas JSON. Esto simplifica el manejo en el frontend. Para valores > Number.MAX_SAFE_INTEGER (>90 trillones de centavos), habría que usar strings, pero los montos de esta financiera nunca llegarán a eso.

5. **Formateo de montos:** `lib/format.ts` convierte centavos a pesos con `Intl.NumberFormat('es-AR')` y agrega prefijo `$` o `US$` según la moneda.

6. **No se usa middleware/proxy de Next.js:** La protección de rutas se hace client-side en el layout del grupo `(operator)` — si no hay usuario, redirige a `/login`. Esto es aceptable porque el API ya valida auth en todos los endpoints.

### Notas para el próximo Claude

1. **Las pantallas son funcionales contra el API real.** Se verificó login, listado de entidades, cuentas, período del día. Los datos del seed se muestran correctamente.

2. **El build compila sin errores.** `npm run build:web` genera las 15 rutas estáticas sin problemas.

3. **Fase 3 (VIEWER) debería reutilizar componentes.** `DataTable`, `PageHeader`, `Combobox`, `lib/format.ts`, `lib/api.ts` y `lib/hooks.ts` están listos para usar.

4. **El dashboard del VIEWER ya tiene endpoints de reporting.** `/api/reports/owner/:ownerId/weighted-balances`, `/api/reports/leases/status`, `/api/reports/period/:periodId/cash-flow` están implementados en el backend.

5. **Settlement approve requiere rol ADMIN.** Si se quiere que OPERATOR pueda aprobar, hay que cambiar el middleware en `apps/api/src/modules/settlement/routes.ts`.

6. **shadcn v4 con @base-ui/react:** No usar `asChild` en Button/Popover/Dialog. Usar `render` prop. Select y Tabs `onValueChange` devuelven `string | null`.

## Fase 3 — Notas del handoff

### Qué se construyó

**Dashboard VIEWER (solo lectura para Alberto):**

| Pantalla | Ruta | Funcionalidad |
|----------|------|---------------|
| **Dashboard principal** | `/viewer/dashboard` | KPIs: posición consolidada por moneda (ARS/USD), saldos ponderados por ownership de Alberto en cada entidad (DA S.A. 50%, MR Inversiones 40%, La Financiera 100%), resumen de alquileres (al día/pendientes/sin factura). Click en entidad → drill-down |
| **Ingresos y Gastos** | `/viewer/income-expenses` | Navegación entre períodos con flechas. Flujo de fondos por moneda (ingresos/egresos/neto). Resumen por tipo de transacción. Lista detallada de transacciones del período |
| **Estado de Alquileres** | `/viewer/leases` | Tarjetas de resumen (al día/pendientes/sin factura). Detalle por propiedad: nombre, dirección, inquilino, monto base, estado de cobro del mes, tipo de gestión (directa/tercero) |
| **Detalle por Entidad** | `/viewer/entities` + `/viewer/entities/[id]` | Lista de todas las entidades con tipo y CUIT. Drill-down: socios con porcentajes, cuentas agrupadas por moneda con débitos/créditos/saldo. Click en socio → navegar a detalle del socio |

**Modificaciones a código existente:**

| Archivo | Cambio |
|---------|--------|
| `lib/auth-context.tsx` | `login()` ahora retorna `User` para que el login page pueda redirigir según rol |
| `(auth)/login/page.tsx` | Post-login redirige a `/viewer/dashboard` si rol es VIEWER, `/dashboard` si es OPERATOR/ADMIN |
| `(operator)/layout.tsx` | Redirige a `/viewer/dashboard` si un VIEWER intenta acceder a pantallas de operador |

**Nuevos archivos:**

| Archivo | Descripción |
|---------|-------------|
| `components/viewer-sidebar.tsx` | Sidebar de navegación para VIEWER con 4 items (Dashboard, Ingresos y Gastos, Alquileres, Entidades) |
| `(viewer)/layout.tsx` | Layout protegido: valida que el usuario esté autenticado y tenga rol VIEWER |
| `(viewer)/viewer/dashboard/page.tsx` | Dashboard principal |
| `(viewer)/viewer/income-expenses/page.tsx` | Ingresos y gastos por período |
| `(viewer)/viewer/leases/page.tsx` | Estado de alquileres |
| `(viewer)/viewer/entities/page.tsx` | Lista de entidades |
| `(viewer)/viewer/entities/[id]/page.tsx` | Detalle por entidad |

**Endpoints del API utilizados:**
- `GET /api/entities` — Lista de entidades
- `GET /api/entities/:id` — Detalle de entidad
- `GET /api/periods` — Lista de períodos
- `GET /api/ownerships/entity/:entityId` — Socios de una entidad
- `GET /api/reports/owner/:ownerId/weighted-balances` — Saldos ponderados por ownership
- `GET /api/reports/entity/:entityId/balances` — Cuentas con saldos por entidad
- `GET /api/reports/period/:periodId/movements` — Transacciones del período
- `GET /api/reports/period/:periodId/cash-flow` — Flujo de fondos
- `GET /api/reports/leases/status` — Estado de alquileres

**Componentes reutilizados de Fase 2:**
- `DataTable`, `PageHeader`, `Combobox`
- `lib/api.ts`, `lib/auth-context.tsx`, `lib/hooks.ts`, `lib/format.ts`
- shadcn/ui: Card, Badge, Button, Skeleton, Separator, ScrollArea, Table, Tooltip

### Decisiones tomadas durante la construcción (Fase 3)

1. **Mapping User → Entity para weighted balances:** No hay relación directa entre User y Entity en el schema. Se resuelve buscando la entidad de tipo PERSON cuyo nombre coincida con el del usuario logueado. Funciona para el POC. Para producción, considerar agregar un campo `entityId` al modelo User.

2. **Route group `(viewer)` con segmento `viewer/`:** Next.js route groups no crean segmentos de URL, lo que genera conflictos con rutas del operador (`/dashboard`, `/entities`, `/leases`). Se resolvió agregando un directorio `viewer/` dentro del route group `(viewer)`, resultando en URLs como `/viewer/dashboard`.

3. **Guard bidireccional de roles:** El layout del operador ahora redirige VIEWERs a `/viewer/dashboard`, y el layout del viewer redirige no-VIEWERs a `/dashboard`. Esto garantiza que Alberto solo vea las pantallas de viewer y los operadores no puedan acceder al viewer.

4. **Sin gráficos en el POC:** Las KPI cards y tablas cubren la necesidad de visualización. Para post-POC se puede agregar una librería de charts (recharts) para el gráfico de flujo de fondos mencionado en el plan.

### Proyecto completo — Las 3 fases están terminadas

El sistema está funcional con:
- **Backend:** 12 módulos, 20 tests, todos los endpoints de reporting
- **Frontend OPERATOR:** 11 pantallas para Mariana (carga de transacciones, cierre, alquileres, conciliación, etc.)
- **Frontend VIEWER:** 4 pantallas para Alberto (dashboard, ingresos/gastos, alquileres, entidades)
- **Auth:** Login con redirección por rol, guards en layouts, 3 roles (ADMIN, OPERATOR, VIEWER)

Usuarios de prueba: `admin@financiera.com`, `mariana@financiera.com`, `alberto@financiera.com` (password: `admin123`)
