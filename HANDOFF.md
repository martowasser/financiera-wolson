# Handoff — Sistema Financiero

## Estado actual
- [x] Fase 1 — Backend completo (completada 2026-04-09)
- [x] Fase 2 — Frontend OPERATOR (completada 2026-04-10)
- [ ] Fase 3 — Frontend VIEWER

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
npm install

# 3. Aplicar migraciones
npm run db:migrate -w apps/api

# 4. Seed con datos de prueba
npm run db:seed -w apps/api
# Usuarios: admin@financiera.com, mariana@financiera.com, alberto@financiera.com (password: admin123)

# 5. Iniciar servidor API
npm run dev:api
# → http://localhost:3001

# 6. Iniciar frontend (en otra terminal)
npm run dev:web
# → http://localhost:3000

# 7. Correr tests del backend
DATABASE_URL="postgresql://financiero:financiero_test@localhost:5435/financiero_test?schema=public" npm run test -w apps/api

# 8. Build del frontend
npm run build:web
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
