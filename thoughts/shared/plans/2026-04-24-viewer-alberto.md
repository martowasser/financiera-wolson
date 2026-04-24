# Plan: Rediseño del viewer de Alberto

**Fecha:** 2026-04-24
**Relacionado:** `2026-04-23-rebuild-modelo-mariana.md` (dependencia: este plan asume el schema y backend nuevos de ese plan ya implementados)
**Scope:** Reemplazar las 4 pantallas actuales del viewer por 2 pantallas optimizadas para Alberto.

---

## Contexto

Alberto es el usuario VIEWER del sistema. Es una persona mayor, no técnica. Hoy Mariana le arma manualmente un Excel con la posición de todos sus alquileres (cuánto cobra cada uno, quién está al día, cuánto le corresponde a él según su %). La idea del viewer es reemplazar ese Excel con una vista automática, en vivo, simple y grande.

**Memoria relevante:** `alberto_viewer_profile.md` — letra ≥16px, sin jerga contable, icono+texto (no solo color), preferir tablas simples y números grandes sobre gráficos densos.

**Del transcript de Mariana (2026-04-23):** Alberto pide "un pantallazo de todas sus posiciones": alquileres con dirección, monto, quién paga, participación, estado. También quiere saber cuánto tiene total.

---

## Scope

### Lo que entra

- **Pantalla 1 — "Mis alquileres":** lista de contratos con inquilino, dirección, monto, estado del cobro del mes, y "lo que le corresponde a usted". Pestañas: Activos / Finalizados.
- **Pantalla 2 — "Mi posición":** números grandes arriba (total en pesos / en dólares), lista por sociedad con "de $X a usted le corresponde $Y", card de efectivo en caja.
- Sidebar reducido a 2 items.
- Tipografía base ≥16px, títulos 18-20px, números principales 36-40px.
- Sin jerga: no "ponderado", "débito", "crédito", "flujo neto", "ownership".
- Indicadores de estado con icono + texto (no solo color).

### Lo que NO entra

- Saldo de la cuenta corriente de Alberto (anticipos/préstamos entre socios). Se agrega después si Alberto lo pide.
- Gráficos (barras, dona, series). Solo números y cards.
- Exportación a Excel / PDF. Si Alberto pide, se suma.
- Vista de ingresos/gastos del mes detallada (la vista actual "income-expenses" se elimina).
- Filtros complejos. Orden fijo en "Mis alquileres": primero pendientes y sin factura, después al día.

---

## Dependencias

- Schema y backend del plan `2026-04-23-rebuild-modelo-mariana.md` ya implementados.
- Endpoints usados:
  - `GET /api/reports/posicion` — estructura con sociedades, banco, socios y corresponde.
  - `GET /api/reports/alquileres` — lista de contratos con estado del mes y corresponde.

---

## Estado inicial vs deseado

### Estado inicial

- `apps/web/src/app/(viewer)/layout.tsx` — guard de rol VIEWER (mantener).
- `apps/web/src/app/(viewer)/viewer/dashboard/page.tsx` — a eliminar.
- `apps/web/src/app/(viewer)/viewer/income-expenses/page.tsx` — a eliminar.
- `apps/web/src/app/(viewer)/viewer/leases/page.tsx` — a eliminar.
- `apps/web/src/app/(viewer)/viewer/entities/page.tsx` + `[id]/page.tsx` — a eliminar.
- `apps/web/src/components/viewer/viewer-sidebar.tsx` — reemplazar.

Después del plan principal de Mariana, todas esas pantallas llaman endpoints que ya no existen. Se pueden dejar "rotas" temporalmente (con un placeholder en el layout) hasta que este plan se ejecute.

### Estado deseado

- `apps/web/src/app/(viewer)/viewer/alquileres/page.tsx` — Mis alquileres.
- `apps/web/src/app/(viewer)/viewer/posicion/page.tsx` — Mi posición.
- `apps/web/src/components/viewer/viewer-nav.tsx` — sidebar con 2 items.
- Login como `alberto@financiera.com` redirige a `/viewer/alquileres`.

---

## Implementation

### Phase 1: Shell viewer + estilos

**Files:**
- `apps/web/src/app/(viewer)/layout.tsx` — mantener guard, ajustar layout con tipografía más grande.
- `apps/web/src/components/viewer/viewer-nav.tsx` — NUEVO. 2 items: Mis alquileres, Mi posición. Texto 18px+.
- `apps/web/src/app/globals.css` o equivalente — clase `viewer-theme` con escala tipográfica aumentada.

**Estilos:**
- Base `font-size: 18px` dentro de la zona `viewer`.
- Headers: `h1` 32px, `h2` 24px, `h3` 20px.
- Números principales: 40px bold.
- Contraste alto (no `text-muted` para información clave).
- Botones más grandes (padding 12px vertical mínimo).

### Phase 2: Pantalla "Mis alquileres" (`/viewer/alquileres`)

**File:** `apps/web/src/app/(viewer)/viewer/alquileres/page.tsx`

**Datos:** `GET /api/reports/alquileres`.

