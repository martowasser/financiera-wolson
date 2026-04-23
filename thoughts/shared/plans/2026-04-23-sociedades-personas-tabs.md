# Separar Sociedades y Personas en tabs con múltiples puertas de entrada

## Overview

Hoy `/entities` muestra en una sola lista mezclada los 4 tipos (COMPANY, PERSON, FIRM, THIRD_PARTY) bajo el rótulo "Sociedades". Para Mariana, "Sociedades" y "Personas" son conceptos distintos. Este plan convierte `/entities` en una página con **dos tabs** (Sociedades / Personas) y expone cada uno como destino de primera clase en sidebar, command palette y chord shortcuts. Una sola ruta, dos puertas de entrada.

## Interview Summary

Decisiones tomadas con el usuario:

- **Tabs**: 2 — Sociedades (`COMPANY`) y Personas (`PERSON` + `FIRM` + `THIRD_PARTY` juntas).
- **Sidebar**: 2 entradas, una por tab.
- **Chord shortcuts**: `g s` sigue siendo Sociedades; se agrega `g n` para Personas (sin tocar `g p` de Propiedades).
- **Viewer (`/viewer/entities`)**: aplica el mismo split.
- **Fetching**: query por tab usando el filtro del backend (`?type=COMPANY` para sociedades; un nuevo `?onlyPersonas=true` para la bolsa de personas, simétrico al `onlySociedades` existente).
- **Botón "Nueva X"**: el texto y el tipo pre-seleccionado en el form dependen del tab activo. El usuario puede cambiar el tipo dentro del form igual.
- **Búsqueda**: filtra dentro del tab activo.
- **Default tab** cuando no hay `?tab=` en la URL: Sociedades.

## Current State Analysis

### Frontend
- `apps/web/src/app/(operator)/entities/page.tsx`
  - Lista única con `useQuery('/entities', { search })`.
  - `EntityFormDialog` interno con un `<Select>` de Tipo (default `COMPANY`).
  - Botón "Nueva Sociedad" hardcodeado.
  - Detalle se maneja por `?id=` (ya alineado en la conversación previa).
- `apps/web/src/app/(viewer)/viewer/entities/page.tsx`
  - Lista simple con columna de tipo, sin tabs. Sin form/edit.
- `apps/web/src/components/app-sidebar.tsx:28` — una entrada `Sociedades` → `/entities`.
- `apps/web/src/components/viewer-sidebar.tsx:22` — mismo patrón para el viewer.
- `apps/web/src/lib/commands/navigation.ts:9` — un ítem `Sociedades` en cmd+k.
- `apps/web/src/lib/commands/actions.ts:16` — acción "Nueva Sociedad" → `/entities?new=1`.
- `apps/web/src/components/command-palette-provider.tsx:38` — chord `g s` → `/entities`.
- `apps/web/src/components/keyboard-shortcuts-help.tsx:40` — grupo "Sociedades" en el order preferido.
- `apps/web/src/components/ui/tabs.tsx` — existe; es el componente de shadcn.

### Backend
- `apps/api/src/modules/entity/routes.ts:22-27` — `listQuerySchema` ya soporta `type` (enum single), `search`, `isActive`, `onlySociedades`. **Falta** equivalente `onlyPersonas`.

## Desired End State

- URL canónica: `/entities?tab=sociedades` o `/entities?tab=personas`. Si no viene `tab`, default Sociedades.
- La página muestra arriba un control de Tabs (shadcn) con dos items. Cambiar de tab actualiza la URL (`router.push`).
- El fetch usa `?type=COMPANY` o `?onlyPersonas=true` según tab.
- Botón de creación:
  - Tab Sociedades → "Nueva Sociedad" + form inicia con `type=COMPANY`.
  - Tab Personas → "Nueva Persona" + form inicia con `type=PERSON`.
- La búsqueda se limita al tab activo.
- Sidebar tiene dos entradas; el activo se marca según tab actual.
- cmd+k:
  - "Ir a Sociedades" y "Ir a Personas" en Navegación.
  - "Nueva Sociedad" y "Nueva Persona" en Acciones.
- Chords: `g s` → tab Sociedades, `g n` → tab Personas.
- `/viewer/entities` mismo tratamiento (tabs, sin botones de edición).

## What We're NOT Doing

