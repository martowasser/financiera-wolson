'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@/lib/hooks';
import { apiFetch } from '@/lib/api';
import { formatApiError } from '@/lib/api-errors';
import { formatMoney, formatDate, formatDateTime } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { label, movimientoTipoLabels, bucketLabels } from '@/lib/labels';
import { NewMovimientoForm } from './new-movimiento-form';

type Mov = {
  id: string;
  numero: number;
  fecha: string;
  tipo: string;
  monto: string;
  moneda: string;
  origenBucket: string | null;
  destinoBucket: string | null;
  notes: string | null;
  comprobante: string | null;
  facturado: boolean;
  bancoOrigen: { id: string; nombre: string } | null;
  bancoDestino: { id: string; nombre: string } | null;
  cuentaOrigen: { id: string; name: string } | null;
  cuentaDestino: { id: string; name: string } | null;
  cuentaContraparte: { id: string; name: string } | null;
  sociedad: { id: string; name: string } | null;
  propiedad: { id: string; nombre: string } | null;
  alquiler: { id: string; numero: number } | null;
};

type Filters = {
  tipo?: string;
  sociedadId?: string;
  alquilerId?: string;
  propiedadId?: string;
  bancoId?: string;
  cuentaId?: string;
  from?: string;
  to?: string;
  q?: string;
};

