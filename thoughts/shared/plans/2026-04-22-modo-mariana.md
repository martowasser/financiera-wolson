# Modo Mariana — Formulario rápido + distribución automática a socios

**Fecha:** 2026-04-22
**Supera a:** `2026-04-12-quick-entry-mode-mariana.md` (ver sección "Diferencias con el plan anterior")

## Overview

Rediseñar el flujo de carga de movimientos para que replique el "modo" del sistema viejo que Mariana usa hace 30 años. Dos cambios acoplados que no se pueden separar:

1. **UI:** formulario de lenguaje natural con sociedad como contexto, cuentas contables ocultas.
2. **Backend:** al confirmar un movimiento, el sistema genera automáticamente las contrapartidas en las cuentas corrientes de los socios según el % de participación de la sociedad. Hoy esto se hace batch al correr "Distribución a Socios"; la diferencia con Mariana es que ella ve el efecto al toque.

Si sólo hacemos el (1) sin el (2), le damos a Mariana UX más limpia pero funcionalmente el sistema sigue desviado de lo que ella espera. Eventualmente va a preguntar "¿por qué la cuenta corriente de Alberto no se actualizó?".

## Lo que aprendimos

### Del transcript de la entrevista

- `entrevista-mariana.md:62,66,126` — el "movimiento automático" genera contrapartidas en las cuentas corrientes de cada socio al momento de la carga, no a fin de mes.
- `entrevista-mariana.md:64` — el formulario de carga tiene 3 campos semánticos: descripción/concepto, monto, y origen (vacío=efectivo, código de banco, o cheque).
- `entrevista-mariana.md:128` — al eliminar un movimiento, el sistema automáticamente borra también los colaterales (los de las cuentas corrientes de los socios).
- `entrevista-mariana.md:142` — los % de socios los configura el programador; Mariana no tiene UI para eso.

### De screenshots del sistema viejo (validado con Martin, 2026-04-22)

- Dentro de una **obra (sociedad)**, hay una tabla con las cuentas asociadas. Cada fila es una cuenta con un %.
- Las cuentas corrientes de socios tienen prefijo **C-** (`CJ27`, `CK29`) y un % > 0.
- Las cuentas bancarias tienen prefijo **B-** (`B025`, `B042`) y **% = 0**.
- La suma de los % > 0 es 100%.
- `CJ27` (cuenta corriente de J27) es **global**: el mismo `CJ27` aparece como participante en las múltiples sociedades donde J27 es socio. Los movimientos de J27 en todas las sociedades se consolidan en su única cuenta corriente. (Sospecha razonable; validar con una screenshot de otra sociedad o con Mariana.)

### Contable

Mariana describe el asiento automático así (`entrevista-mariana.md:62`): "un movimiento bancario y después **dos movimientos adicionales** en la cuenta corriente de cada socio". Tres movimientos, no cuatro:

```
Gasto de 1000 en obra X (50/50 entre J27 y K29), pagado por B042:
- CREDIT B042   1000     (sale del banco)
- DEBIT  CJ27    500     (J27 se hace cargo de la mitad)
- DEBIT  CK29    500     (K29 se hace cargo de la mitad)
```

**No existe** una cuenta `Expense` separada a nivel sociedad. La sociedad es el vehículo; los gastos los absorben los socios directamente. El "concepto" (`comida`, `ABL`, `expensas`) es metadata de la transacción, no una cuenta contable.

Esto es un cambio respecto al POC actual, que asume una cuenta `Expense` por sociedad (`2026-04-12-quick-entry-mode-mariana.md:67-78`). Ese modelo no refleja la contabilidad real de Mariana.

### Para ingresos (cobranza de alquiler) el patrón es el inverso

```
Alquiler de 1000 en obra X, cobrado a B042:
- DEBIT  B042   1000     (entra al banco)
- CREDIT CJ27    500     (J27 cobra su mitad)
- CREDIT CK29    500     (K29 cobra su mitad)
```

## Desired End State

### Modelo de datos