**Layout:**
- Header: "Sus alquileres".
- Pestañas: `Activos (N)` | `Finalizados (M)` — shadcn Tabs grandes.
- Dentro de la pestaña, una tarjeta por contrato. Orden: pendientes primero, después sin factura, después al día.
- **Card:**
  ```
  ┌──────────────────────────────────────────────────────┐
  │ 📍 Av. Mayo 123 4°B            [badge estado grande] │
  │ Inquilino: Juan Pérez                                │
  │ Cobra: $120.000 por mes                              │
  │                                                       │
  │ Participaciones:                                     │
  │  • Usted: 50%                                        │
  │  • Casab: 50%                                        │
  │                                                       │
  │ Lo que le corresponde a usted: $60.000               │
  │                                                       │
  │ [Último cobro: 05/04/26, comprobante #1234] (si hay) │
  └──────────────────────────────────────────────────────┘
  ```

**Badges de estado (icono + texto + color):**
- ✓ "Cobrado este mes" — verde.
- ⚠ "Pendiente de cobro" — amarillo.
- 📝 "Sin factura" — gris.

**Comportamiento:**
- Sin click-through / drill-down (POC).
- Loading: skeleton de cards.
- Empty state: "Todavía no hay alquileres cargados" + icono.

### Phase 3: Pantalla "Mi posición" (`/viewer/posicion`)

**File:** `apps/web/src/app/(viewer)/viewer/posicion/page.tsx`

**Datos:** `GET /api/reports/posicion`.

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│ Su posición                                               │
│                                                           │
│ ┌─────────────────┐  ┌─────────────────┐                 │
│ │ En pesos        │  │ En dólares      │                 │
│ │                 │  │                 │                 │
│ │ $1.250.000      │  │ US$ 12.500      │                 │
│ │                 │  │                 │                 │
│ └─────────────────┘  └─────────────────┘                 │
│                                                           │
│ Por sociedad:                                             │
│  ▸ DA S.A.                                                │
│     En el banco hay: $420.000 (pesos) y US$ 5.000        │
│     A usted le corresponde: $210.000 y US$ 2.500         │
│                                                           │
│  ▸ Casa B                                                 │
│     En el banco hay: $150.000                             │
│     A usted le corresponde: $75.000                       │
│                                                           │
│ Efectivo en caja hoy:  $85.000  /  US$ 1.200             │
└──────────────────────────────────────────────────────────┘
```

**Cálculo:** Los totales arriba son la suma de `correspondeArs` / `correspondeUsd` de Alberto en todas las sociedades. No se incluye la caja (la caja no tiene owner directo en el modelo). La sección "efectivo en caja" es informativa.

**Sin tablas densas. Sin columnas de débito/crédito. Sin porcentajes en forma de "ponderación".**

### Phase 4: Login + redirects

- Al loguearse con rol VIEWER, redirigir a `/viewer/alquileres` (reemplaza `/viewer/dashboard`).
- `apps/web/src/app/(auth)/login/page.tsx`: ajustar destino.
- `apps/web/src/app/(operator)/layout.tsx`: el redirect de VIEWER afuera del operador apunta a `/viewer/alquileres`.

### Phase 5: Limpieza

- `rm -rf` las 4 pantallas viejas y `viewer-sidebar.tsx` (ya no se usan).
- Ajustar el placeholder temporal del layout del viewer (si se había puesto tras el plan principal).

---

## Success Criteria

### Automated
- [ ] `pnpm -w build` verde.
- [ ] `pnpm -w typecheck` verde.

### Manual
- [ ] Login como `alberto@financiera.com` llega a `/viewer/alquileres`.
- [ ] Sidebar tiene exactamente 2 items.
- [ ] Inspeccionar DevTools: baseline `font-size >= 18px` en la zona viewer. Números principales ≥ 36px.
- [ ] Buscar en DOM: ninguna mención a "ponderado", "débito", "crédito", "flujo neto", "ownership".
- [ ] Todos los badges de estado muestran icono + texto (no solo color). Probar con simulador de daltonismo.
- [ ] "Lo que le corresponde a usted" aparece en ambas pantallas.
- [ ] Funciona en tablet (simulada en Chrome 768px) sin scroll horizontal.
- [ ] Estado PENDIENTE aparece primero en la lista.

---

## Edge cases

| Caso | Tratamiento |
|------|-------------|
| Alberto con 0 contratos | Empty state con mensaje + icono |
| Sociedad con banco pero sin movimientos | Muestra saldo 0, corresponde 0 |
| Alberto con saldo USD pero no ARS | Muestra US$ X y el ARS en $0 |
| Número muy grande (>1M) | Formato con puntos separadores + símbolo $ |
| Período de transición (mes que cambia) | "Estado del mes" usa mes calendario actual |

---

## Out of scope (potencial futuro)

- Saldo de cuenta corriente de Alberto (deudas/anticipos). Lo sumamos si él lo pide.
- Histórico de cobros en la vista de alquileres.
- Exportación a PDF (ej. "posición trimestral").
- Notificaciones / alertas de pendientes.

---

## References

- `/transcripcion-entrevista-2-mariana.md` — transcripción de la reunión.
- `alberto_viewer_profile.md` — perfil del usuario.
- `2026-04-23-rebuild-modelo-mariana.md` — plan del que este depende.
