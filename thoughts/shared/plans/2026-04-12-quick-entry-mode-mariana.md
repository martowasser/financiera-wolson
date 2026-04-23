# Formulario Rápido de Transacciones ("Modo Mariana")

## Overview

Rediseñar el formulario de transacciones para que use lenguaje natural alineado al modelo mental de Mariana (30 años de experiencia), en lugar de exponer la mecánica de doble entrada contable. El formulario actual pide elegir cuentas de débito/crédito explícitamente; el nuevo modo rápido pregunta "¿Qué hiciste?", "¿De qué entidad?", "¿Cuánto?" y "¿Pagaste con qué?", y resuelve las cuentas internamente.

## Decisiones tomadas

| Decisión | Elección |
|----------|----------|
| Resolución de cuenta destino (múltiples EXPENSE por entidad) | Una cuenta default por entidad. Si quiere otra, usa modo avanzado. |
| Sin entidad seleccionada | Modo libre: vuelve al formulario simple actual (origen + destino + monto) |
| Moneda | Inferir de la cuenta de pago. Si elige Efectivo, mostrar selector ARS/USD. |
| Backend | Solo frontend. Usar endpoints existentes (`GET /accounts?entityId=X&type=EXPENSE`). |
| Efectivo (Cash) | Siempre de La Financiera, sin importar qué entidad se seleccione. Solo "Banco" filtra por entidad. |
| Toggle a modo avanzado | Copiar valores resueltos del modo rápido a las líneas de débito/crédito. |
| Fases | 2 fases. |

## Current State

El formulario (`transaction-form.tsx`) tiene dos modos:
- **Modo simple**: Cuenta origen + Cuenta destino + Monto (ya implementado, reemplazó el modo de líneas como default)
- **Modo avanzado**: Líneas de débito/crédito explícitas (toggle "Asiento avanzado")

Ambos modos exponen cuentas contables directamente. No hay concepto de "entidad como contexto" ni lenguaje natural.

## Desired End State

El formulario tiene **tres modos** escalonados:

1. **Modo rápido** (default) — Lenguaje natural, entidad como contexto
2. **Modo simple** (sin entidad) — Origen + destino + monto (lo que hay hoy como default)
3. **Modo avanzado** — Líneas de débito/crédito (lo que hay hoy como toggle)

### Flujo del modo rápido:

```
┌─────────────────────────────────────────────────────┐
│ Nueva Transacción                              [X]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ¿Qué hiciste?     [Pagué un gasto ▼]              │
│                                                     │
│  Entidad            [DA S.A. ▼]          (autocomp) │
│                                                     │
│  Concepto *         [Comida                       ] │
│                                                     │
│  Monto *            [1000.00                      ] │
│                                                     │
│  Pagué con          [Efectivo ▼]                    │
│                     ┌─────────────────────┐         │
│                     │ Efectivo ARS        │         │
│                     │ Efectivo USD        │         │
│                     │ Banco Credicoop ARS │ ← solo  │
│                     │ Cheque              │   de DA  │
│                     └─────────────────────┘         │
│                                                     │
│  Notas (opcional)   [                             ] │
│                                                     │
│  ↳ Sin entidad (modo libre)                         │
│  ↳ Asiento avanzado (múltiples líneas)              │
│                                                     │
│                    [Cancelar]  [Guardar Ctrl+Enter]  │
└─────────────────────────────────────────────────────┘
```

### Lógica de resolución de cuentas (frontend):

| Acción | Medio de pago | Entry DEBIT | Entry CREDIT |
|--------|---------------|-------------|--------------|
| Pagué un gasto | Efectivo ARS | Expense default de la entidad (ARS) | Assets:Cash:ARS (La Financiera) |
| Pagué un gasto | Efectivo USD | Expense default de la entidad (USD) | Assets:Cash:USD (La Financiera) |
| Pagué un gasto | Banco X (de la entidad) | Expense default de la entidad | Cuenta banco X de la entidad |
| Pagué un gasto | Cheque | Expense default de la entidad | Assets:Cash:ARS (La Financiera) + campo nro cheque |
| Cobré un ingreso | Efectivo ARS | Assets:Cash:ARS (La Financiera) | Revenue default de la entidad (ARS) |
| Cobré un ingreso | Banco X | Cuenta banco X de la entidad | Revenue default de la entidad |
| Transferencia | (origen → destino) | Cae al modo simple (origen + destino + monto) |

### Resolución de "cuenta default":

Para cada entidad, la cuenta default se resuelve con esta lógica (en el frontend):

