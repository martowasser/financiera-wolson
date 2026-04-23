# Command Palette + Keyboard-First UX — Implementation Plan

**Date:** 2026-04-22
**Author:** Martin + Claude
**Target:** Demo for Mariana on 2026-04-23

## Overview

Build a Linear/Spotlight-style command palette plus single-key and chord shortcuts for the operator section of the web app, so Mariana can evaluate whether the new system matches the keyboard-driven speed she has in the legacy tool.

## Interview Summary

| Decision | Choice | Notes |
|---|---|---|
| Search style | Fuzzy (cmdk), not semantic/embeddings | Latency & simplicity; Linear uses cmdk too |
| Visual | Modal centered with `backdrop-blur`, Spotlight/Linear look | Use existing `CommandDialog` in `ui/command.tsx` |
| Deep-shortcut screens | Movimientos, Cierre de Caja, Sociedades | Dashboard deliberately excluded — less critical for Mariana |
| "Create new" key | `c` contextual per screen | Linear convention; lighter to remember |
| Theme `d` hotkey | **Remove entirely** | Theme stays in user menu; frees `d` for navigation |
| Demo data | Enrich `prisma/seed.ts` with ~50 entidades + ~200 movimientos | Reminder: seed is demo-only, not prod |
| Checkpoints | Automated: typecheck + build pass | Implement continuously once approved |
| Scope | Operator section only | Viewer has a different persona/UX |

## Current State Analysis

- **Framework:** Next.js 16.2.3 (custom build with breaking changes — consult `apps/web/node_modules/next/dist/docs/` before touching app-router conventions).
- **UI stack:** shadcn (Luma preset, commit `6dcb383`) over Tailwind; `cmdk@1.1.1` installed; `src/components/ui/command.tsx` already wraps cmdk with `Dialog` + `CommandDialog` + all sub-components ready to consume.
- **Operator routes (10):** dashboard, transactions, period, entities, accounts, properties, leases, invoices, settlements, reconciliation. Spanish labels in `src/components/app-sidebar.tsx`.
- **Existing keyboard handling:**
  - `src/components/theme-provider.tsx:37-69` — global `d` listener for dark/light toggle with `isTypingTarget` guard (good pattern to extract/reuse).
  - `src/app/(operator)/transactions/transaction-form.tsx` — multiple forms already support `Ctrl+Enter` to submit.
- **No existing shortcut registry, no palette, no help overlay.**
- **Auth flow:** `(operator)/layout.tsx` wraps `TooltipProvider` → `ProtectedContent` → `AppSidebar` + `<main>{children}</main>`. Ideal mount point for the palette provider is inside `ProtectedContent` after the auth guard.

## Desired End State

When a logged-in operator is on any `(operator)/*` route:

1. Pressing `⌘K` / `Ctrl+K` opens a centered modal with a blurred backdrop, a fuzzy search input, and grouped results: **Acciones**, **Navegación**, **Sociedades**, **Movimientos**.
2. Arrow keys navigate results; `Enter` runs the selected command; `Esc` closes.
3. Single-key shortcuts (guarded against typing contexts):
   - `c` — create (contextual: on Movimientos creates a transaction, on Sociedades creates an entity, on Cierre de Caja triggers the close flow).
   - `/` — focus the page's list filter input.
   - `?` — open the help overlay listing all shortcuts active on the current screen.
4. Chord `g` + letter navigates to a section: `g d` dashboard, `g m` movimientos, `g c` cierre, `g s` sociedades, `g u` cuentas, `g p` propiedades, `g r` contratos (contRatos), `g i` cobro alquileres (Invoices), `g x` distribucion (X for "dist"), `g o` conciliacion (cOnciliacion). Collisions noted below; defaults are tentative and Mariana will refine.
5. Help overlay (`?`) shows all globals + screen-specific shortcuts in real time (registry-driven).
6. Dark/light theme toggle no longer has a hotkey — only accessible via menu.
7. Seed database has rich data so fuzzy search demos convincingly ("gonz" returns entities, "abril" returns April transactions, etc.).

