# Handoff — Sistema Financiero

## Estado actual
- [x] Fase 1 — Backend completo (completada 2026-04-09)
- [ ] Fase 2 — Frontend OPERATOR
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

### Cómo correr el proyecto

```bash
# 1. Iniciar PostgreSQL
docker compose up -d

# 2. Instalar dependencias
npm install

# 3. Aplicar migraciones
npm run db:migrate -w apps/api
# (o: cd apps/api && npx prisma migrate dev)

# 4. Seed con datos de prueba
npm run db:seed -w apps/api
# Usuarios: admin@financiera.com, mariana@financiera.com, alberto@financiera.com (password: admin123)

# 5. Iniciar servidor de desarrollo
npm run dev:api
# → http://localhost:3001

# 6. Correr tests
DATABASE_URL="postgresql://financiero:financiero_test@localhost:5435/financiero_test?schema=public" npm run test -w apps/api

# 7. Build
npm run build:api
```

### Decisiones tomadas durante la construcción

1. **Puertos Docker:** Se usan puertos 5434 (dev) y 5435 (test) en vez de 5432 para evitar conflictos con PostgreSQL local existente.

2. **RefreshToken como modelo:** Se agregó el modelo `RefreshToken` al schema de Prisma (no estaba en el plan original) para implementar la rotación de refresh tokens descrita en la sección 13.5.

3. **Auth middleware doble función:** `authenticate` valida el token, `requireRole(...roles)` valida token + rol. Los endpoints usan `requireRole` como preHandler para rutas protegidas.

4. **Invoice.collect no usa ledger service directamente:** La función `collect` en invoice service crea la transacción directamente con Prisma (incluyendo actualización de balances) en vez de llamar al ledger service, para mantener todo dentro de una sola transacción de BD. Esto duplica algo de lógica pero garantiza atomicidad del flujo completo (crear txn + actualizar invoice status).

5. **BigInt serialization:** Fastify serializa BigInt como número en JSON por defecto. Si hay issues con valores grandes en el frontend, agregar un serializer custom en Fase 2.

6. **Prisma schema folder:** Se removió `previewFeatures = ["prismaSchemaFolder"]` ya que está deprecado en Prisma 6.19 — la funcionalidad de schema modular ya está disponible sin preview feature.

### Notas para el próximo Claude

1. **La migración tiene el trigger SQL:** El archivo `prisma/schema/migrations/20260410003312_init/migration.sql` incluye al final el trigger `validate_double_entry`. Si se agrega una nueva migración, NO hay que moverlo — queda en la migración inicial.

2. **Tests requieren variable de entorno:** Los tests usan `DATABASE_URL` apuntando al contenedor test (puerto 5435). El vitest.config.ts tiene un setup file pero los tests importan Prisma directamente con la URL hardcoded como fallback.

3. **Endpoints de reporting devuelven BigInt como string:** Para evitar pérdida de precisión en JSON, los montos en reporting se serializan como strings. El frontend deberá convertirlos.

4. **Conciliación es manual:** El modelo soporta `importedFrom` y `externalRef` para importación futura, pero en esta fase todo es manual.

5. **Settlement distributions es Json:** Como dice el plan, `OwnerSettlement.distributions` es un campo Json con array de `{ ownerId, ownerName, percentage, amount }`. El amount se guarda como string para preservar precisión.