- No se renombra la ruta `/entities` ni se duplica a `/sociedades` y `/personas`.
- No se cambia el schema de Entity ni se agregan tipos nuevos.
- No se elimina el filtro `?type=` existente del backend.
- No se tocan chords existentes (`g p` sigue siendo Propiedades).
- No se separan FIRM y THIRD_PARTY del tab de Personas.
- No se agrega acción "Nuevo Tercero" ni "Nueva Financiera" a cmd+k (se crean desde el form dentro del tab Personas cambiando el Tipo en el Select).
- No se cambia la persistencia (local state) de la búsqueda al cambiar de tab (se resetea — comportamiento estándar de tabs).

## Implementation Approach

Divido en 4 fases secuenciales. Cada fase es independiente y deja el sistema funcionando.

---

## Phase 1: Backend — filtro `onlyPersonas`

### Overview
Agregar un flag simétrico al `onlySociedades` existente, que filtre `PERSON ∨ FIRM ∨ THIRD_PARTY`. Mínima superficie de cambio.

### Changes

**File**: `apps/api/src/modules/entity/routes.ts`
- Extender `listQuerySchema` agregando `onlyPersonas: z.coerce.boolean().optional()`.

**File**: `apps/api/src/modules/entity/service.ts`
- En `list(filters)`: cuando `filters.onlyPersonas === true`, setear `where.type = { in: ['PERSON', 'FIRM', 'THIRD_PARTY'] }`. Si vienen ambos (`onlySociedades` y `onlyPersonas`), prevalece `onlySociedades` (consistencia con precedencia existente).

**File**: `apps/api/src/modules/entity/entity.routes.test.ts` (o el test existente relevante)
- Agregar un caso `GET /entities?onlyPersonas=true` y assertar que no devuelve entidades tipo `COMPANY`.

### Success Criteria

#### Automated
- [ ] `pnpm --filter api test` pasa.
- [ ] `pnpm --filter api typecheck` pasa.
- [ ] Nuevo test cubre `onlyPersonas=true`.

#### Manual
- [ ] `curl 'http://localhost:3001/api/entities?onlyPersonas=true'` (con auth) devuelve sólo PERSON/FIRM/THIRD_PARTY.
- [ ] `curl 'http://localhost:3001/api/entities?onlySociedades=true'` sigue devolviendo sólo COMPANY.

---

## Phase 2: Operator `/entities` — tabs + estado dirigido por URL

### Overview
Refactorear `apps/web/src/app/(operator)/entities/page.tsx` para usar shadcn `Tabs`, derivar el estado de la URL y pasar el tipo por default al form.

### Changes

**File**: `apps/web/src/app/(operator)/entities/page.tsx`
- Importar `Tabs, TabsList, TabsTrigger` desde `@/components/ui/tabs`.
- Derivar:
  ```ts
  const tabParam = searchParams.get('tab');
  const activeTab: 'sociedades' | 'personas' = tabParam === 'personas' ? 'personas' : 'sociedades';
  ```
- Cambiar la query:
  ```ts
  const queryParams = activeTab === 'sociedades'
    ? { onlySociedades: true, search: search || undefined }
    : { onlyPersonas: true, search: search || undefined };
  const { data: entities, isLoading, refetch } = useQuery<Entity[]>('/entities', queryParams);
  ```
- Cambiar de tab = `router.push('/entities?tab=...')`. Al hacerlo se limpia la búsqueda local (reset de `search` state en un `useEffect` que dispara cuando cambia `activeTab`).
- El `PageHeader` mantiene título "Sociedades" y description adaptado:
  - Sociedades: "Empresas y sociedades"
  - Personas: "Personas físicas, financieras y terceros"
  - (La title también podría alternar, pero para minimizar churn lo dejamos fijo en "Sociedades y Personas" o adaptamos — decisión de detalle).
- Renderizar `<Tabs value={activeTab} onValueChange={handleTabChange}>` con dos `TabsTrigger`. Debajo va el mismo contenido actual (search input + DataTable).
- Botón "Nueva X":
  ```ts
  const newLabel = activeTab === 'sociedades' ? 'Nueva Sociedad' : 'Nueva Persona';
  const defaultType = activeTab === 'sociedades' ? 'COMPANY' : 'PERSON';
  ```