## What We're NOT Doing

- No semantic search / embeddings. Reconsider only if Mariana asks for concept-level search.
- No user-configurable key bindings. Bindings are hard-coded defaults; we'll iterate after Mariana validates them.
- No palette in the viewer section. Viewer persona is distinct.
- No unit tests for the shortcut logic. Demo is tomorrow; manual browser test is the gate. Typecheck + build are the automated gates.
- No mobile/touch affordances for the palette. She uses desktop.
- No keyboard shortcuts on Dashboard beyond what's available globally (Cmd+K, `?`, `g`-chords). She does not land-and-act from Dashboard often per user's answer.
- No persistence of recently-used commands. Stateless for now.

## Implementation Approach

Build bottom-up: primitives → palette → data → screen shortcuts → help overlay → demo data. Each phase leaves the app in a shippable state so the automated checkpoint (typecheck + build) can fire between phases without manual intervention.

Key invariants:
- Every global listener ignores repeating events, modifier keys that aren't ours, and `isTypingTarget`.
- The shortcut registry is the single source of truth — the `?` overlay reads from it, avoiding drift between docs and reality.
- All new code is client-only (`'use client'`), mounted inside the existing `ProtectedContent` so it only activates after auth.

---

## Phase 1 — Keyboard primitives and shortcut registry

### Overview
Extract shared helpers, set up the types + context + hooks for registering shortcuts. No visible UI change yet; remove the `d` theme hotkey.

### Changes
- **NEW** `apps/web/src/lib/shortcuts/is-typing-target.ts` — extract and export the `isTypingTarget` helper currently inlined in `theme-provider.tsx`.
- **NEW** `apps/web/src/lib/shortcuts/types.ts` — type definitions:
  ```ts
  type Shortcut = {
    id: string;
    keys: string[];             // e.g. ["c"], ["g","d"], ["meta+k"]
    label: string;              // human-readable for ? overlay
    group: "Global" | "Navegación" | "Acciones" | string; // screen-scoped groups allowed
    scope?: "global" | string;  // undefined = current screen
    run: () => void;
    when?: () => boolean;       // optional guard (e.g. only when list is focused)
  };
  ```
- **NEW** `apps/web/src/lib/shortcuts/shortcut-context.tsx` — React context holding the active registry (Map<id, Shortcut>). Exposes `register(shortcut)` / `unregister(id)`. Provider is a simple state container.
- **NEW** `apps/web/src/lib/shortcuts/use-keyboard-shortcuts.ts` — hook that takes a `Shortcut[]`, registers them on mount, unregisters on unmount, and wires a single `window.keydown` listener (via the provider) that dispatches to the matching entry. Guards: `event.defaultPrevented`, `event.repeat`, unexpected modifiers, `isTypingTarget`.
- **NEW** `apps/web/src/lib/shortcuts/use-chord.ts` — chord state machine. On the leader key (e.g. `g`), enter "chord mode" for 1.5s; the next non-modifier keypress either matches a registered chord or aborts. Emits a visual toast/indicator (thin pill at bottom-right) while chord mode is active so Mariana knows she's mid-chord.
- **MODIFY** `apps/web/src/components/theme-provider.tsx` — delete the `ThemeHotkey` component and its usage. Theme stays accessible via menu (existing route).
- **MODIFY** `apps/web/src/app/(operator)/layout.tsx` — wrap children in `<ShortcutProvider>` inside `ProtectedContent` (after auth).

### Success Criteria
**Automated:**
- [ ] `pnpm -C apps/web typecheck` passes
- [ ] `pnpm -C apps/web build` passes
- [ ] No runtime errors in `pnpm dev`

**Manual:**
- [ ] `d` no longer toggles theme
- [ ] Registering a dummy shortcut in a test page fires its callback when pressed
- [ ] Typing `c` in an input does NOT fire the shortcut

