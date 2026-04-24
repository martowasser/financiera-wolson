# Simplificación del viewer para Alberto (usuario mayor)

## Overview

El viewer (`/viewer/*`) está construido con jerga contable, tipografía chica, tablas densas y sin gráficos. El usuario target es Alberto — persona mayor, no técnica. Este plan reemplaza el dashboard completo con 3 bloques visuales ("cuánta plata tengo / me pagan / qué pasó"), introduce gráficos simples con recharts, sube la tipografía a 17–18px baseline, y esconde el detalle contable detrás de "Ver detalle". **Sin cambios de backend** — todos los endpoints ya devuelven lo necesario.

## Interview Summary

Decisiones tomadas con el usuario:

- **Librería de gráficos**: recharts (acepta un ~100KB gzipped; estándar, menos reinventar rueda).
- **Tipografía base viewer**: 17–18px body, 15 meta, 22+ headings. Se aplica por override explícito en cada componente del viewer (Tailwind classes); el operator queda intacto.
- **Dashboard**: **reemplazo total**. No hay toggle "simple/detallado".
- **Detalle contable** (débitos/créditos, movimientos, weighted breakdown): **esconder detrás de un "Ver detalle"** (Accordion/expand). Default = vista simple.
- **Dispositivo target**: **tablet principalmente**. Tap targets ≥44px, sin interacciones hover-only, cards grandes.
- **Íconos de estado**: lucide a 32px+ con color + palabra (`CheckCircle2` / `Clock` / `AlertCircle`). No emojis.
- **Fechas**: formato largo — *"Jueves 23 de abril de 2026"*.
- **"Qué pasó"**: alcance = día (período abierto, o último cerrado si no hay abierto). Sin agregados mensuales ⇒ sin backend changes.
- **Donas**: dos lado a lado (ARS / USD). No convertir monedas.
- **Entity list + detail (viewer)**: solo tipografía + vocabulario (esconder débitos/créditos). Sin rediseño de cards. Riesgo mínimo, Alberto raramente entra.
- **Entrega**: un solo push al final (no commit por fase). Fases existen en el plan solo para ordenar la implementación.

## Current State Analysis

### Páginas del viewer

| Página | Estado actual | Problemas principales |
|---|---|---|
| `/viewer/dashboard` | Welcome + 2 cards de "Posición" + 4 KPIs alquileres + tabla weighted breakdown 5-col | Jerga ("ponderado", "ownership"), sin gráficos, tabla densa |
| `/viewer/income-expenses` | Nav período con flechas + hasta 9 KPI cards (3 monedas × 3) + 2 tablas densas | 9 cards abruman; "débitos/créditos" y "flujo neto"; fechas cortas; botones chicos |
| `/viewer/leases` | 3 KPI cards + lista de cards por propiedad | Badge de estado chico; "gestión directa / rendido por tercero" |
| `/viewer/entities` | Tabla simple + tabs Sociedades/Personas (recién agregados) | Tipografía chica |
| `/viewer/entities/[id]` | Socios + tabla cuentas con Débitos/Créditos/Saldo | 5 columnas con débitos/créditos innecesarios para viewer |

### Backend (sin cambios)

Todos los endpoints existentes sirven:
- `GET /reports/owner/:id/weighted-balances` → devuelve ARS/USD con details por sociedad
- `GET /reports/leases/status` → estado PAID/PENDING/NO_INVOICE
- `GET /reports/period/:id/cash-flow` → inflows/outflows/netFlow
- `GET /reports/period/:id/movements` → summary + transactions
- `GET /periods` → lista de días para navegar
- `GET /entities`, `GET /entities/:id`, `GET /reports/entity/:id/balances`, `GET /ownerships/entity/:id`

### Layout viewer (`apps/web/src/app/(viewer)/layout.tsx`)
- Container `max-w-6xl px-6 py-6 space-y-6`. Va a cambiar a spacing más generoso y permitir páginas más anchas (tablet landscape tiene ~1024px).

