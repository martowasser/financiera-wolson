# Filtros y export CSV en tablas de movimientos

## Overview
Agregar una barra de filtros consistente y un botón de export CSV a todas las tablas de movimientos que viven en páginas de detalle de entidades (cuentas, sociedades, propiedades, alquileres, caja, plus la página índice `/movimientos`). Reutilizar una única implementación.

## Interview summary

- **Filtros**: rango de fechas (from/to), tipo de movimiento, texto libre (notas + comprobante), moneda (ARS / USD).
- **Formato export**: CSV solo (cero dependencias nuevas, Mariana abre en Excel con doble click).
- **Scope filtros**: misma barra en todas las páginas (componente reutilizable). Cuando estás en `/cuentas/[id]`, el filtro de cuenta está implícito y no se muestra.
- **Export scope**: descarga TODO lo que matchea los filtros (fetch separado con `limit=5000`), no solo lo visible en la tabla.
- **URL state**: filtros persistidos en URL como query params (deep-linkeable, sobrevive refresh).
- **REPARTO_SOCIO en cuenta detail**: siempre incluidos (es como se mueve la CC del socio); también van al export.

## Current state analysis

Hoy hay tablas de movimientos en estos lugares:

| Página | Endpoint actual | Filtros UI hoy |
|---|---|---|
| `/movimientos` | `/movimientos` (main) | sí (q, tipo, from, to) |
| `/cuentas/[id]` | `/cuentas/:id/movimientos` (custom) | ninguno |
| `/sociedades/[id]` | `/movimientos?sociedadId=X` | ninguno |
| `/propiedades/[id]` | `/movimientos?propiedadId=X` | ninguno |
| `/alquileres/[id]` | `/movimientos?alquilerId=X` | ninguno |
| `/caja/[fecha]` | `/movimientos?fecha=X` | ninguno |
| `/caja` (hoy) | `/movimientos?fecha=today` | ninguno (snapshot) |
| `/dashboard` | `/movimientos?fecha=today` | ninguno (snapshot) |

`/movimientos` ya tiene una `FiltersBar` local con q/tipo/from/to pero le falta moneda. El resto de páginas tienen tabla pero ningún filtro.

Backend `listMovimientos` ya soporta: `fecha, from, to, sociedadId, propiedadId, alquilerId, bancoId, cuentaId, tipo, q, limit`. **Falta `moneda`**.

Endpoint custom `/cuentas/:id/movimientos` (`getCuentaMovimientos`) hace OR sobre origenCuenta/destinoCuenta/contraparte. La query main `/movimientos?cuentaId=X` hace lo mismo. Podemos consolidar y eliminar el endpoint custom (o dejarlo deprecated).

## Desired end state

- Un componente React `<MovimientosPanel>` reutilizable que renderiza:
  1. Barra de filtros (from, to, tipo, q, moneda) + botón "Limpiar"
  2. Tabla de movimientos con paginación implícita (limit configurable, default 200)
  3. Botón "Descargar CSV" arriba a la derecha
- Filtros leen/escriben de la URL (`useSearchParams` + `router.replace`)
- Cuando se monta en una página de detalle (ej. `/cuentas/[id]`), recibe un `scope` prop con los filtros forzados (`cuentaId`, `sociedadId`, etc.) que no se muestran en la UI pero se pasan al endpoint.
- Export CSV hace fetch con `limit=5000` aplicando filtros + scope, arma un blob con BOM UTF-8 y lo dispara.
- Las 6 páginas con tablas de movimientos usan el mismo componente.

## What we're NOT doing

- **Paginación real**: hoy no hay paginación; sigue siendo limit fijo + "ver más" implícito subiendo limit. Si Mariana necesita >5000 movs en un export, lo vemos en otra iteración.
- **Export XLSX**: solo CSV. Mariana abre en Excel.
- **Filtros multi-select de tipo**: dropdown single-select como hoy. Si pide multi después, ampliamos.
- **Filtros por banco / sociedad / etc. dentro de las páginas de detalle**: esas dimensiones ya están scope-eadas por la página. No tiene sentido un filtro de "sociedad" dentro de `/sociedades/[id]`.
- **Deprecar `/cuentas/:id/movimientos` (endpoint API)**: lo dejamos vivo para no romper nada externo. El frontend ya no lo va a usar.
- **Filtros en `/dashboard`**: es un snapshot de hoy, sigue simple.