**Nuevo tipo de Account:**

```
enum AccountType {
  CASH           // existente
  BANK           // existente
  RECEIVABLE
  PAYABLE
  EQUITY
  REVENUE
  EXPENSE
  OWNER_CURRENT  // NUEVO — cuenta corriente global de un socio, por moneda
}
```

`OWNER_CURRENT` accounts se crean una por `(ownerEntity, currency)`. Ej: `CC J27 ARS`, `CC J27 USD`, `CC K29 ARS`. El nombre/código corto (`CJ27`) es opcional y sólo para compatibilidad visual si se quiere. El `entityId` de la Account apunta al socio (un `Entity` de tipo `PERSON`).

**Nueva tabla `SociedadMember`** (o reusar/extender `Ownership` si ya existe con la forma necesaria):

```
SociedadMember {
  id          String
  sociedadId  String   // FK a Entity (type=COMPANY)
  accountId   String   // FK a Account
  percent     Decimal  // 0..100, guardado con 2 decimales (scaled *100 = bps)
  createdAt   DateTime
  updatedAt   DateTime

  @@unique([sociedadId, accountId])
}
```

- Una fila por cuenta asociada a la sociedad.
- `accountId` puede apuntar a `OWNER_CURRENT` (% > 0) o a `BANK` (% = 0).
- Constraint de negocio (validado en el servicio, no en DB): `sum(percent) where account.type = OWNER_CURRENT AND sociedadId = X === 100` para sociedades activas.

**Campo nuevo en `Transaction`:**

```
sociedadId   String?   // FK a Entity (type=COMPANY). Null sólo para movimientos sin sociedad (transferencias internas, ajustes).
```

Este campo es el driver de la auto-distribución y también habilita reportería por sociedad sin tener que inferirla de los accounts de las entries.

### Lógica de auto-distribución (al crear transacción)

En `apps/api/src/modules/ledger/service.ts` (función `createTransaction`):

```
given: entries (partida doble ya armada por el form), sociedadId

if sociedadId is null:
    // movimiento libre, no hay distribución
    persist entries as-is

else:
    members = SociedadMember.findMany({ sociedadId, account.type === OWNER_CURRENT, percent > 0 })
    originEntries = entries.filter(e => e.account.type in [CASH, BANK])

    for each originEntry:
        inverseType = originEntry.type === DEBIT ? CREDIT : DEBIT
        distributed = distributeProportional(originEntry.amount, members.map(m => m.percent))
        for each (member, amountShare) in zip(members, distributed):
            append entry { accountId: member.accountId, type: inverseType, amount: amountShare }

    persist all entries
```

Notas:
- `distributeProportional` usa largest-remainder (el mismo algoritmo que ya vive en `settlement/service.ts`) para evitar pérdida por redondeo en centavos.
- El origen (`CASH`/`BANK`) es lo que Mariana llama "pagué con" / "cobré por". La contrapartida se distribuye a los socios.
- Los movimientos resultantes balancean por construcción: Σ débitos === Σ créditos.

### Anulación con cascada

En `reverse()`: cuando se anula un movimiento con `sociedadId`, el asiento inverso también debe invertir las entries auto-generadas, no sólo la principal. En la práctica: el asiento inverso espeja **todas** las entries del original con tipo invertido. No hace falta lógica especial — basta con que el reverse tome la transaction entera (incluyendo distribuciones) y las invierta en bloque.

### Formulario rápido (UI)

Reemplaza el actual `transaction-form.tsx` crudo de DEBIT/CREDIT. Tres modos:

1. **Modo rápido (default):** lo que describe Mariana.
2. **Modo sin sociedad:** origen + destino + monto. Para transferencias internas, ajustes, gastos no imputables a ninguna sociedad.
3. **Modo avanzado:** líneas DEBIT/CREDIT crudas. Para casos raros y auditoría.

**Campos del modo rápido:**