## Desired End State

### Dashboard — 3 bloques grandes, full-width responsive

```
┌─ Bienvenido, Alberto ──────────────────────────────────────┐
│ Viernes 24 de abril de 2026                                │
└────────────────────────────────────────────────────────────┘

┌─ 1. Su plata ──────────────────────────────────────────────┐
│                                                            │
│   ┌─── Pesos ($) ───┐        ┌─── Dólares (US$) ───┐      │
│   │                 │        │                     │      │
│   │   [dona con %   │        │   [dona con %       │      │
│   │    por sociedad]│        │    por sociedad]    │      │
│   │                 │        │                     │      │
│   │   $ 12.450.000  │        │   US$ 85.300        │      │
│   │   Total         │        │   Total             │      │
│   │                 │        │                     │      │
│   └─────────────────┘        └─────────────────────┘      │
│                                                            │
│   Ver detalle por cuenta ▾                                 │
└────────────────────────────────────────────────────────────┘

┌─ 2. Sus alquileres ────────────────────────────────────────┐
│                                                            │
│   [CheckCircle 48px]   [Clock 48px]   [AlertCircle 48px]  │
│      Al día                Pendiente      Sin factura     │
│        3                       1              0           │
│                                                            │
└────────────────────────────────────────────────────────────┘

┌─ 3. Lo que pasó hoy ──── Viernes 24 de abril ──────────────┐
│                                                            │
│   Entradas      ████████████████  $ 245.000               │
│   Salidas       ██████            $ 82.000                │
│                                                            │
│   Ver movimientos ▾                                        │
└────────────────────────────────────────────────────────────┘
```

### Ingresos y Gastos — barras grandes + expand

```
┌─ Ingresos y Gastos ────────────────────────────────────────┐
│                                                            │
│  [◀ Anterior]  Jueves 23 de abril de 2026 [Cerrado]  [▶] │
│                                                            │
│  Pesos ($)                                                 │
│    Entradas  ████████████████████   $ 245.000            │
│    Salidas   ██████                  $ 82.000            │
│    Neto      +$ 163.000              ✓                    │
│                                                            │
│  Dólares (US$)                                            │
│    Entradas  ████  US$ 2.100                              │
│    Salidas   █     US$ 500                                │
│    Neto      +US$ 1.600  ✓                                │
│                                                            │
│  Ver movimientos detallados (12) ▾                         │
└────────────────────────────────────────────────────────────┘
```

### Alquileres — cards grandes con ícono protagonista

```
┌─ Estado de Alquileres ─────────────────────────────────────┐
│                                                            │
│  [CheckCircle]  [Clock]  [AlertCircle]                    │
│   Al día 3     Pendiente 1    Sin factura 0               │
│                                                            │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  [CheckCircle 32px]  Depto Arenales 1200, 3ºB              │
│   AL DÍA             Inquilino: Pablo Pérez                │
│                      $ 850.000 por mes                     │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  [Clock 32px]        Local Av. Santa Fe 4500               │
│   PENDIENTE          Inquilino: El Dorado SRL              │
│                      US$ 2.500 por mes                     │
└────────────────────────────────────────────────────────────┘
```

## What We're NOT Doing

- **No backend changes.** Ni endpoints nuevos ni campos nuevos.
- **No tocamos el operator (`/dashboard` etc.).** Todos los cambios de tipografía, color, layout quedan confinados a `/viewer/*`.
- **No toggle simple/detallado.** Reemplazo total.
- **No cambiamos el login, auth, ni la redirección viewer→/viewer/dashboard.**
- **No agregamos agregados mensuales** (ni backend ni client-side loop). El dashboard "Lo que pasó hoy" = último período abierto o último cerrado si no hay abierto.
- **No agregamos modo dark/light toggles, "modo grande" toggle, ni print stylesheet.** Alberto va a una sola experiencia.
- **No reescribimos `/viewer/entities` ni `/viewer/entities/[id]` visualmente** — solo tipografía y vocabulario. Las tablas quedan.
- **No agregamos conversión de monedas ni tipos de cambio.**