- Keyboard shortcut `c` (Nueva) cambia label a `newLabel` según tab.

**File**: `apps/web/src/app/(operator)/entities/page.tsx` — componente `EntityFormDialog`
- Aceptar prop `defaultType?: string`.
- Usar `const [type, setType] = useState(entity?.type || defaultType || 'COMPANY');`.
- El título del dialog se adapta:
  - Si `isEdit`: "Editar {labelByType}"
  - Si no: "Nueva {labelByType}"
  (`labelByType` derivado del `type` actual del select).

### Success Criteria

#### Automated
- [ ] `pnpm --filter web typecheck` pasa.
- [ ] `pnpm --filter web test` (si hay tests unitarios) pasa.

#### Manual
- [ ] Abrir `/entities` sin params → se ve tab Sociedades activo con lista de COMPANY.
- [ ] Click en tab Personas → URL cambia a `/entities?tab=personas`, la lista muestra PERSON/FIRM/THIRD_PARTY.
- [ ] En tab Sociedades, botón dice "Nueva Sociedad"; click abre form con `type=COMPANY` pre-seleccionado.
- [ ] En tab Personas, botón dice "Nueva Persona"; click abre form con `type=PERSON` pre-seleccionado.
- [ ] Dentro del form se puede cambiar el Tipo al que quiera el usuario (p.ej. crear FIRM o THIRD_PARTY desde tab Personas).
- [ ] Buscar filtra sólo dentro del tab activo.
- [ ] Refresh de la página mantiene el tab activo (porque está en URL).
- [ ] `/entities?id=xxx` entra al detalle de esa entidad, sin mostrar tabs (detalle full-screen, comportamiento actual).

---

## Phase 3: Navegación — sidebar + command palette + chord `g n`

### Overview
Crear las "puertas de entrada" que llevan a cada tab.

### Changes

**File**: `apps/web/src/components/app-sidebar.tsx`
- Modificar `navItems`:
  ```ts
  { href: '/entities?tab=sociedades', label: 'Sociedades', icon: Building2 },
  { href: '/entities?tab=personas', label: 'Personas', icon: User },
  ```
- Reemplazar la lógica de `active`:
  ```ts
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab');
  const active = (() => {
    if (item.href.includes('?tab=')) {
      const [base, qs] = item.href.split('?');
      const wanted = new URLSearchParams(qs).get('tab');
      return pathname.startsWith(base) && currentTab === wanted;
    }
    return pathname.startsWith(item.href);
  })();
  ```
- Importar icon `User` desde `lucide-react`.

**File**: `apps/web/src/components/viewer-sidebar.tsx`
- Mismo tratamiento, apuntando a `/viewer/entities?tab=...`.

**File**: `apps/web/src/lib/commands/navigation.ts`
- Reemplazar el item único `Sociedades` por dos:
  ```ts
  { href: '/entities?tab=sociedades', label: 'Sociedades', keywords: ['empresas'] },
  { href: '/entities?tab=personas', label: 'Personas', keywords: ['persona', 'financiera', 'tercero'] },
  ```

**File**: `apps/web/src/lib/commands/actions.ts`
- Cambiar `action-new-entity` → `action-new-sociedad`, href a `/entities?tab=sociedades&new=1`, keywords `['sociedad', 'empresa', 'crear']`.
- Agregar nuevo:
  ```ts
  {
    id: 'action-new-persona',
    label: 'Nueva Persona',
    group: 'Acciones',
    keywords: ['persona', 'crear'],
    hint: 'C',
    run: () => router.push('/entities?tab=personas&new=1'),
  }
  ```

**File**: `apps/web/src/components/command-palette-provider.tsx`
- Cambiar chord `g s` a `href: '/entities?tab=sociedades'`.
- Agregar nuevo chord: `{ keys: ['g', 'n'], href: '/entities?tab=personas', label: 'Ir a Personas' }`.

**File**: `apps/web/src/app/(operator)/entities/page.tsx` — leer `?new=1`
- El `?new=1` actual sigue funcionando: al detectarlo se abre el form automáticamente con el `defaultType` calculado desde el tab activo.

### Success Criteria

#### Automated
- [ ] `pnpm --filter web typecheck` pasa.