```typescript
function findDefaultAccount(
  accounts: Account[],
  entityId: string,
  type: 'EXPENSE' | 'REVENUE',
  currency: string
): Account | undefined {
  const entityAccounts = accounts.filter(a =>
    a.entityId === entityId &&
    a.type === type &&
    a.currency === currency
  );
  // Preferir la que tiene "General" en el path
  return entityAccounts.find(a => a.path.includes('General'))
    || entityAccounts[0]; // fallback a la primera
}
```

Para las cuentas de Cash (efectivo), siempre se buscan en la entidad FIRM (La Financiera):

```typescript
function findCashAccount(accounts: Account[], currency: string): Account | undefined {
  return accounts.find(a =>
    a.type === 'CASH' &&
    a.currency === currency
  );
}
```

## What We're NOT Doing

- No cambiamos el backend ni el schema de Prisma
- No agregamos `defaultAccountId` a Entity
- No creamos endpoints nuevos
- No cambiamos cómo funciona el modo avanzado (solo lo alimentamos mejor desde el toggle)
- No implementamos autodetección de categoría por concepto
- No cambiamos la lógica de distribución entre socios (eso ya lo maneja el settlement)

---

## Phase 1: Formulario rápido con resolución de cuentas

### Overview

Reemplazar el modo simple actual (origen + destino + monto) con el modo rápido basado en entidad. El modo simple pasa a ser el fallback cuando no se selecciona entidad ("Sin entidad / modo libre"). El modo avanzado permanece igual.

### Changes Required

**File**: `apps/web/src/app/(operator)/transactions/transaction-form.tsx`

**Cambios:**

1. **Nuevo estado `quickMode`**: El formulario arranca en modo rápido (default). Los tres modos son: `'quick' | 'simple' | 'advanced'`.

2. **Campos del modo rápido** (reemplazan los campos simples actuales):
   - `action`: `'EXPENSE' | 'INCOME'` — "¿Qué hiciste?" con labels "Pagué un gasto" / "Cobré un ingreso"
   - `entityId`: string — Combobox de entidades (autocomplete fuzzy)
   - `description`: string — Concepto (ya existe)
   - `amount`: string — Monto (ya existe)
   - `paymentSource`: string — ID de cuenta seleccionada como medio de pago, o `'CASH_ARS'` / `'CASH_USD'` / `'CHECK'` como valores especiales
   - `checkNumber`: string — Solo visible si paymentSource es CHECK (ya existe)
   - `notes`: string — (ya existe)

3. **Fetch de entidades**: Nuevo `useQuery<Entity[]>('/entities')` para popular el combobox de entidades.

4. **Filtrado dinámico de medios de pago**: Cuando se selecciona una entidad, construir la lista de opciones de "Pagué con":
   - Siempre: "Efectivo ARS", "Efectivo USD", "Cheque"
   - Filtrado: cuentas de tipo BANK de esa entidad (de `accounts.filter(a => a.entityId === entityId && a.type === 'BANK')`)

5. **Resolución de entries en `buildEntries()`**: Según la tabla de resolución de cuentas documentada arriba. Buscar cuenta default EXPENSE o REVENUE de la entidad + la cuenta de pago (Cash de La Financiera o Banco de la entidad).

6. **Mapeo de `action` a `type`**: `EXPENSE` → `type: 'EXPENSE'`, `INCOME` → `type: 'INCOME'`. El paymentMethod se deduce: `CASH_ARS`/`CASH_USD` → `'CASH'`, banco → `'BANK_TRANSFER'`, cheque → `'CHECK'`.

7. **Toggle "Sin entidad"**: Cambia a modo simple actual (origen + destino + monto). Label: "Sin entidad (modo libre)".

8. **Toggle "Asiento avanzado"**: Cambia a modo avanzado. Al hacer toggle, pre-popular las entries con las cuentas resueltas del modo rápido (debit account, credit account, monto).

9. **Seleccionar "Transferencia" en ¿Qué hiciste?**: Cambia automáticamente a modo simple (transferencia necesita origen + destino explícitos).

10. **Validación modo rápido**: `isValid = !!entityId && !!description && parseFloat(amount) > 0 && !!paymentSource && cuentasResueltas()`. La función `cuentasResueltas()` verifica que tanto la cuenta default de la entidad como la cuenta de pago existan.

11. **Error UX**: Si la entidad seleccionada no tiene cuenta EXPENSE o REVENUE default, mostrar inline: "Esta entidad no tiene cuenta de [gastos/ingresos] configurada. Usá el modo avanzado."

**File**: `apps/web/src/lib/hooks.ts` (sin cambios, useQuery ya sirve)

**File**: `apps/web/src/components/combobox.tsx` (sin cambios, ya soporta autocomplete fuzzy)

### Success Criteria

#### Automated:
- [ ] `pnpm --filter web exec tsc --noEmit` pasa sin errores
- [ ] `pnpm --filter web build` compila todas las rutas