## Implementation Approach

Una rama de trabajo local, 5 fases secuenciales, un único push al final. El orden apunta a tener cada pantalla funcional al cierre de su fase (útil para revisiones internas) pero no hay commits intermedios a `main`.

---

## Phase 1: Fundamentos — recharts, tipografía, helpers compartidos

### Overview
Instalar la librería de gráficos y crear las piezas compartidas que van a usar las demás fases. No hay cambios visuales hasta Phase 2.

### Changes

**Install**
- `pnpm --filter web add recharts`

**File**: `apps/web/src/lib/format.ts`
- Agregar `formatDateLong(dateStr): string` → *"Jueves 23 de abril de 2026"*. Usar `Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })` y capitalizar la primera letra (español devuelve en minúsculas).

**File**: `apps/web/src/components/viewer/status-badge.tsx` (nuevo)
- Componente `LeaseStatusBadge({ status, size = 'lg' })` que acepta `'PAID' | 'PENDING' | 'NO_INVOICE'` y renderiza:
  - `PAID` → `CheckCircle2` + "Al día" + `text-green-600`
  - `PENDING` → `Clock` + "Pendiente" + `text-yellow-600`
  - `NO_INVOICE` → `AlertCircle` + "Sin factura" + `text-red-600`
- Tamaños: `lg` = ícono 32px + texto 18px; `xl` = ícono 48px + texto 24px (para la fila-semáforo del dashboard).

**File**: `apps/web/src/components/viewer/viewer-section.tsx` (nuevo)
- Wrapper `<ViewerSection title subtitle actions children />` con padding grande, heading 24px, subtítulo 15px. Reemplaza el uso de `Card + CardHeader + CardTitle` en las páginas del viewer para uniformar el look.

**File**: `apps/web/src/components/viewer/viewer-disclosure.tsx` (nuevo)
- Componente colapsable para las secciones "Ver detalle" / "Ver movimientos". Usa `<details>` nativo (gratis, accesible) estilizado: summary `text-base text-muted-foreground` + chevron. Sin estado React.

**File**: `apps/web/src/app/(viewer)/layout.tsx`
- Cambiar `container max-w-6xl px-6 py-6 space-y-6` → `max-w-7xl px-8 py-8 space-y-8`. Más aire para tablet.
- Setear clase base del main: `text-[17px] leading-relaxed`. Los descendientes que usen `text-sm/xs` se irán corrigiendo en fases 2-5.

### Success Criteria

#### Automated
- [ ] `pnpm --filter web exec tsc --noEmit` pasa.
- [ ] `pnpm --filter web exec eslint src/lib/format.ts src/components/viewer` pasa.
- [ ] `pnpm --filter web build` produce build exitoso (recharts se carga OK).

#### Manual
- [ ] `formatDateLong('2026-04-23')` devuelve `"Jueves 23 de abril de 2026"` (primera letra mayúscula).
- [ ] `<LeaseStatusBadge status="PAID" size="xl" />` renderiza ícono grande verde + texto grande.
- [ ] `<ViewerDisclosure summary="Ver detalle">…</ViewerDisclosure>` expande/colapsa con click en tablet.

---

## Phase 2: Dashboard — reemplazo completo con 3 bloques

### Overview
Reescribir `apps/web/src/app/(viewer)/dashboard/page.tsx` end-to-end.

### Changes

**File**: `apps/web/src/app/(viewer)/dashboard/page.tsx` — reemplazo total

Estructura:

1. **Header**: saludo `Bienvenido, {nombre}` (28px) + fecha larga del día actual.