| Campo | Tipo | Comportamiento |
|---|---|---|
| ¿Qué hiciste? | Select | `EXPENSE` (Gasto) / `INCOME` (Ingreso) |
| Sociedad | Combobox | Todas las `Entity` con `type=COMPANY`. Recuerda última en localStorage. |
| Concepto | Text | Descripción libre. Autofocus tras elegir sociedad. |
| Monto | Number | |
| Pagué con / Cobré por | Select | Lista filtrada a las cuentas con `SociedadMember.percent = 0` de la sociedad elegida (sus bancos) + "Efectivo ARS" + "Efectivo USD" + "Cheque" (estas tres no dependen de la sociedad). |
| Nro. chequera | Text | Visible sólo si se eligió Cheque. |
| Notas | Textarea | Opcional. |

**Resolución al guardar:**

- "Pagué con Banco X" → `originEntry` = `{ accountId: X, type: CREDIT, amount }` (sale dinero del banco).
- "Cobré por Banco X" → `originEntry` = `{ accountId: X, type: DEBIT, amount }` (entra al banco).
- "Pagué con Efectivo ARS" → idem con la Account CASH global de la Financiera.
- El frontend envía sólo la entry de origen; el backend genera las distribuciones.

### Pantalla de configuración de sociedad

En `/sociedades/[id]`:

- Tabla de cuentas asociadas: columnas `Código` | `Nombre` | `%`.
- Acciones: agregar cuenta (combobox filtrado a `OWNER_CURRENT` + `BANK`), editar %, quitar.
- Validación inline: "Los % de socios deben sumar 100% (actual: X%)".
- Esta pantalla saca a Mariana de la dependencia del programador (`entrevista-mariana.md:142`).

Si `/entities/[id]` hoy ya tiene un componente de Ownership, este diseño lo generaliza a "cuentas miembro con %".

### Arrastre de caja visible

En la vista del día (`/dashboard` o `/transactions`), mostrar claramente el saldo inicial de efectivo (= saldo al cierre del día anterior). Mariana lo llama "caja de seguridad" (`entrevista-mariana.md:30-34`). No requiere lógica nueva — los saldos ya existen — es un componente UI que muestra un card o banner con "Arrastre del día anterior: X".

## What We're NOT Doing

- **No tocamos** el módulo de invoices (cobro de alquileres 2-pasos, IVA, retenciones). Ese flujo ya existe y al integrarse con el ledger nuevo hereda auto-distribución sin cambios.
- **No tocamos** el módulo de conciliación bancaria. Sigue como está.
- **No tocamos** el módulo de `/settlements` (distribución a socios batch). Deja de ser la única forma de ver saldos de socios, pero sigue siendo útil como reporte consolidado por período.
- **No implementamos** códigos crípticos tipo `CJ27`, `B042`. Usamos nombres legibles ("CC J27 ARS", "Banco Credicoop ARS"). El código corto puede vivir como campo opcional para familiaridad.
- **No tocamos** el flujo de `/period` / cierre de caja más allá del arrastre visual.
- **No implementamos** la "globalización" de gastos bancarios (sumar N gastos del mismo tipo en uno solo) — Mariana dice que ya lo resuelve en conciliación.

## Phases

### Phase 1 — Modelo de datos y migración

**Files:**
- `apps/api/prisma/schema/account.prisma` — agregar `OWNER_CURRENT` a `AccountType`.
- `apps/api/prisma/schema/ownership.prisma` **o** archivo nuevo — definir `SociedadMember` (si el existente `Ownership` no sirve 1:1, crear el nuevo y mantener `Ownership` deprecated hasta migrar el settlement service).
- `apps/api/prisma/schema/transaction.prisma` — agregar `sociedadId: String?`.
- Nueva migración Prisma.
- `apps/api/prisma/seed.ts` — agregar datos de ejemplo: crear `OWNER_CURRENT` accounts para los socios de seed (Alberto, J27), crear al menos una sociedad con `SociedadMember` 50/50 y uno o dos bancos al 0%.