## Implementation approach

Cuatro fases:

1. **Backend**: agregar filtro `moneda` a `listMovimientos`.
2. **Componente shared**: extraer y generalizar la `FiltersBar` + tabla + botón export.
3. **Migrar páginas**: cada página de detalle adopta el componente. `/cuentas/[id]` cambia de endpoint custom al genérico `/movimientos?cuentaId=X`.
4. **Typecheck + verificación manual** en cada página.

---

## Phase 1: Backend — filtro moneda

### Overview
Agregar `moneda?: 'ARS' | 'USD'` al schema y a la query.

### Changes required

**File**: `apps/api/src/modules/movimiento/schemas.ts`
**Changes**: Agregar `moneda: monedaEnum.optional()` a `listMovimientosQuerySchema`.

**File**: `apps/api/src/modules/movimiento/service.ts`
**Changes**: En `listMovimientos`, aplicar `if (opts.moneda) where.moneda = opts.moneda;` al `where`. Agregar `moneda?: Moneda` al type del parámetro.

### Success criteria

**Automated**:
- [ ] `pnpm --filter @financiero/api exec tsc --noEmit` pasa.

**Manual**:
- [ ] `curl /movimientos?moneda=ARS` devuelve solo movs en pesos.
- [ ] `curl /movimientos?moneda=USD` devuelve solo movs en dólares.
- [ ] Sin el filtro, devuelve ambas monedas.

---

## Phase 2: Componente shared `<MovimientosPanel>`

### Overview
Crear un componente en `apps/web/src/components/movimientos-panel.tsx` que encapsula filtros + tabla + botón CSV. Acepta un `scope` para los filtros forzados por contexto.

### Component API

```tsx
type MovimientosPanelProps = {
  scope?: {
    cuentaId?: string;
    sociedadId?: string;
    propiedadId?: string;
    alquilerId?: string;
    bancoId?: string;
    fecha?: string;
  };
  defaultLimit?: number;        // default 200
  filenameHint?: string;        // base name para el CSV; ej "alquiler-1023" o "cuenta-pepe"
  // Opcional: ocultar filtros que no aplican en algún contexto
  hideFilters?: ('from' | 'to' | 'fecha' | 'tipo' | 'q' | 'moneda')[];
};
```

### URL state contract

Lee/escribe estos searchParams del URL actual: `from`, `to`, `tipo`, `q`, `moneda`. **No** persiste `scope` (eso viene fijo del componente padre, no es editable). Usa `useRouter().replace(...)` con `scroll: false` para evitar saltos.

### Componentes internos