2. **Bloque 1 — Su plata** (`ViewerSection title="Su plata"`):
   - Grid 2 columnas (en tablet portrait, apila; en landscape, lado a lado).
   - Por cada moneda presente en `weightedBalances`:
     - `<PieChart>` de recharts con `<Pie data={wb.details} dataKey="weightedBalance" nameKey="entityName" innerRadius={60} outerRadius={100} />`.
     - Colores: una paleta de 6 tonos diferenciables (mint, coral, periwinkle, amber, rose, teal) — no verde/rojo para no chocar con semántica de estado.
     - Label central superpuesta: total formateado + "Pesos" / "Dólares".
     - Leyenda debajo: lista `EntidadName · XX%` con `text-base`.
   - `<ViewerDisclosure summary="Ver detalle por cuenta">` contiene la tabla existente (5 columnas), con tipografía 17px.
   - Si no hay datos: mensaje simple "Todavía no hay saldos registrados."

3. **Bloque 2 — Sus alquileres** (`ViewerSection title="Sus alquileres"`):
   - 3 mini-cards lado a lado: `LeaseStatusBadge size="xl"` + número grande debajo.
   - El card entero es clickable → `router.push('/viewer/leases')`.
   - `role="button"` + `aria-label` para cada uno.

4. **Bloque 3 — Lo que pasó hoy** (`ViewerSection title="Lo que pasó hoy"` con subtítulo = fecha larga del período mostrado):
   - Fetch `periods?status=OPEN` (o último cerrado si no hay abierto) → `/reports/period/:id/cash-flow`.
   - Por moneda, barras horizontales: una "Entradas" verde, una "Salidas" roja. Componente `<BarChart layout="vertical">` de recharts, o implementación HTML simple con `<div>` + width% (más simple y sin peso).
     - **Decisión**: implementación HTML simple. Las barras son 1-2 valores por moneda, no justifica recharts. Ancho % = `value / max(entradas, salidas) * 100`.
   - Número a la derecha de cada barra, formateado con `formatMoney`.
   - "Neto: +$163.000 ✓" o "Neto: −$12.500 ⚠" debajo.
   - `<ViewerDisclosure summary="Ver movimientos detallados ({count})">`: lista condensada de movimientos (descripción + monto, sin "código" ni "medio").

### Hook helper
- `useActivePeriod()` en `apps/web/src/lib/hooks.ts` o inline: devuelve el último período `OPEN`, o el de fecha máxima si no hay abierto. No necesita endpoint nuevo — se calcula desde `GET /periods`.

### Success Criteria

#### Automated
- [ ] typecheck + lint + build limpios.

#### Manual
- [ ] Al loguearse como viewer, el dashboard muestra **solo** 3 bloques verticales, todo legible sin zoom en tablet 1024×768.
- [ ] Las donas renderizan con el ARS y USD del usuario demo.
- [ ] Si el usuario no tiene balances, el bloque 1 muestra mensaje llano.
- [ ] "Ver detalle por cuenta" expande la tabla.
- [ ] Los 3 cards de alquileres son tappables y navegan a `/viewer/leases`.
- [ ] Bloque 3 muestra el período correcto y las barras proporcionales.
- [ ] Ningún texto usa "ponderado", "ownership", "posición".

---

## Phase 3: Ingresos y Gastos — barras + expand + nav grande

### Overview
Simplificar `apps/web/src/app/(viewer)/income-expenses/page.tsx`.

### Changes

**File**: `apps/web/src/app/(viewer)/income-expenses/page.tsx`

1. **Nav de período**:
   - Fecha central en 24px bold con `formatDateLong`.
   - Botones `[◀ Anterior]` y `[▶ Siguiente]` a 18px, `size="lg"`, `min-h-12` (48px tap target).
   - Badge de estado ("Abierto"/"Cerrado") más grande, al lado de la fecha.

2. **Resumen por moneda** (reemplaza las 9 KPI cards):
   - Para cada moneda en `cash-flow`, una `ViewerSection` con:
     - "Entradas" + barra horizontal verde + monto grande (24px)
     - "Salidas" + barra horizontal roja + monto grande
     - "Neto" + valor grande con `CheckCircle2` verde (si positivo) o `AlertCircle` (si negativo)
   - Si no hay movimientos en el período: mensaje "Este día no tuvo movimientos."

