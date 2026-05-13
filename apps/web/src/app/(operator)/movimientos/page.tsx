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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { label, movimientoTipoLabels } from '@/lib/labels';
import { NewMovimientoForm, type EditInitialValues } from './new-movimiento-form';
import { MovimientosPanel, legibleSide, type PanelMov } from '@/components/movimientos-panel';

type Mov = PanelMov;

// Forma cruda devuelta por GET /movimientos/:id. Incluye los FKs escalares
// y los IDs internos (origenBancoId, destinoCuentaId, etc.) que necesita el
// form de edición.
type DetailMov = Mov & {
  createdAt: string;
  createdBy: { name: string };
  reversoDeId: string | null;
  derivadoDeId: string | null;
  origenBancoId: string | null;
  origenCuentaId: string | null;
  destinoBancoId: string | null;
  destinoCuentaId: string | null;
  sociedadId: string | null;
  propiedadId: string | null;
  alquilerId: string | null;
  cuentaContraparteId: string | null;
};

export default function MovimientosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const newOpen = searchParams.get('new') === '1';
  const selectedId = searchParams.get('id');

  // Refresh tick para forzar refetch del panel después de crear/reversar un mov.
  const [refreshTick, setRefreshTick] = useState(0);

  const { data: selected, refetch: refetchSelected } = useQuery<DetailMov>(
    selectedId ? `/movimientos/${selectedId}` : null,
  );

  const closeNew = () => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete('new');
    const qs = sp.toString();
    router.replace(qs ? `/movimientos?${qs}` : '/movimientos');
  };
  const closeDetail = () => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete('id');
    const qs = sp.toString();
    router.replace(qs ? `/movimientos?${qs}` : '/movimientos');
  };

  function openDetail(m: Mov) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set('id', m.id);
    router.replace(`/movimientos?${sp.toString()}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Movimientos"
        description="Flujo de plata entre cajas, bancos y cuentas"
        actions={
          <Link href="/movimientos?new=1"><Button size="sm"><Plus className="h-4 w-4" /> Nuevo movimiento</Button></Link>
        }
      />

      <MovimientosPanel
        key={refreshTick}
        onRowClick={openDetail}
      />

      <Dialog open={newOpen} onOpenChange={(v) => { if (!v) closeNew(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nuevo movimiento</DialogTitle></DialogHeader>
          {newOpen && (
            <NewMovimientoForm
              onCancel={closeNew}
              onSaved={() => { setRefreshTick((t) => t + 1); closeNew(); }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Sheet open={!!selectedId} onOpenChange={(v) => { if (!v) closeDetail(); }}>
        <SheetContent className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{selected ? `Movimiento #${selected.numero}` : 'Cargando…'}</SheetTitle>
          </SheetHeader>
          {selected && (
            <DetailView mov={selected} onChange={() => { refetchSelected(); setRefreshTick((t) => t + 1); }} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailView({ mov, onChange }: {
  mov: DetailMov;
  onChange: () => void;
}) {
  const [notes, setNotes] = useState(mov.notes ?? '');
  const [comprobante, setComprobante] = useState(mov.comprobante ?? '');
  const [facturado, setFacturado] = useState(mov.facturado);
  const [savingEdit, setSavingEdit] = useState(false);
  const [reversarOpen, setReversarOpen] = useState(false);
  const [editFullOpen, setEditFullOpen] = useState(false);

  // Edición completa solo permitida si no es derivado, ni reverso, ni
  // movimiento ya reversado (chequeado server-side; UI esconde el botón
  // para coincidir).
  const editable = !mov.derivadoDeId && mov.tipo !== 'REPARTO_SOCIO' && !mov.reversoDeId;

  const initialValues: EditInitialValues = {
    id: mov.id,
    tipo: mov.tipo,
    fecha: mov.fecha,
    monto: mov.monto,
    moneda: mov.moneda as 'ARS' | 'USD',
    origenBucket:  (mov.origenBucket  as 'CAJA' | 'BANCO' | 'CUENTA_CORRIENTE' | null) ?? null,
    origenBancoId:  mov.origenBancoId,
    origenCuentaId: mov.origenCuentaId,
    destinoBucket: (mov.destinoBucket as 'CAJA' | 'BANCO' | 'CUENTA_CORRIENTE' | null) ?? null,
    destinoBancoId:  mov.destinoBancoId,
    destinoCuentaId: mov.destinoCuentaId,
    sociedadId: mov.sociedadId,
    propiedadId: mov.propiedadId,
    alquilerId: mov.alquilerId,
    cuentaContraparteId: mov.cuentaContraparteId,
    comprobante: mov.comprobante,
    facturado: mov.facturado,
    notes: mov.notes,
  };

  const dirty = (notes.trim() || '') !== (mov.notes ?? '')
    || (comprobante.trim() || '') !== (mov.comprobante ?? '')
    || facturado !== mov.facturado;

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

  const ctxItems: Array<{ label: string; value: React.ReactNode }> = [];
  if (mov.sociedad) ctxItems.push({ label: 'Sociedad', value: <Link href={`/sociedades/${mov.sociedad.id}`} className="hover:underline">{mov.sociedad.name}</Link> });
  if (mov.propiedad) ctxItems.push({ label: 'Propiedad', value: <Link href={`/propiedades/${mov.propiedad.id}`} className="hover:underline">{mov.propiedad.nombre}</Link> });
  if (mov.alquiler) ctxItems.push({ label: 'Alquiler', value: <Link href={`/alquileres/${mov.alquiler.id}`} className="hover:underline">#{mov.alquiler.numero}</Link> });
  if (mov.cuentaContraparte) ctxItems.push({ label: 'Contraparte', value: <Link href={`/cuentas/${mov.cuentaContraparte.id}`} className="hover:underline">{mov.cuentaContraparte.name}</Link> });

  return (
    <div className="space-y-5 mt-4 px-1">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-3xl font-semibold leading-none">{formatMoney(mov.monto, mov.moneda)}</div>
          <div className="mt-1 text-xs text-muted-foreground">{mov.moneda}</div>
        </div>
        <div className="text-right text-sm">
          <div className="font-medium">{formatDate(mov.fecha)}</div>
        </div>
      </div>

      <div className="space-y-2">
        <Badge variant="outline" className="text-sm">{label(movimientoTipoLabels, mov.tipo)}</Badge>
        <div className="flex items-center gap-2 text-sm">
          <span>{legibleSide(mov, 'origen')}</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>{legibleSide(mov, 'destino')}</span>
        </div>
      </div>

      {ctxItems.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {ctxItems.map((it) => (
            <div key={it.label} className="rounded-md border p-2.5">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{it.label}</div>
              <div className="text-sm mt-0.5">{it.value}</div>
            </div>
          ))}
        </div>
      )}

      <details className="rounded-md border" open={dirty}>
        <summary className="cursor-pointer select-none px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
          Edición rápida
        </summary>
        <div className="space-y-3 px-3 pb-3">
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
          <Button size="sm" onClick={saveEdit} disabled={savingEdit || !dirty}>Guardar cambios</Button>
        </div>
      </details>

      <div className="flex flex-wrap gap-2 pt-1">
        {editable && (
          <Button variant="outline" size="sm" onClick={() => setEditFullOpen(true)}>
            <Pencil className="h-4 w-4" /> Editar movimiento
          </Button>
        )}
        {!mov.reversoDeId && (
          <Button variant="outline" size="sm" onClick={() => setReversarOpen(true)}>Reversar movimiento</Button>
        )}
      </div>

      <div className="border-t pt-3 text-xs text-muted-foreground">
        Creado {formatDateTime(mov.createdAt)} por {mov.createdBy.name}.
        {mov.reversoDeId && <span> · Este movimiento es un reverso.</span>}
      </div>

      <ReversarDialog
        movId={mov.id}
        open={reversarOpen}
        onClose={() => setReversarOpen(false)}
        onSaved={() => { setReversarOpen(false); onChange(); }}
      />

      <Dialog open={editFullOpen} onOpenChange={setEditFullOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Editar movimiento #{mov.numero}</DialogTitle></DialogHeader>
          {editFullOpen && (
            <>
              <div className="rounded-md border border-yellow-400 bg-yellow-50 px-3 py-2 text-xs text-yellow-900">
                Editar este movimiento recalculará el reparto a socios y los saldos. La acción se aplica al instante.
              </div>
              <NewMovimientoForm
                initialValues={initialValues}
                onCancel={() => setEditFullOpen(false)}
                onSaved={() => { setEditFullOpen(false); onChange(); }}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
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