---

## Phase 2 — Command palette (static commands)

### Overview
Build the palette UI, wire global `⌘K`, populate with Navigation + Actions (no dynamic data yet).

### Changes
- **NEW** `apps/web/src/lib/commands/navigation.ts` — static command list derived from `app-sidebar.tsx` navItems: one command per route with Spanish label and `href`. Each command's `run` calls `router.push(href)`.
- **NEW** `apps/web/src/lib/commands/actions.ts` — global actions: "Nuevo Movimiento" (navigate to `/transactions` and open the new-transaction form), "Nueva Sociedad" (navigate to `/entities` and open form), "Cerrar Caja" (navigate to `/period`). Implementation detail: the palette sets a small query-param flag (`?new=1`) on the target route; the target page reads it on mount and opens its form. This keeps the palette decoupled from each page's internal state.
- **NEW** `apps/web/src/components/command-palette.tsx` — the palette UI. Uses `CommandDialog`, `CommandInput`, `CommandList`, `CommandGroup`, `CommandItem` from `ui/command.tsx`. Props: `open`, `onOpenChange`, `commands`. Groups commands by `group` field.
- **NEW** `apps/web/src/components/command-palette-provider.tsx` — context provider that:
  - Owns `open` state
  - Registers the `⌘K` / `Ctrl+K` global shortcut via `useKeyboardShortcuts` (scope: `global`)
  - Exposes `openPalette()` / `closePalette()` to descendants
  - Renders `<CommandPalette>`
- **MODIFY** `apps/web/src/app/(operator)/layout.tsx` — mount `<CommandPaletteProvider>` inside `<ShortcutProvider>`.
- **STYLING** — use Tailwind's `backdrop-blur-md` on the `DialogOverlay`. The existing `CommandDialog` in `ui/command.tsx` positions at `top-1/3` and is rounded-4xl, which matches the Linear feel. Add a subtle scale-in animation (`tw-animate-css` is installed).

### Success Criteria
**Automated:**
- [ ] typecheck + build pass

**Manual:**
- [ ] `⌘K` on any operator page opens the modal with blurred backdrop
- [ ] Typing filters commands fuzzy-style
- [ ] `Enter` on a "Navegación" item navigates correctly
- [ ] `Enter` on "Nuevo Movimiento" lands on `/transactions` with the create form open
- [ ] `Esc` closes the palette
- [ ] No visual jank (overlay renders above sidebar, no scroll lock issues)

---

## Phase 3 — Data-driven palette entries (Sociedades + Movimientos)

### Overview
Fetch entities + recent transactions into the palette so Mariana can jump to any record by name.

### Changes
- **NEW** `apps/web/src/lib/commands/use-data-commands.ts` — hook that calls the existing API routes to fetch:
  - Top ~200 entities (sociedades + personas)
  - Top ~200 recent transactions (with a derived label like `"2026-04-10 · Alquiler Dpto 4B · $180,000"`)
  Uses existing API client (`src/lib/api.ts` or wherever fetch is centralized — to be confirmed during implementation). Result is memoized; reloads on focus-visibility change (basic freshness).
- **MODIFY** `apps/web/src/components/command-palette-provider.tsx` — merge static + dynamic commands into a single list passed to `<CommandPalette>`. Fetch on provider mount (once) so first `⌘K` press is instant.
- **MODIFY** `apps/web/src/components/command-palette.tsx` — add "Sociedades" and "Movimientos" groups. Each entity item navigates to `/entities/[id]`; each transaction item navigates to `/transactions/[id]` (or opens detail — confirm existing route shape in implementation).

### Success Criteria
**Automated:**
- [ ] typecheck + build pass

**Manual:**
- [ ] Typing part of an entity name returns it in the palette
- [ ] Selecting an entity navigates to its detail
- [ ] Selecting a transaction navigates to its detail
- [ ] Empty query shows all groups with reasonable default ordering
- [ ] Palette opens without perceptible lag (data already loaded)