3. **Detalles**:
   - `<ViewerDisclosure summary="Ver movimientos ({count})">` envuelve la tabla de transactions actual, con tipografía 17px y columnas reducidas: Descripción / Tipo / Monto. (Quitamos "Código" y "Medio" del default; si se quiere los dejamos dentro del expand anidado — por simplicidad, los quitamos.)
   - `<ViewerDisclosure summary="Ver resumen por tipo">` envuelve la tabla "Resumen por tipo".

4. Quitar uso de `text-sm`/`text-xs` en favor de `text-base` / `text-lg`.

### Success Criteria

#### Automated
- [ ] typecheck + lint + build limpios.

#### Manual
- [ ] Los botones Anterior/Siguiente son claramente tappables en tablet.
- [ ] Las barras de entradas/salidas son proporcionales al valor máximo del período.
- [ ] La palabra "débito" o "crédito" no aparece en ningún lado de la vista default.
- [ ] Los detalles de movimientos se ven al expandir el disclosure.
- [ ] Los períodos se pueden navegar de ida y vuelta.

---

## Phase 4: Alquileres — íconos protagonistas + cards grandes

### Overview
Reescribir `apps/web/src/app/(viewer)/leases/page.tsx` manteniendo lógica pero con visual dominado por ícono de estado.

### Changes

**File**: `apps/web/src/app/(viewer)/leases/page.tsx`

1. **Semáforo arriba** (reemplaza las 3 KPI cards actuales):
   - Fila horizontal con 3 `LeaseStatusBadge size="xl"` + número grande al lado (o debajo en portrait).

2. **Cards por propiedad**:
   - Layout horizontal: `LeaseStatusBadge size="lg"` a la izquierda (ocupa ~120px) / info a la derecha.
   - Info: nombre de la propiedad en 20px bold + dirección en 17px muted + inquilino en 17px + monto en 22px mono.
   - Quitar del default: "Gestión directa" / "Rendido por tercero", "Factura: XXX". Opcionalmente dentro de un `<ViewerDisclosure summary="Más detalles">`.
   - Padding generoso: `py-6 px-6` mínimo.

3. **Empty state**: "Todavía no hay contratos de alquiler" (17px regular, centrado).

### Success Criteria

#### Automated
- [ ] typecheck + lint + build limpios.

#### Manual
- [ ] En tablet, el semáforo arriba ocupa toda la fila y es leíble de un vistazo.
- [ ] Cada card de propiedad tiene al ícono de estado como elemento visual dominante.
- [ ] No aparece "gestión directa" ni "rendido por tercero" en la vista default.

---

## Phase 5: Entidades — tipografía + quitar débitos/créditos

### Overview
Cambios mínimos en las dos páginas de entidades del viewer. **No hay rediseño visual** — solo vocabulario y tipografía.

### Changes

**File**: `apps/web/src/app/(viewer)/viewer/entities/page.tsx`
- Subir tipografía: headers `text-lg`, rows `text-base`.
- Cambiar descripciones de tabs a las mismas que el operator (`Empresas y sociedades` / `Personas físicas, financieras y terceros`).
- Empty states: usar "sociedad" / "persona" según tab, sin "entidad".

**File**: `apps/web/src/app/(viewer)/viewer/entities/[id]/page.tsx`
- En la tabla de cuentas por moneda: **quitar** columnas "Débitos" y "Créditos". Dejar: Cuenta / Tipo / Saldo.
- Dentro de un `<ViewerDisclosure summary="Ver débitos y créditos">` opcional: la tabla completa. Si se agrega, usar tipografía 17px.
- Cambiar "Esta entidad no tiene cuentas" → "Esta sociedad no tiene cuentas registradas".
- Aumentar tipografía general como en el resto.
- Botón "Volver" a `size="lg"` para tablet.

### Success Criteria

#### Automated
- [ ] typecheck + lint + build limpios.

