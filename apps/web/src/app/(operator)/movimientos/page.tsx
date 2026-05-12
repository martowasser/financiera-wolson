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
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { label, movimientoTipoLabels } from '@/lib/labels';
import { NewMovimientoForm } from './new-movimiento-form';
import { MovimientosPanel, legibleSide, type PanelMov } from '@/components/movimientos-panel';

type Mov = PanelMov;

export default function MovimientosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const newOpen = searchParams.get('new') === '1';
  const selectedId = searchParams.get('id');

  // Refresh tick para forzar refetch del panel después de crear/reversar un mov.
  const [refreshTick, setRefreshTick] = useState(0);

  const { data: selected, refetch: refetchSelected } = useQuery<Mov & { createdAt: string; createdBy: { name: string }; reversoDeId: string | null }>(
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
        <SheetContent className="w-full max-w-lg sm:max-w-xl">
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