**Success criteria:**
- `pnpm --filter api exec prisma migrate dev` aplica sin errores.
- `pnpm --filter api run db:seed` corre y deja datos consistentes.
- `pnpm --filter api test` sigue pasando (los tests del settlement no deberían romperse porque no tocamos `Ownership` hasta Phase 3).

### Phase 2 — Servicio de ledger con auto-distribución

**Files:**
- `apps/api/src/modules/ledger/service.ts` — extender `createTransaction` con la lógica de distribución descripta arriba.
- `apps/api/src/modules/ledger/ledger.routes.test.ts` — casos nuevos:
  - Crear gasto en sociedad 50/50 pagado por banco → verificar 3 entries (CREDIT banco, DEBIT CJ, DEBIT CK) con los montos correctos.
  - Crear ingreso en sociedad 60/40 cobrado a caja efectivo → verificar 3 entries con reparto 60/40.
  - Crear movimiento con `sociedadId=null` → no hay distribución.
  - Anular movimiento con distribución → asiento inverso con 3 entries invertidas.
  - Rounding: 100 pesos con 33/33/34 → 33/33/34 (largest-remainder).

**Success criteria:**
- Tests nuevos pasan.
- Tests viejos siguen pasando.
- Mutation testing informal: probar desde un REPL que un gasto de 1000 en sociedad 50/50 deja saldo -500 en cada cuenta corriente.

### Phase 3 — Formulario rápido (UI)

**Files:**
- `apps/web/src/app/(operator)/transactions/transaction-form.tsx` — reescribir con los 3 modos descriptos.
- `apps/web/src/lib/labels.ts` — agregar labels nuevos si hacen falta (modo rápido, modo libre, modo avanzado).
- `apps/web/src/app/(operator)/transactions/transaction-detail.tsx` — mostrar `sociedadId` en la vista de detalle.

**Success criteria automáticos:**
- `pnpm --filter @financiero/web exec tsc --noEmit` limpio.
- `pnpm --filter @financiero/web build` compila.

**Success criteria manuales:**
- Login como `mariana@financiera.com`.
- Crear gasto de 1000 en una sociedad 50/50 pagado por banco → detalle muestra 3 entries.
- Abrir cuenta corriente del socio → aparece el débito de 500 con la descripción del movimiento.
- Anular el gasto → cuenta corriente del socio vuelve al saldo original.
- Elegir sociedad, cerrar form, reabrir → sociedad preseleccionada (localStorage).
- Cambiar a "Modo sin sociedad" → form con origen + destino + monto.

### Phase 4 — Pantalla de configuración de sociedad

**Files:**
- `apps/web/src/app/(operator)/entities/[id]/...` — extender la vista de sociedad con la tabla de cuentas miembro.
- Endpoint nuevo o existente para `SociedadMember` CRUD.

**Success criteria:**
- Mariana puede agregar/quitar socios y ajustar %.
- Validación "los % deben sumar 100" visible.
- Cambiar el % de un socio no afecta movimientos históricos — sólo los nuevos usan el nuevo %.

### Phase 5 — Arrastre de caja visible

**Files:**
- `apps/web/src/app/(operator)/dashboard/page.tsx` o componente aparte — card con "Arrastre del día anterior".

**Success criteria:**
- Al abrir el dashboard el primer día hábil, el card muestra el saldo con el que arrancó la caja.
- Después de cargar un gasto, el "efectivo actual" baja; el "arrastre" se mantiene.

## Edge Cases