#### Manual:
- [ ] Login como mariana@financiera.com
- [ ] Abrir /transactions, click "Nueva Transacción"
- [ ] El formulario muestra modo rápido por default: "¿Qué hiciste?", "Entidad", "Concepto", "Monto", "Pagué con"
- [ ] Seleccionar "Pagué un gasto", entidad "DA S.A.", concepto "Comida", monto "1000", "Efectivo ARS" → Guardar → Se crea transacción con DEBIT en Expense:General:DA:ARS y CREDIT en Assets:Cash:ARS
- [ ] Seleccionar "Cobré un ingreso", entidad "DA S.A.", monto "5000", "Banco Credicoop ARS" → Guardar → DEBIT en Assets:Bank:DA:Credicoop:ARS, CREDIT en Income:Rental:DA:ARS
- [ ] Seleccionar entidad, luego "Pagué con" muestra solo los bancos de esa entidad + efectivo + cheque
- [ ] Click "Sin entidad (modo libre)" → muestra formulario simple (origen + destino + monto)
- [ ] Click "Asiento avanzado" → muestra líneas con valores pre-populados del modo rápido
- [ ] Seleccionar "Transferencia" → cambia automáticamente a modo simple
- [ ] Tab entre campos funciona en orden lógico
- [ ] Ctrl+Enter envía el formulario

---

## Phase 2: Polish y mejoras de UX

### Overview

Mejorar la experiencia de uso repetido del formulario rápido: keyboard shortcuts, recordar última entidad, y feedback visual.

### Changes Required

**File**: `apps/web/src/app/(operator)/transactions/transaction-form.tsx`

1. **Recordar última entidad**: Guardar `entityId` en `localStorage` como `lastEntityId`. Al abrir el formulario, pre-seleccionar si existe. Mariana suele cargar varios gastos de la misma sociedad seguidos.

2. **Recordar último medio de pago**: Guardar `paymentSource` en `localStorage`. Pre-seleccionar al abrir.

3. **Auto-focus inteligente**: Si hay entidad pre-seleccionada, auto-focus en "Concepto". Si no, auto-focus en "Entidad".

4. **Preview de cuentas resueltas**: Debajo del botón "Guardar", mostrar en texto pequeño gris las cuentas que el sistema va a usar: "Débito: Expense:General:DA:ARS → Crédito: Assets:Cash:ARS". Esto da transparencia sin complejidad.

5. **Animación de transición entre modos**: Transición suave (fade/slide) al cambiar entre quick → simple → advanced. No es crítico pero mejora la percepción.

### Success Criteria

#### Automated:
- [ ] `pnpm --filter web exec tsc --noEmit` pasa sin errores
- [ ] `pnpm --filter web build` compila

#### Manual:
- [ ] Cargar gasto de DA S.A. → cerrar formulario → abrir de nuevo → DA S.A. pre-seleccionada
- [ ] Con entidad pre-seleccionada, el cursor está en "Concepto"
- [ ] Sin entidad pre-seleccionada, el cursor está en "Entidad"
- [ ] Se ve preview de cuentas resueltas debajo del formulario antes de guardar

---

## Edge Cases

| Caso | Comportamiento |
|------|----------------|
| Entidad sin cuenta EXPENSE default | Mensaje inline: "Esta entidad no tiene cuenta de gastos. Usá modo avanzado." Botón guardar deshabilitado. |
| Entidad sin cuentas BANK | "Pagué con" solo muestra Efectivo ARS, Efectivo USD, Cheque. No hay opción de banco. |
| Entidad con múltiples cuentas EXPENSE de misma moneda | Se usa la que tiene "General" en el path. Si no hay ninguna con "General", se usa la primera. |
| Cambiar de entidad después de elegir banco | Reset de paymentSource (el banco de la entidad anterior ya no aplica). |
| Monto cero o negativo | Botón guardar deshabilitado (ya existe esta validación). |
| Doble click en guardar | Idempotency key (ya existe: `crypto.randomUUID()`). |

## Testing Strategy

- **Type check**: `pnpm --filter web exec tsc --noEmit`
- **Build**: `pnpm --filter web build`
- **Manual E2E**: Login como Mariana, crear transacciones con cada combinación de acción × medio de pago, verificar entries generadas en el detalle de la transacción
- **Backend tests**: No se necesitan cambios — los tests existentes del ledger cubren la creación de transacciones

## References

- Entrevista con Mariana: `financiera-poc/entrevista-mariana.md`
- Requerimientos: `/martin2/requerimientos-sistema-financiero.md`
- Plan técnico: `/martin2/plan-tecnico-sistema-financiero.md`
- Formulario actual: `apps/web/src/app/(operator)/transactions/transaction-form.tsx`