---

## Phase 4 — Screen-level shortcuts + chord navigation

### Overview
Register `c`, `/`, and `g`-chords. Wire per-screen creation shortcuts on Movimientos, Cierre de Caja, Sociedades.

### Changes
- **MODIFY** `apps/web/src/components/command-palette-provider.tsx` — register global chord navigation at provider level:
  - `g d` → `/dashboard`
  - `g m` → `/transactions` (Movimientos)
  - `g c` → `/period` (Cierre de Caja) — **potential collision with Cuentas/Contratos/Conciliacion; default is Cierre because it's a flagged priority screen**
  - `g s` → `/entities` (Sociedades)
  - `g u` → `/accounts` (cUentas)
  - `g p` → `/properties`
  - `g r` → `/leases` (contRatos)
  - `g i` → `/invoices` (cobro de alquileres / Invoices)
  - `g x` → `/settlements` (distribución/dispersión)
  - `g o` → `/reconciliation` (cOnciliacion)
  - **Flag in help overlay as "tentative — pendiente validación con Mariana"**.
- **MODIFY** `apps/web/src/app/(operator)/transactions/page.tsx` — register screen shortcuts: `c` opens new-transaction form, `/` focuses the filter input. Need to refactor the page slightly to expose a handle to its filter input (forwardRef or a page-level state for `filterQuery` + `isFilterFocused`).
- **MODIFY** `apps/web/src/app/(operator)/entities/page.tsx` — same pattern: `c` → new entity, `/` → focus filter.
- **MODIFY** `apps/web/src/app/(operator)/period/page.tsx` — `c` → start close flow (whatever the "create" analog is on that screen — confirm during implementation). `/` may not apply here if there's no filter; skip if so.
- **MODIFY** other operator pages minimally — only to register `/` focus-filter if they have a filter input; skip `c` where there's no "create" concept.

### Success Criteria
**Automated:**
- [ ] typecheck + build pass

**Manual:**
- [ ] On Movimientos, pressing `c` opens new-transaction form
- [ ] On Entidades, pressing `c` opens new-entity form
- [ ] On Cierre de Caja, pressing `c` kicks off the close flow
- [ ] `/` focuses the filter on pages that have one
- [ ] `g d`, `g m`, `g s`, `g c` all navigate correctly
- [ ] Chord mode pill appears at bottom-right while waiting for second key
- [ ] Chord aborts silently after 1.5s if no second key
- [ ] Typing `c` inside an input still types `c` (not triggering create)

---

## Phase 5 — Help overlay (`?`)

### Overview
Modal listing all active shortcuts on the current screen, registry-driven.

### Changes
- **NEW** `apps/web/src/components/keyboard-shortcuts-help.tsx` — modal rendered by the shortcut provider. Reads the current registry from `ShortcutContext`, groups by `group`, shows label + key hint on the right (using existing `CommandShortcut` styling). Triggered by `?` (register as global shortcut).
- **MODIFY** `apps/web/src/app/(operator)/layout.tsx` — mount the help overlay alongside the palette provider.

### Success Criteria
**Automated:**
- [ ] typecheck + build pass

**Manual:**
- [ ] `?` opens the help overlay on every operator page
- [ ] Overlay lists globals (`⌘K`, `g`+chords, `c`, `/`) + any screen-specific shortcuts
- [ ] Overlay updates when navigating between screens
- [ ] Tentative chord bindings are clearly flagged ("pendiente validación")
- [ ] `Esc` closes the overlay
- [ ] Pressing `?` while typing in an input types `?` normally (isTypingTarget guard)

---

## Phase 6 — Rich seed data for demo

### Overview
Enrich `prisma/seed.ts` so fuzzy search demos convincingly. **Seed is demo-only** — features must not depend on any specific seeded values.

