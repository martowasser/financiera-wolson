'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@/lib/hooks';
import { apiFetch, ApiError } from '@/lib/api';
import { formatApiError } from '@/lib/api-errors';
import { inputToCentavos } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { movimientoTipoLabels, bucketLabels, label } from '@/lib/labels';

type Bucket = 'CAJA' | 'BANCO' | 'CUENTA_CORRIENTE';
type Moneda = 'ARS' | 'USD';

type Flow = 'I' | 'E' | 'T' | 'F';

// Mirrors the server's RULES map in apps/api/src/modules/movimiento/service.ts
// keep in sync when tipos / allowed buckets change.
const RULES: Record<string, {
  flow: Flow;
  origenAllowed?: Bucket[];
  destinoAllowed?: Bucket[];
  requireAlquiler?: boolean;
  requirePropiedad?: boolean;
  requireSociedad?: boolean;
  requireBancoOrigen?: boolean;
  requireNotes?: boolean;
  allowContraparte?: boolean;
}> = {
  ALQUILER_COBRO:    { flow: 'I', destinoAllowed: ['CAJA', 'BANCO'], requireAlquiler: true },
  GASTO:             { flow: 'E', origenAllowed: ['CAJA', 'BANCO', 'CUENTA_CORRIENTE'], allowContraparte: true },
  GASTO_SOCIEDAD:    { flow: 'E', origenAllowed: ['CAJA', 'BANCO'], requireSociedad: true },
  GASTO_PROPIEDAD:   { flow: 'E', origenAllowed: ['CAJA', 'BANCO'], requirePropiedad: true },
  INGRESO_VARIO:     { flow: 'I', destinoAllowed: ['CAJA', 'BANCO', 'CUENTA_CORRIENTE'], allowContraparte: true },
  TRANSFERENCIA:     { flow: 'T', origenAllowed: ['CAJA', 'BANCO', 'CUENTA_CORRIENTE'], destinoAllowed: ['CAJA', 'BANCO', 'CUENTA_CORRIENTE'] },
  COMISION_BANCARIA: { flow: 'E', origenAllowed: ['BANCO'], requireBancoOrigen: true },
  DEBITO_AUTOMATICO: { flow: 'E', origenAllowed: ['BANCO'], requireBancoOrigen: true },
  RECUPERO:          { flow: 'I', destinoAllowed: ['CAJA', 'BANCO', 'CUENTA_CORRIENTE'] },
  AJUSTE:            { flow: 'F', origenAllowed: ['CAJA', 'BANCO', 'CUENTA_CORRIENTE'], destinoAllowed: ['CAJA', 'BANCO', 'CUENTA_CORRIENTE'], requireNotes: true },
  OTRO:              { flow: 'F', origenAllowed: ['CAJA', 'BANCO', 'CUENTA_CORRIENTE'], destinoAllowed: ['CAJA', 'BANCO', 'CUENTA_CORRIENTE'], requireNotes: true },
};

const TIPOS = Object.keys(RULES);

type Banco = { id: string; nombre: string; numero: string };
type Cuenta = { id: string; name: string; identifier: string | null };
type Sociedad = { id: string; name: string };
type Propiedad = { id: string; nombre: string; direccion: string };
type Alquiler = { id: string; numero: number; propiedad: { nombre: string }; inquilino: { name: string } };