| Caso | Comportamiento |
|---|---|
| Sociedad sin socios configurados (SociedadMember vacío) | Form rápido falla al guardar con "La sociedad no tiene socios configurados" — manda al modo avanzado. |
| Sociedad con % que no suman 100 | Validación bloquea el guardado en la pantalla de config. En el ledger, si los % suman ≠ 100 se rechaza la transacción (protección defensiva). |
| Anular un movimiento que ya fue anulado | Ya existe la validación en `reverse()` (no permite doble reversa). Sin cambios. |
| Rounding: 100 pesos entre 3 socios 33/33/34 | Largest-remainder method → 34/33/33 o similar (ya validado en `settlement/service.ts`). |
| Cambiar el % de un socio después de que hubo movimientos | El cambio sólo afecta movimientos futuros. Los históricos mantienen el % con que se distribuyeron. Ya queda por diseño (los `SociedadMember` se consultan en el momento de crear cada transacción). |
| Socio que deja de participar en una sociedad | Se elimina/desactiva la fila `SociedadMember`. No borra su cuenta corriente ni sus movimientos históricos. |
| Movimiento entre dos sociedades (transferencia) | Fuera del modo rápido — usa modo sin sociedad (`sociedadId=null`) con dos entries de banco opuestas, sin distribución a socios. |
| Moneda mixta | `SociedadMember.percent` es por sociedad, no por moneda. La distribución hereda la moneda de la cuenta de origen (ej. si el banco es USD, las cuentas corrientes destino deben ser USD también). Si no existen, error. |

## Preguntas abiertas (a validar con Mariana antes de cerrar Phase 1)

1. **Global vs per-sociedad para la cuenta corriente del socio:** ¿`CJ27` es una cuenta única que recibe movimientos de todas las sociedades donde J27 participa, o cada sociedad tiene su propio `CJ27-obra8`, `CJ27-obra12`? Sospecha actual: global. Impacto si es per-sociedad: agregar `sociedadId` a la clave de la cuenta corriente, no cambia el resto.
2. **Existencia de cuentas Expense/Revenue por sociedad:** ¿Mariana reporta "gastos totales de obra 8 este mes" de algún lado? ¿O sólo consulta las cuentas corrientes de los socios? Esto confirma si el modelo "sin cuentas Expense" es suficiente.
3. **Bancos con % = 0 vs no listados:** ¿Un banco que la sociedad NO tiene (ej. banco de otra sociedad) aparece en la lista con % = 0 o no aparece? Asumimos que no aparece (sólo los bancos propios de la sociedad se listan).
4. **Múltiples cuentas corrientes por socio:** ¿Un socio tiene una CC por moneda (`CJ27 ARS`, `CJ27 USD`) o una sola? Sospecha: una por moneda, porque Mariana mencionó cajas separadas por moneda.

## Diferencias con el plan anterior (`2026-04-12-quick-entry-mode-mariana.md`)

| Aspecto | Plan anterior | Plan nuevo |
|---|---|---|
| Current state | Asumía que existía un "modo simple" previo | Reconoce que el form actual es crudo DEBIT/CREDIT y el modo rápido se construye desde cero |
| Distribución a socios | "Ya lo maneja el settlement" (falso — settlement es batch) | Core del plan; auto al confirmar movimiento |
| Modelo contable | Asumía cuentas Expense/Revenue por sociedad | Elimina esa capa; distribuye directo a cuentas corrientes de socios |
| Terminología | "Entidad" en UI | "Sociedad" (ya aplicado en commit previo) |
| Scope | Sólo frontend | Frontend + backend + schema |
| Anulación | No mencionada | Cascada explícita en `reverse()` (sale gratis si el inverso espeja todas las entries) |

## Testing Strategy

- **Unit:** `distributeProportional` debe mantenerse en línea con el algoritmo del settlement. Tests específicos de edge cases de rounding.
- **Integration (API):** vida completa de un movimiento — crear → consultar detalle → anular → verificar saldos.
- **Manual E2E (web):** el checklist de Phase 3.
- **Regresión:** los tests existentes del ledger, settlement y reconciliation deben seguir pasando.

## References

- Entrevista: `entrevista-mariana.md`
- Plan anterior: `thoughts/shared/plans/2026-04-12-quick-entry-mode-mariana.md`
- Servicio actual de ledger: `apps/api/src/modules/ledger/service.ts:40-177`
- Servicio actual de settlement (batch): `apps/api/src/modules/settlement/service.ts:27-124`
- Formulario actual: `apps/web/src/app/(operator)/transactions/transaction-form.tsx`