#### Manual
- [ ] Sidebar muestra dos entradas: Sociedades y Personas. Click en cada una navega correcto y resalta la activa.
- [ ] cmd+k, tipear "persona" → ofrece "Ir a Personas" y "Nueva Persona".
- [ ] cmd+k, tipear "sociedad" → ofrece "Ir a Sociedades" y "Nueva Sociedad".
- [ ] Atajo `g n` desde cualquier página navega a `/entities?tab=personas`.
- [ ] Atajo `g s` sigue navegando a `/entities?tab=sociedades`.
- [ ] En `/entities?tab=personas&new=1`, el form se abre con `type=PERSON`.
- [ ] En `/entities?tab=sociedades&new=1`, el form se abre con `type=COMPANY`.

---

## Phase 4: Viewer `/viewer/entities` — mismos tabs

### Overview
Replicar la estructura de tabs en la página read-only del viewer.

### Changes

**File**: `apps/web/src/app/(viewer)/viewer/entities/page.tsx`
- Agregar lectura de `?tab=` y el control de Tabs (sin botón Nueva, sin form).
- Usar el mismo switch de query (`onlySociedades` vs `onlyPersonas`).
- Al click en row, mantener `router.push('/viewer/entities/${row.id}')`.

### Success Criteria

#### Automated
- [ ] `pnpm --filter web typecheck` pasa.

#### Manual (logueado como viewer)
- [ ] `/viewer/entities` default muestra Sociedades (COMPANY).
- [ ] Click en tab Personas o `/viewer/entities?tab=personas` muestra el grupo correcto.
- [ ] Click en una fila navega al detalle como siempre.

---

## Edge Cases Addressed

| Caso | Comportamiento |
|------|----------------|
| URL sin `?tab=` | Default Sociedades. |
| URL sólo con `?id=xxx` | Entra directo al detalle; no renderiza tabs. |
| URL con `?id=xxx&tab=personas` | Detalle full-screen; al "Volver" cae en `/entities?tab=personas` vía `router.back()` (ya implementado). |
| URL con `?new=1` sin tab | Abre form con tab default (Sociedades) → `type=COMPANY`. |
| URL con `?new=1&tab=personas` | Abre form con `type=PERSON`. |
| Usuario busca en tab Sociedades, luego cambia a Personas | La búsqueda se resetea al cambiar de tab (useEffect reset). |
| Usuario queda en tab Personas con `search=Juan`, refresca | Como la search es state local (no URL), se pierde al refresh. Trade-off aceptado para Phase 2; se puede subir a URL después si hace falta. |
| Backend recibe `onlySociedades=true&onlyPersonas=true` | Prevalece `onlySociedades` (documentado). |
| Viewer entra a `/viewer/entities?id=xxx` (ruta vieja) | No aplica — el viewer usa `/viewer/entities/[id]` con segmento dinámico. El tab no interfiere. |

## Testing Strategy

### Unit
- Backend: nuevo test para `onlyPersonas=true` en el test suite de entity routes.

### E2E
- `apps/web/e2e/entities.spec.ts`:
  - Actualizar si el test actual asume un título o una lista única.
  - Agregar flujo: ir a Personas tab, crear una persona, volver a Sociedades, confirmar que no aparece ahí.

### Manual
- Rol Operator: recorrer todas las puertas de entrada (sidebar, cmd+k, chord, link directo).
- Rol Viewer: recorrer la misma matriz.
- Flow completo: desde cualquier página, `g n` → crear persona → `g s` → verificar que no aparece en Sociedades.

## References

- Backend filter actual: `apps/api/src/modules/entity/routes.ts:26` (`onlySociedades`).
- Chord definitions: `apps/web/src/components/command-palette-provider.tsx:33-45`.
- Navigation palette: `apps/web/src/lib/commands/navigation.ts`.
- Actions palette: `apps/web/src/lib/commands/actions.ts`.
- Sidebars: `apps/web/src/components/app-sidebar.tsx:24-35`, `apps/web/src/components/viewer-sidebar.tsx`.
- shadcn Tabs: `apps/web/src/components/ui/tabs.tsx`.
- Memory: "Mariana's hotkey-driven workflow — primary operator navigates legacy system mostly via keyboard; UI should be keyboard-first". Este plan refuerza esa dirección (chord nuevo + palette + sidebar).
