'use client';

import { use, useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@/lib/hooks';
import { apiFetch } from '@/lib/api';
import { formatApiError } from '@/lib/api-errors';
import { formatMoney, formatDate } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { label, alquilerStatusLabels } from '@/lib/labels';
import { MovimientosPanel } from '@/components/movimientos-panel';

type Cuenta = { id: string; name: string; identifier: string | null };

type Alquiler = {
  id: string;
  numero: number;
  monto: string;
  moneda: 'ARS' | 'USD';
  status: 'ACTIVO' | 'FINALIZADO';
  fechaInicio: string;
  fechaFin: string | null;
  finalizadoEn: string | null;
  motivoFinalizacion: string | null;
  notes: string | null;
  propiedad: { id: string; nombre: string; direccion: string; sociedad: { id: string; name: string } };
  inquilino: { id: string; name: string };
  socios: Array<{ cuentaId: string; percentBps: number; cuenta: { id: string; name: string } }>;
};

export default function AlquilerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { data: c, refetch } = useQuery<Alquiler>(`/alquileres/${id}`);
  const { data: cuentas } = useQuery<Cuenta[]>('/cuentas', { active: 'true' });
  const [finDialogOpen, setFinDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  async function archive() {
    setArchiving(true);
    try {
      await apiFetch(`/alquileres/${id}`, { method: 'DELETE' });
      toast.success('Alquiler archivado');
      router.push('/alquileres');
    } catch (e) {
      toast.error(formatApiError(e));
      setArchiving(false);
    }
  }

  if (!c) return <div className="text-muted-foreground">Cargando…</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Alquiler #${c.numero}`}
        description={`${c.propiedad.nombre} · ${c.inquilino.name}`}
        actions={
          c.status === 'ACTIVO'
            ? <Badge variant="outline">{label(alquilerStatusLabels, c.status)}</Badge>
            : <Badge variant="secondary">{label(alquilerStatusLabels, c.status)}</Badge>
        }
      />

      {c.status === 'FINALIZADO' && c.finalizadoEn && (
        <div className="rounded-md border border-yellow-400 bg-yellow-50 px-4 py-3 text-sm">
          <p className="font-medium text-yellow-900">Finalizado el {formatDate(c.finalizadoEn)}</p>
          {c.motivoFinalizacion && <p className="text-yellow-800 mt-1">Motivo: {c.motivoFinalizacion}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">Datos</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setEditDialogOpen(true)}>
              <Pencil className="h-4 w-4" /> Editar
            </Button>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div><span className="text-muted-foreground">Monto:</span> {formatMoney(c.monto, c.moneda)}</div>
            <div><span className="text-muted-foreground">Inicio:</span> {formatDate(c.fechaInicio)}</div>
            {c.fechaFin && <div><span className="text-muted-foreground">Fin planificado:</span> {formatDate(c.fechaFin)}</div>}
            {c.notes && <div className="text-muted-foreground whitespace-pre-wrap">{c.notes}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Enlaces</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div><span className="text-muted-foreground">Propiedad:</span> <Link href={`/propiedades/${c.propiedad.id}`} className="hover:underline">{c.propiedad.nombre}</Link></div>
            <div><span className="text-muted-foreground">Sociedad:</span> <Link href={`/sociedades/${c.propiedad.sociedad.id}`} className="hover:underline">{c.propiedad.sociedad.name}</Link></div>
            <div><span className="text-muted-foreground">Inquilino:</span> <Link href={`/cuentas/${c.inquilino.id}`} className="hover:underline">{c.inquilino.name}</Link></div>
          </CardContent>
        </Card>
      </div>

      <SociosSection alquiler={c} cuentas={cuentas ?? []} onChange={refetch} />

      <div className="flex flex-wrap gap-2">
        {c.status === 'ACTIVO' && (
          <Button variant="outline" onClick={() => setFinDialogOpen(true)}>Finalizar alquiler</Button>
        )}
        <Button variant="destructive" onClick={() => setArchiveOpen(true)}>Archivar</Button>
      </div>

      <FinalizarDialog alquilerId={c.id} open={finDialogOpen} onClose={() => setFinDialogOpen(false)} onSaved={() => { setFinDialogOpen(false); refetch(); }} />

      <EditarDialog alquiler={c} open={editDialogOpen} onClose={() => setEditDialogOpen(false)} onSaved={() => { setEditDialogOpen(false); refetch(); }} />

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archivar alquiler</AlertDialogTitle>
            <AlertDialogDescription>
              Va a dejar de aparecer en los listados y en los pickers. La
              historia que lo referencia se conserva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={archive} disabled={archiving}>
              {archiving ? 'Archivando…' : 'Archivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MovimientosPanel
        scope={{ alquilerId: c.id }}
        filenameHint={`alquiler-${c.numero}`}
      />
    </div>
  );
}

type SocioRow = { cuentaId: string; percent: string };

function SociosSection({ alquiler, cuentas, onChange }: { alquiler: Alquiler; cuentas: Cuenta[]; onChange: () => void }) {
  const [rows, setRows] = useState<SocioRow[]>([]);
  const save = useMutation<{ socios: Array<{ cuentaId: string; percentBps: number }> }, unknown>(
    `/alquileres/${alquiler.id}/socios`,
  );

  useEffect(() => {
    setRows(alquiler.socios.map((s) => ({ cuentaId: s.cuentaId, percent: (s.percentBps / 100).toFixed(2) })));
  }, [alquiler.socios]);

  const sumBps = useMemo(() =>
    rows.reduce((acc, s) => {
      const n = parseFloat(s.percent);
      return Number.isNaN(n) ? acc : acc + Math.round(n * 100);
    }, 0), [rows]);

  const valid = sumBps === 10000 && rows.every((r) => r.cuentaId && r.percent.trim() !== '');

  async function submit() {
    try {
      await save.mutate({
        socios: rows.map((r) => ({ cuentaId: r.cuentaId, percentBps: Math.round(parseFloat(r.percent) * 100) })),
      });
      toast.success('Socios actualizados');
      onChange();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Socios del alquiler</span>
          <Button size="sm" variant="ghost" onClick={() => setRows((r) => [...r, { cuentaId: '', percent: '' }])}>
            <Plus className="h-4 w-4" /> Agregar
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rows.map((r, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <select
                value={r.cuentaId}
                onChange={(e) => setRows((rs) => rs.map((x, i) => i === idx ? { ...x, cuentaId: e.target.value } : x))}
                className="flex-1 rounded-md border bg-transparent px-2 py-1.5 text-sm"
              >
                <option value="">— Cuenta —</option>
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.identifier ? ` (${c.identifier})` : ''}</option>
                ))}
              </select>
              <Input
                type="number" step="0.01" min="0" max="100"
                value={r.percent}
                onChange={(e) => setRows((rs) => rs.map((x, i) => i === idx ? { ...x, percent: e.target.value } : x))}
                className="w-24"
              />
              <Button size="icon" variant="ghost" onClick={() => setRows((rs) => rs.filter((_, i) => i !== idx))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2">
            <span className={`text-xs ${sumBps === 10000 ? 'text-muted-foreground' : 'text-red-600'}`}>
              Suma: {(sumBps / 100).toFixed(2)}% {sumBps === 10000 ? '✓' : '(debe ser 100%)'}
            </span>
            <Button onClick={submit} disabled={!valid || save.isLoading}>Guardar socios</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EditarDialog({ alquiler, open, onClose, onSaved }: { alquiler: Alquiler; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>('ARS');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [notes, setNotes] = useState('');
  const save = useMutation<Record<string, unknown>, unknown>(`/alquileres/${alquiler.id}`, 'PUT');

  useEffect(() => {
    if (!open) return;
    setMonto(alquiler.monto);
    setMoneda(alquiler.moneda);
    setFechaInicio(alquiler.fechaInicio.slice(0, 10));
    setFechaFin(alquiler.fechaFin ? alquiler.fechaFin.slice(0, 10) : '');
    setNotes(alquiler.notes ?? '');
  }, [open, alquiler]);

  const montoValid = /^\d+$/.test(monto.trim());
  const canSave = montoValid && fechaInicio.trim() !== '';

  async function submit() {
    if (!canSave) return;
    try {
      await save.mutate({
        monto: monto.trim(),
        moneda,
        fechaInicio,
        fechaFin: fechaFin.trim() === '' ? null : fechaFin,
        notes: notes.trim() === '' ? null : notes,
      });
      toast.success('Alquiler actualizado');
      onSaved();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar alquiler</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div>
              <Label>Monto</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Moneda</Label>
              <select
                value={moneda}
                onChange={(e) => setMoneda(e.target.value as 'ARS' | 'USD')}
                className="h-9 rounded-md border bg-transparent px-2 text-sm"
              >
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <div>
            <Label>Fecha de inicio</Label>
            <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
          </div>
          <div>
            <Label>Fecha de fin planificado (opcional)</Label>
            <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={!canSave || save.isLoading}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FinalizarDialog({ alquilerId, open, onClose, onSaved }: { alquilerId: string; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState('');
  const save = useMutation<{ finalizadoEn: string; motivoFinalizacion: string }, unknown>(`/alquileres/${alquilerId}/finalizar`);

  async function submit() {
    if (!motivo.trim()) return;
    try {
      await save.mutate({ finalizadoEn: fecha, motivoFinalizacion: motivo.trim() });
      toast.success('Alquiler finalizado');
      onSaved();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Finalizar alquiler</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Fecha de finalización</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <Label>Motivo</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Ej: Inquilino dejó la propiedad" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={!motivo.trim() || save.isLoading}>Finalizar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