1. **FiltersBar**: layout flex-wrap. Inputs/selects controlados por searchParams. Botón "Limpiar" que resetea todos los searchParams.
2. **Tabla**: misma estructura que `/movimientos/page.tsx` (#, Fecha, Tipo, Monto, Origen→Destino, Contexto, Notas). Click en fila navega al detalle (`?id=X` como hoy).
3. **Export button**: handler que:
   - Reúne filtros activos + scope
   - Llama `apiFetch<Mov[]>('/movimientos', { ...filters, ...scope, limit: 5000 })`
   - Construye CSV header + filas
   - Dispara descarga via `Blob` + `<a download>`

### CSV columns

`Numero,Fecha,Tipo,Monto,Moneda,Origen,Destino,Sociedad,Propiedad,Alquiler,Contraparte,Comprobante,Facturado,Notas`

Reglas:
- `Origen`/`Destino` usan `legibleSide()` (mismo helper que la tabla).
- `Facturado` → `Si`/`No`.
- Comas y comillas dentro de campos se escapan con `""` y todo el campo entre comillas.
- Encoding: BOM UTF-8 (`﻿` al inicio del string) para que Excel detecte UTF-8 sin pedir confirmación.
- Filename: `movimientos-{filenameHint}-{YYYY-MM-DD}.csv` (ej `movimientos-cuenta-pepe-2026-05-12.csv`).

### Changes required

**File**: `apps/web/src/components/movimientos-panel.tsx` (nuevo)
**Changes**: Componente completo con todos los sub-componentes inline o en sub-files. Movemos `legibleSide` y `contextoLine` desde `/movimientos/page.tsx` a este componente (o a `apps/web/src/lib/movimiento-display.ts` si los queremos importar de varios lados).

**File**: `apps/web/src/lib/movimiento-display.ts` (nuevo, opcional)
**Changes**: Exportar `legibleSide`, `contextoLine`, `movToCsvRow` y la `Movimiento` type compartida.

### Success criteria

**Automated**:
- [ ] `pnpm --filter @financiero/web exec tsc --noEmit` pasa.

**Manual**:
- [ ] Renderizado standalone (sin scope) muestra todos los movs.
- [ ] Con `scope={{ cuentaId: 'abc' }}` solo muestra movs de esa cuenta (incluyendo REPARTO_SOCIO).
- [ ] Cambiar filtros actualiza URL.
- [ ] Refrescar la página con `?tipo=GASTO` deja el filtro aplicado.
- [ ] Click en "Descargar CSV" descarga el archivo con los filtros aplicados.
- [ ] El CSV se abre limpio en Excel (acentos OK).

---

## Phase 3: Migrar páginas a `<MovimientosPanel>`

### Overview
Reemplazar las tablas custom en cada página por `<MovimientosPanel scope={...} />`.

### Páginas a migrar

#### 3.1 — `/movimientos/page.tsx`
**Changes**: Borrar `FiltersBar`, `MovTable`-equivalente y dejarlo como un wrapper de `<MovimientosPanel />` sin scope. Mantiene el botón "Nuevo movimiento" y el Sheet de detalle.

#### 3.2 — `/cuentas/[id]/page.tsx`
**Changes**: Reemplazar el `<Card><CardHeader>Movimientos</CardHeader>... </Card>` con `<MovimientosPanel scope={{ cuentaId: id }} filenameHint={`cuenta-${cuenta.identifier ?? cuenta.name}`} />`. Deja de usar `useQuery('/cuentas/:id/movimientos')` y se borra el state `movs`.

#### 3.3 — `/sociedades/[id]/page.tsx`
**Changes**: Reemplazar la tabla actual con `<MovimientosPanel scope={{ sociedadId: id }} filenameHint={`sociedad-${sociedad.name}`} />`.

#### 3.4 — `/propiedades/[id]/page.tsx`
**Changes**: Reemplazar la tabla con `<MovimientosPanel scope={{ propiedadId: id }} filenameHint={`propiedad-${propiedad.nombre}`} />`.

#### 3.5 — `/alquileres/[id]/page.tsx`
**Changes**: Reemplazar la tabla con `<MovimientosPanel scope={{ alquilerId: id }} filenameHint={`alquiler-${alquiler.numero}`} />`.

#### 3.6 — `/caja/[fecha]/page.tsx`
**Changes**: Reemplazar con `<MovimientosPanel scope={{ fecha }} filenameHint={`caja-${fecha}`} hideFilters={['from', 'to']} />`. Filtros de fecha ocultos porque la página ya está scope-eada a un día.

### NO migrar
- `/dashboard`: queda con la lista corta y simple de hoy. No tiene filtros, no tiene export.
- `/caja/page.tsx` (vista "hoy"): igual que dashboard, snapshot rápido.

### Filename hints — sanitización
El `filenameHint` puede tener espacios/acentos. Sanitizar antes de meterlo en el filename:
```ts
function sanitize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9-]+/gi, '-').toLowerCase().slice(0, 40);
}
```

### Success criteria

**Automated**:
- [ ] `pnpm --filter @financiero/web exec tsc --noEmit` pasa.

**Manual** (por cada página, navegar y verificar):
- [ ] La barra de filtros aparece.
- [ ] Los filtros funcionan (cargar la página filtra correctamente la tabla).
- [ ] El botón "Descargar CSV" produce un archivo con los movs filtrados del scope.
- [ ] En `/cuentas/[id]` las filas REPARTO_SOCIO aparecen y se exportan.
- [ ] En `/caja/[fecha]` no se ven los filtros de fecha (están ocultos).
- [ ] El filename del CSV incluye el contexto correcto (sociedad-X, alquiler-1023, etc).

---

## Phase 4: Verificación y cleanup

### Overview
Typecheck full, smoke manual, commit.

### Steps
1. `pnpm --filter @financiero/api exec tsc --noEmit`
2. `pnpm --filter @financiero/web exec tsc --noEmit`
3. Levantar la web local (o usar prod) y recorrer cada página afectada.
4. Verificar que descargar CSV en cada página produce el archivo correcto.
5. Verificar que el deep-link funciona (copiar URL con filtros, pegar en otra pestaña).
6. Commit + push.

---

## Edge cases addressed

- **Movs con `derivadoDeId` (REPARTO_SOCIO)** aparecen en `/cuentas/[id]` pero no en `/movimientos` general (el backend ya filtra `derivadoDeId IS NULL` salvo si `cuentaId` está set). El componente no necesita lógica especial — pasa transparente.
- **Filtros vacíos**: no se mandan al backend (clean URL).
- **Filtros con caracteres especiales en `q`**: `useSearchParams` los encodea OK; backend usa `contains` insensitive.
- **CSV en Excel con acentos**: BOM UTF-8 al inicio del string solve.
- **Comma / quote en campos**: escape estándar `""`.
- **Tipo `REPARTO_SOCIO` mostrado en CSV**: incluir el `derivadoDe` en el include del list (ya lo agregamos antes) y exportar el campo Tipo como `Reparto de #N · TIPO_PADRE` para consistencia con la UI.
- **filenameHint con caracteres no ASCII**: sanitizado.
- **Export con muchos movs (cerca de 5000)**: el fetch puede tardar un segundo. El botón muestra "Descargando…" mientras tanto.
- **Export con 0 resultados**: descarga el CSV con solo header. No crashea.

## Testing strategy

- **Backend**: no agregamos tests automatizados aparte; el cambio es trivial (un `where`). Si hay tests existentes para `listMovimientos`, agregar uno para `moneda`.
- **Frontend**: testeo manual recorriendo cada página afectada. No hay tests E2E previos en este path.
- **CSV**: verificar manualmente que un cobro de alquiler con su REPARTO_SOCIO aparezca correctamente en el CSV de la cuenta del socio.

## References

- Códigos previos relevantes:
  - `apps/web/src/app/(operator)/movimientos/page.tsx` — `FiltersBar` existente a extraer
  - `apps/api/src/modules/movimiento/service.ts:303-375` — `listMovimientos` actual
  - `apps/web/src/lib/hooks.ts` — `useQuery` con params
- Memory: `modelo_datos_2026-04-24.md` (modelo de movimientos)
- Memory: `mariana_workflow.md` (hotkey-driven; nada del plan rompe eso, pero pensar en `tabIndex` razonables en la FiltersBar para que se navegue rápido con teclado)

---

## Tech validation

**Date**: 2026-05-12
**Status**: VALIDATED (no novel tech)

### Choices
- React hooks + Next.js `useSearchParams`/`useRouter` — patrón ya usado en `/movimientos/page.tsx`. ✓
- Native `Blob` + `URL.createObjectURL` + `<a download>` — web standard, sin dependencias. ✓
- BOM UTF-8 (`﻿`) al inicio del CSV — patrón estándar para Excel. ✓
- Prisma `where` clause con campo `moneda` — agregamos un AND más, idéntico al patrón existente. ✓

Sin librerías nuevas. Sin patrones experimentales. No requiere WebSearch.