export default function MovimientosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const newOpen = searchParams.get('new') === '1';
  const selectedId = searchParams.get('id');

  const [filters, setFilters] = useState<Filters>({});
  const params = { ...filters, limit: 200 };

  const { data: movs, isLoading, refetch } = useQuery<Mov[]>('/movimientos', params);

  const { data: selected, refetch: refetchSelected } = useQuery<Mov & { createdAt: string; createdBy: { name: string }; reversoDeId: string | null }>(
    selectedId ? `/movimientos/${selectedId}` : null,
  );

  const closeNew = () => router.replace('/movimientos');
  const closeDetail = () => router.replace('/movimientos');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Movimientos"
        description="Flujo de plata entre cajas, bancos y cuentas"
        actions={
          <Link href="/movimientos?new=1"><Button size="sm"><Plus className="h-4 w-4" /> Nuevo movimiento</Button></Link>
        }
      />

      <FiltersBar filters={filters} setFilters={setFilters} />

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-2 py-2 text-left font-medium">#</th>
              <th className="px-2 py-2 text-left font-medium">Fecha</th>
              <th className="px-2 py-2 text-left font-medium">Tipo</th>
              <th className="px-2 py-2 text-right font-medium">Monto</th>
              <th className="px-2 py-2 text-left font-medium">Origen → Destino</th>
              <th className="px-2 py-2 text-left font-medium">Contexto</th>
              <th className="px-2 py-2 text-left font-medium">Notas</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-2 py-4 text-muted-foreground">Cargando…</td></tr>}
            {movs && movs.length === 0 && <tr><td colSpan={7} className="px-2 py-4 text-muted-foreground">Sin movimientos.</td></tr>}
            {(movs ?? []).map((m) => (
              <tr
                key={m.id}
                onClick={() => router.replace(`/movimientos?id=${m.id}`)}
                className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
              >
                <td className="px-2 py-2 font-mono text-xs">#{m.numero}</td>
                <td className="px-2 py-2">{formatDate(m.fecha)}</td>
                <td className="px-2 py-2"><Badge variant="outline">{label(movimientoTipoLabels, m.tipo)}</Badge></td>
                <td className="px-2 py-2 text-right font-medium">{formatMoney(m.monto, m.moneda)}</td>
                <td className="px-2 py-2 text-muted-foreground text-xs">{legibleSide(m, 'origen')} → {legibleSide(m, 'destino')}</td>
                <td className="px-2 py-2 text-xs">{contextoLine(m)}</td>
                <td className="px-2 py-2 text-xs text-muted-foreground truncate max-w-[220px]">{m.notes ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={newOpen} onOpenChange={(v) => { if (!v) closeNew(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nuevo movimiento</DialogTitle></DialogHeader>
          {newOpen && (
            <NewMovimientoForm
              onCancel={closeNew}
              onSaved={() => { refetch(); closeNew(); }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Sheet open={!!selectedId} onOpenChange={(v) => { if (!v) closeDetail(); }}>
        <SheetContent className="w-full max-w-lg sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{selected ? `Movimiento #${selected.numero}` : 'Cargando…'}</SheetTitle>
          </SheetHeader>
          {selected && (
            <DetailView mov={selected} onChange={() => { refetchSelected(); refetch(); }} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function legibleSide(m: Mov, side: 'origen' | 'destino') {
  const bucket = side === 'origen' ? m.origenBucket : m.destinoBucket;
  const banco = side === 'origen' ? m.bancoOrigen : m.bancoDestino;
  const cuenta = side === 'origen' ? m.cuentaOrigen : m.cuentaDestino;
  if (!bucket) return '—';
  if (bucket === 'CAJA') return 'Caja';
  if (bucket === 'BANCO') return `${label(bucketLabels, bucket)} ${banco?.nombre ?? ''}`.trim();
  if (bucket === 'CUENTA_CORRIENTE') return `${cuenta?.name ?? ''}`;
  return bucket;
}

function contextoLine(m: Mov) {
  const parts: string[] = [];
  if (m.alquiler) parts.push(`#${m.alquiler.numero}`);
  if (m.propiedad) parts.push(m.propiedad.nombre);
  if (m.sociedad) parts.push(m.sociedad.name);
  if (m.cuentaContraparte) parts.push(m.cuentaContraparte.name);
  return parts.length ? <span className="text-muted-foreground">{parts.join(' · ')}</span> : <span className="text-muted-foreground">—</span>;
}

function FiltersBar({ filters, setFilters }: { filters: Filters; setFilters: (f: Filters) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Buscar en notas o comprobante…"
        value={filters.q ?? ''}
        onChange={(e) => setFilters({ ...filters, q: e.target.value || undefined })}
        className="max-w-sm"
      />
      <select
        value={filters.tipo ?? ''}
        onChange={(e) => setFilters({ ...filters, tipo: e.target.value || undefined })}
        className="h-9 rounded-md border bg-background px-3 text-sm"
      >
        <option value="">Todos los tipos</option>
        {Object.keys(movimientoTipoLabels).map((t) => (
          <option key={t} value={t}>{movimientoTipoLabels[t]}</option>
        ))}
      </select>
      <Input
        type="date"
        value={filters.from ?? ''}
        onChange={(e) => setFilters({ ...filters, from: e.target.value || undefined })}
        className="w-40"
      />
      <span className="text-xs text-muted-foreground">a</span>
      <Input
        type="date"
        value={filters.to ?? ''}
        onChange={(e) => setFilters({ ...filters, to: e.target.value || undefined })}
        className="w-40"
      />
      {(filters.tipo || filters.from || filters.to || filters.q) && (
        <Button size="sm" variant="ghost" onClick={() => setFilters({})}>Limpiar</Button>
      )}
    </div>
  );
}

function DetailView({ mov, onChange }: {
  mov: Mov & { createdAt: string; createdBy: { name: string }; reversoDeId: string | null };
  onChange: () => void;
}) {
  const [notes, setNotes] = useState(mov.notes ?? '');
  const [comprobante, setComprobante] = useState(mov.comprobante ?? '');
  const [facturado, setFacturado] = useState(mov.facturado);
  const [savingEdit, setSavingEdit] = useState(false);
  const [reversarOpen, setReversarOpen] = useState(false);

  async function saveEdit() {
    setSavingEdit(true);
    try {
      await apiFetch(`/movimientos/${mov.id}`, {
        method: 'PUT',
        body: {
          notes: notes.trim() || null,
          comprobante: comprobante.trim() || null,
          facturado,
        },
      });
      toast.success('Movimiento actualizado');
      onChange();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="space-y-4 mt-4 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <div><span className="text-muted-foreground">Tipo:</span> {label(movimientoTipoLabels, mov.tipo)}</div>
        <div><span className="text-muted-foreground">Fecha:</span> {formatDate(mov.fecha)}</div>
        <div><span className="text-muted-foreground">Monto:</span> <strong>{formatMoney(mov.monto, mov.moneda)}</strong></div>
        <div><span className="text-muted-foreground">Moneda:</span> {mov.moneda}</div>
      </div>

      <div className="rounded-md border p-3 space-y-1">
        <div className="text-xs uppercase text-muted-foreground">Flujo</div>
        <div>{legibleSide(mov, 'origen')} → {legibleSide(mov, 'destino')}</div>
      </div>

      {(mov.sociedad || mov.propiedad || mov.alquiler || mov.cuentaContraparte) && (
        <div className="rounded-md border p-3 space-y-1 text-xs">
          {mov.sociedad && <div><span className="text-muted-foreground">Sociedad:</span> <Link href={`/sociedades/${mov.sociedad.id}`} className="hover:underline">{mov.sociedad.name}</Link></div>}
          {mov.propiedad && <div><span className="text-muted-foreground">Propiedad:</span> <Link href={`/propiedades/${mov.propiedad.id}`} className="hover:underline">{mov.propiedad.nombre}</Link></div>}
          {mov.alquiler && <div><span className="text-muted-foreground">Alquiler:</span> <Link href={`/alquileres/${mov.alquiler.id}`} className="hover:underline">#{mov.alquiler.numero}</Link></div>}
          {mov.cuentaContraparte && <div><span className="text-muted-foreground">Contraparte:</span> <Link href={`/cuentas/${mov.cuentaContraparte.id}`} className="hover:underline">{mov.cuentaContraparte.name}</Link></div>}
        </div>
      )}

      <div className="space-y-2">
        <div>
          <Label>Comprobante</Label>
          <Input value={comprobante} onChange={(e) => setComprobante(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="facturado-detail" checked={facturado} onCheckedChange={(v) => setFacturado(v === true)} />
          <Label htmlFor="facturado-detail">Facturado</Label>
        </div>
        <div>
          <Label>Notas</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>
        <Button size="sm" onClick={saveEdit} disabled={savingEdit}>Guardar cambios</Button>
      </div>

      <div className="border-t pt-3 text-xs text-muted-foreground">
        Creado {formatDateTime(mov.createdAt)} por {mov.createdBy.name}.
        {mov.reversoDeId && <span> · Este movimiento es un reverso.</span>}
      </div>

      {!mov.reversoDeId && (
        <div>
          <Button variant="outline" size="sm" onClick={() => setReversarOpen(true)}>Reversar movimiento</Button>
        </div>
      )}

      <ReversarDialog
        movId={mov.id}
        open={reversarOpen}
        onClose={() => setReversarOpen(false)}
        onSaved={() => { setReversarOpen(false); onChange(); }}
      />
    </div>
  );
}

function ReversarDialog({ movId, open, onClose, onSaved }: { movId: string; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!motivo.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/movimientos/${movId}/reversar`, { method: 'POST', body: { motivo: motivo.trim() } });
      toast.success('Movimiento reversado');
      onSaved();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Reversar movimiento</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Se creará un movimiento espejo que revierte los saldos.</p>
          <div>
            <Label>Motivo</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={!motivo.trim() || saving}>Reversar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