### Changes
- **MODIFY** `apps/api/prisma/seed.ts` — add:
  - ~50 entities: mix of sociedades (SRL, SA) and personas físicas with realistic Argentine names (e.g. "Gonzalez María", "Rodríguez Hnos SRL", "Fideicomiso Belgrano"). Variation in surname/prefix letters so fuzzy search is exercised.
  - ~200 transactions: spread across the last 6 months, varied amounts, descriptions like "Alquiler Dpto 4B abril", "Expensas edificio Palermo marzo", "Comisión inmobiliaria", "Pago servicios", etc. Link to the seeded entities.
  - Keep the existing test fixtures unchanged where tests depend on them — only additive.
- **VERIFY** — `apps/api/src/test-setup.ts` and test-helpers are not broken by the additive seed.

### Success Criteria
**Automated:**
- [ ] `pnpm -C apps/api db:seed` (or existing seed command) completes without errors
- [ ] `pnpm -C apps/api test` still passes (seed changes are additive)
- [ ] typecheck + build pass

**Manual:**
- [ ] In the palette, typing "gonz" returns multiple plausible matches
- [ ] Typing "abril" returns April transactions
- [ ] Typing "alquiler" returns rent-related transactions
- [ ] Entity detail pages render with seeded relationships intact

---

## Edge Cases Addressed

| Case | Handling |
|---|---|
| User presses `⌘K` while in an input | Opens palette anyway — `⌘`-combos bypass `isTypingTarget` |
| Single-key (`c`, `?`, `/`) pressed while typing | Ignored via `isTypingTarget` (except `/` when the page explicitly wants "focus filter" behavior — registered with `when` guard) |
| Chord `g` + nothing | After 1.5s, chord mode aborts silently; pill disappears |
| Multiple palettes opened | Not possible — provider is singleton; `open` state is a boolean |
| SSR hydration | All components are `'use client'`; provider effects run post-mount |
| Palette opened during route transition | `router.push` inside `run()` triggers the overlay unmount; no race (Radix Dialog handles unmount cleanly) |
| Chord collision with browser defaults | `g` alone has no browser meaning when outside an input; safe |
| Entity/transaction list grows large | For POC fine; palette is memoized and cmdk handles filtering in-memory for ~400 items efficiently |
| User loses focus mid-chord | Window blur event aborts chord mode |

## Testing Strategy

**Automated (blocking):**
- `pnpm -C apps/web typecheck` at end of every phase
- `pnpm -C apps/web build` at end of every phase
- `pnpm -C apps/api test` after Phase 6 (seed changes)

**Manual (demo-day gate):**
- Full walkthrough on `pnpm dev` covering: palette open, fuzzy search on all 4 groups, navigate to entity, navigate to transaction, chord `g m`, chord `g s`, chord `g c`, `c` on each of the three priority screens, `/` focus-filter, `?` overlay.
- Verify no regressions: `Ctrl+Enter` still submits transaction forms; auth redirect still works; theme toggle via menu still works.

**No unit tests for shortcuts** — shortcut logic is heavily DOM/event-driven; manual browser test is the right tool for a demo.

## Open Items (for Mariana's review tomorrow)

- Final binding for `c` on Cierre de Caja (confirm the "create" analog is what she expects).
- Chord letters for Spanish-heavy collisions (C* and C* — Cuentas/Contratos/Conciliacion). Current defaults tentative.
- Whether she wants an additional `.` or `Cmd+.` shortcut for quick reverse/undo-style actions.
- Whether dashboard should get its own shortcut set after she sees the demo.

## References

- cmdk docs: https://cmdk.paco.me/
- Linear command menu (reference UX): https://linear.app
- Existing code: `apps/web/src/components/ui/command.tsx` (shadcn wrapper, ready to use)
- Existing pattern: `apps/web/src/components/theme-provider.tsx:37-69` (global keydown with `isTypingTarget` guard)
- User memory: `Mariana's hotkey-driven workflow`, `Seed is demo-only, not prod`