export function NewMovimientoForm({ onSaved, onCancel }: { onSaved: (numero: number) => void; onCancel: () => void }) {
  const [tipo, setTipo] = useState<string | null>(null);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<Moneda>('ARS');
  const [origenBucket, setOrigenBucket] = useState<Bucket | ''>('');
  const [origenBancoId, setOrigenBancoId] = useState('');
  const [origenCuentaId, setOrigenCuentaId] = useState('');
  const [destinoBucket, setDestinoBucket] = useState<Bucket | ''>('');
  const [destinoBancoId, setDestinoBancoId] = useState('');
  const [destinoCuentaId, setDestinoCuentaId] = useState('');
  const [sociedadId, setSociedadId] = useState('');
  const [propiedadId, setPropiedadId] = useState('');
  const [alquilerId, setAlquilerId] = useState('');
  const [cuentaContraparteId, setCuentaContraparteId] = useState('');
  const [comprobante, setComprobante] = useState('');
  const [facturado, setFacturado] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: bancos } = useQuery<Banco[]>('/bancos', { active: 'true' });
  const { data: cuentas } = useQuery<Cuenta[]>('/cuentas', { active: 'true' });
  const { data: sociedades } = useQuery<Sociedad[]>('/sociedades');
  const { data: propiedades } = useQuery<Propiedad[]>('/propiedades', { active: 'true' });
  const { data: alquileres } = useQuery<Alquiler[]>('/alquileres', { status: 'ACTIVO' });

  // Pre-flight: comprobar si la caja del día elegido está cerrada para avisar antes
  // del submit. NONE = caja todavía no existe (la creará el backend en el POST).
  const [cajaCheck, setCajaCheck] = useState<'CHECKING' | 'OPEN' | 'CLOSED' | 'NONE'>('NONE');
  useEffect(() => {
    if (!fecha) return;
    let cancelled = false;
    setCajaCheck('CHECKING');
    apiFetch<{ status: 'OPEN' | 'CLOSED' }>(`/caja/${fecha}`)
      .then((c) => { if (!cancelled) setCajaCheck(c.status); })
      .catch((e) => {
        if (cancelled) return;
        // 404 = caja inexistente (válido — el backend la crea al POSTear el mov).
        if (e instanceof ApiError && e.code === 'NOT_FOUND') setCajaCheck('NONE');
        else setCajaCheck('NONE');
      });
    return () => { cancelled = true; };
  }, [fecha]);

  const rule = tipo ? RULES[tipo] : null;

  const canSubmit = useMemo(() => {
    if (!rule) return false;
    if (cajaCheck === 'CLOSED') return false;
    if (!monto.trim() || parseFloat(monto) <= 0) return false;
    if (rule.requireNotes && !notes.trim()) return false;
    if (rule.requireAlquiler && !alquilerId) return false;
    if (rule.requirePropiedad && !propiedadId) return false;
    if (rule.requireSociedad && !sociedadId) return false;
    if (rule.flow === 'I') {
      if (!destinoBucket) return false;
      if (destinoBucket === 'BANCO' && !destinoBancoId) return false;
      if (destinoBucket === 'CUENTA_CORRIENTE' && !destinoCuentaId) return false;
    } else if (rule.flow === 'E') {
      if (!origenBucket) return false;
      if (origenBucket === 'BANCO' && !origenBancoId) return false;
      if (origenBucket === 'CUENTA_CORRIENTE' && !origenCuentaId) return false;
    } else if (rule.flow === 'T') {
      if (!origenBucket || !destinoBucket) return false;
      if (origenBucket === 'BANCO' && !origenBancoId) return false;
      if (origenBucket === 'CUENTA_CORRIENTE' && !origenCuentaId) return false;
      if (destinoBucket === 'BANCO' && !destinoBancoId) return false;
      if (destinoBucket === 'CUENTA_CORRIENTE' && !destinoCuentaId) return false;
    } else {
      if (!origenBucket && !destinoBucket) return false;
    }
    return true;
  }, [rule, cajaCheck, monto, notes, alquilerId, propiedadId, sociedadId, origenBucket, origenBancoId, origenCuentaId, destinoBucket, destinoBancoId, destinoCuentaId]);

  async function submit() {
    if (!tipo || !rule) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        fecha,
        tipo,
        monto: inputToCentavos(monto),
        moneda,
      };
      if (origenBucket) {
        body.origenBucket = origenBucket;
        if (origenBucket === 'BANCO' && origenBancoId) body.origenBancoId = origenBancoId;
        if (origenBucket === 'CUENTA_CORRIENTE' && origenCuentaId) body.origenCuentaId = origenCuentaId;
      }
      if (destinoBucket) {
        body.destinoBucket = destinoBucket;
        if (destinoBucket === 'BANCO' && destinoBancoId) body.destinoBancoId = destinoBancoId;
        if (destinoBucket === 'CUENTA_CORRIENTE' && destinoCuentaId) body.destinoCuentaId = destinoCuentaId;
      }
      if (sociedadId) body.sociedadId = sociedadId;
      if (propiedadId) body.propiedadId = propiedadId;
      if (alquilerId) body.alquilerId = alquilerId;
      if (cuentaContraparteId) body.cuentaContraparteId = cuentaContraparteId;
      if (comprobante.trim()) body.comprobante = comprobante.trim();
      if (facturado) body.facturado = true;
      if (notes.trim()) body.notes = notes.trim();

      const created = await apiFetch<{ numero: number }>('/movimientos', { method: 'POST', body });
      toast.success(`Movimiento #${created.numero} registrado`);
      onSaved(created.numero);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSaving(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canSubmit) {
      e.preventDefault();
      submit();
    }
  }

  // Step 1: pick tipo
  if (!tipo) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Elegí el tipo de movimiento.</p>
        <div className="grid grid-cols-2 gap-2">
          {TIPOS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className="rounded-md border px-3 py-3 text-left hover:bg-accent hover:text-accent-foreground"
            >
              <div className="text-sm font-medium">{label(movimientoTipoLabels, t)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {RULES[t].flow === 'I' ? 'Entra plata'
                  : RULES[t].flow === 'E' ? 'Sale plata'
                  : RULES[t].flow === 'T' ? 'Mueve entre buckets'
                  : 'Libre (requiere notas)'}
              </div>
            </button>
          ))}
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        </div>
      </div>
    );
  }

  const showOrigen = rule!.flow === 'E' || rule!.flow === 'T' || rule!.flow === 'F';
  const showDestino = rule!.flow === 'I' || rule!.flow === 'T' || rule!.flow === 'F';

  return (
    <div className="space-y-4" onKeyDown={handleKey}>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setTipo(null)}>← Cambiar tipo</Button>
        <span className="text-sm font-medium">{label(movimientoTipoLabels, tipo)}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-1">
          <Label>Fecha</Label>
          <Input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            aria-invalid={cajaCheck === 'CLOSED'}
            className={cajaCheck === 'CLOSED' ? 'border-red-500 focus-visible:ring-red-500' : undefined}
          />
          {cajaCheck === 'CLOSED' && (
            <p className="text-xs text-red-600 mt-1">
              Caja de esa fecha cerrada. Reabrila o usá otra fecha.
            </p>
          )}
        </div>
        <div className="col-span-1">
          <Label>Monto</Label>
          <Input type="number" step="0.01" min="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" autoFocus />
        </div>
        <div className="col-span-1">
          <Label>Moneda</Label>
          <select value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)}
            className="flex h-9 w-full rounded-md border bg-background px-3 text-sm">
            <option value="ARS">Pesos (ARS)</option>
            <option value="USD">Dólares (USD)</option>
          </select>
        </div>
      </div>

      {showOrigen && (
        <div className="rounded-md border p-3 space-y-2">
          <Label className="text-xs uppercase text-muted-foreground">De dónde sale</Label>
          <select
            value={origenBucket}
            onChange={(e) => { setOrigenBucket(e.target.value as Bucket | ''); setOrigenBancoId(''); setOrigenCuentaId(''); }}
            className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Seleccionar…</option>
            {(rule!.origenAllowed ?? []).map((b) => (
              <option key={b} value={b}>{label(bucketLabels, b)}</option>
            ))}
          </select>
          {origenBucket === 'BANCO' && (
            <select value={origenBancoId} onChange={(e) => setOrigenBancoId(e.target.value)}
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— Banco —</option>
              {(bancos ?? []).map((b) => <option key={b.id} value={b.id}>{b.nombre} ({b.numero})</option>)}
            </select>
          )}
          {origenBucket === 'CUENTA_CORRIENTE' && (
            <select value={origenCuentaId} onChange={(e) => setOrigenCuentaId(e.target.value)}
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— Cuenta corriente —</option>
              {(cuentas ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
      )}

      {showDestino && (
        <div className="rounded-md border p-3 space-y-2">
          <Label className="text-xs uppercase text-muted-foreground">A dónde va</Label>
          <select
            value={destinoBucket}
            onChange={(e) => { setDestinoBucket(e.target.value as Bucket | ''); setDestinoBancoId(''); setDestinoCuentaId(''); }}
            className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Seleccionar…</option>
            {(rule!.destinoAllowed ?? []).map((b) => (
              <option key={b} value={b}>{label(bucketLabels, b)}</option>
            ))}
          </select>
          {destinoBucket === 'BANCO' && (
            <select value={destinoBancoId} onChange={(e) => setDestinoBancoId(e.target.value)}
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— Banco —</option>
              {(bancos ?? []).map((b) => <option key={b.id} value={b.id}>{b.nombre} ({b.numero})</option>)}
            </select>
          )}
          {destinoBucket === 'CUENTA_CORRIENTE' && (
            <select value={destinoCuentaId} onChange={(e) => setDestinoCuentaId(e.target.value)}
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— Cuenta corriente —</option>
              {(cuentas ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
      )}

      {rule!.requireAlquiler && (
        <div>
          <Label>Alquiler</Label>
          <select value={alquilerId} onChange={(e) => setAlquilerId(e.target.value)}
            className="flex h-9 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">Seleccionar alquiler…</option>
            {(alquileres ?? []).map((c) => (
              <option key={c.id} value={c.id}>#{c.numero} · {c.propiedad.nombre} · {c.inquilino.name}</option>
            ))}
          </select>
        </div>
      )}
      {rule!.requirePropiedad && (
        <div>
          <Label>Propiedad</Label>
          <select value={propiedadId} onChange={(e) => setPropiedadId(e.target.value)}
            className="flex h-9 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">Seleccionar propiedad…</option>
            {(propiedades ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.nombre} · {p.direccion}</option>
            ))}
          </select>
        </div>
      )}
      {rule!.requireSociedad && (
        <div>
          <Label>Sociedad</Label>
          <select value={sociedadId} onChange={(e) => setSociedadId(e.target.value)}
            className="flex h-9 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">Seleccionar sociedad…</option>
            {(sociedades ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}
      {rule!.allowContraparte && (
        <div>
          <Label>Contraparte (opcional)</Label>
          <select value={cuentaContraparteId} onChange={(e) => setCuentaContraparteId(e.target.value)}
            className="flex h-9 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">—</option>
            {(cuentas ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Comprobante</Label>
          <Input value={comprobante} onChange={(e) => setComprobante(e.target.value)} placeholder="Ej: Factura 0001-00012345" />
        </div>
        <div className="flex items-end gap-2">
          <Checkbox id="facturado" checked={facturado} onCheckedChange={(v) => setFacturado(v === true)} />
          <Label htmlFor="facturado">Facturado</Label>
        </div>
      </div>

      <div>
        <Label>Notas {rule!.requireNotes && <span className="text-red-600">*</span>}</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <p className="text-xs text-muted-foreground">Ctrl+Enter para guardar.</p>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button onClick={submit} disabled={!canSubmit || saving}>Guardar</Button>
      </div>
    </div>
  );
}