#### Manual
- [ ] Listado de entidades se lee cómodo en tablet.
- [ ] Detalle de sociedad muestra tabla de 3 columnas (Cuenta / Tipo / Saldo) por default.
- [ ] Si se agregó el disclosure "Ver débitos y créditos", expande con click.

---

## Edge Cases Addressed

| Caso | Comportamiento |
|---|---|
| Usuario viewer no matchea ninguna `Entity` por nombre | El bloque 1 del dashboard muestra mensaje "Todavía no hay saldos registrados" — comportamiento actual se preserva. |
| No hay períodos en la DB | Dashboard bloque 3 muestra "Todavía no hubo movimientos registrados". Ingresos/Gastos muestra "No hay períodos" con botones deshabilitados. |
| Hay período OPEN y varios CLOSED | Dashboard usa el OPEN. |
| No hay OPEN, hay CLOSED | Dashboard usa el CLOSED de fecha máxima. Título: "Lo que pasó el {fecha}". |
| Un sólo sociedad en weighted balances | La dona se renderiza como círculo lleno del color de esa sociedad. recharts lo maneja. |
| ARS presente, USD ausente (o viceversa) | Grid del bloque 1 muestra solo la dona de la moneda presente, centrada (no deja hueco). |
| Barras con valor 0 de un lado | La barra se ve vacía pero el label sigue visible; "Neto = entrada - salida" negativo muestra ⚠. |
| Tablet portrait (768px ancho) | `max-w-7xl` + grid que colapsa a 1 col en `<md`. Las donas ARS/USD se apilan. Los 3 mini-cards del bloque 2 también. |
| Alberto expande "Ver detalle" | El detalle se mantiene abierto durante la sesión; al refrescar, colapsa. Comportamiento `<details>` nativo. |
| Usuario se loguea y ve el dashboard con datos vacíos | Cada bloque tiene su propio empty state en copy llano — nunca "No data available". |

## Testing Strategy

### Unit
- Nuevos helpers (`formatDateLong`) y componentes compartidos (`LeaseStatusBadge`, `ViewerDisclosure`) no son complejos; no se agregan tests unitarios por ahora. Si el helper crece, agregar en `apps/web/src/lib/format.test.ts`.

### Integration / Build
- Cada fase termina con `pnpm --filter web build`.

### Manual (tablet 1024×768 recomendado)
Recorrido completo como usuario viewer:
1. Login viewer → llega al dashboard → ver los 3 bloques sin scroll horizontal.
2. Expandir "Ver detalle por cuenta" → ver tabla.
3. Click en mini-card de alquileres → llegar a `/viewer/leases`.
4. Verificar que los cards de alquileres tienen ícono grande.
5. Expandir "Más detalles" en un card.
6. Ir a Ingresos y Gastos. Navegar períodos con los botones grandes.
7. Expandir "Ver movimientos" → ver la tabla simplificada.
8. Ir a Sociedades, abrir una, verificar que no aparecen débitos/créditos.
9. Usar zoom del navegador 125% y 150% — nada debe romperse.
10. Ninguna pantalla debe tener la palabra "ponderado", "ownership", "posición financiera", "débito" (salvo dentro de expandibles).

### Accesibilidad básica (manual)
- Tab a través de los elementos interactivos.
- Tap targets ≥44px verificable con DevTools inspector.
- Contraste AA para texto sobre fondos (usar el linter visual del navegador).

## References

- Plan previo de tabs: `thoughts/shared/plans/2026-04-23-sociedades-personas-tabs.md`
- Memory: [Alberto (viewer user) — older, non-technical](../../../../../.claude/projects/-Users-martinwasserman-Documents-martin2-financiera-poc/memory/alberto_viewer_profile.md)
- Endpoint shapes: `apps/api/src/modules/reporting/routes.ts`
- Layout viewer: `apps/web/src/app/(viewer)/layout.tsx:40-44`
- Componente Tabs existente (base-ui): `apps/web/src/components/ui/tabs.tsx`
- recharts docs: https://recharts.org/
