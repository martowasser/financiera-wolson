'use client';

import { useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation } from '@/lib/hooks';
import { formatApiError } from '@/lib/api-errors';
import { formatMoney, formatDate, inputToCentavos } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { label, alquilerStatusLabels } from '@/lib/labels';

type Alquiler = {
  id: string;
  numero: number;
  monto: string;
  moneda: 'ARS' | 'USD';
  status: 'ACTIVO' | 'FINALIZADO';
  fechaInicio: string;
  fechaFin: string | null;
  finalizadoEn: string | null;
  propiedad: { id: string; nombre: string; direccion: string; sociedad: { name: string } };
  inquilino: { id: string; name: string };
};

type Propiedad = { id: string; nombre: string; direccion: string };
type Cuenta = { id: string; name: string; identifier: string | null };

export default function AlquileresPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const newOpen = searchParams.get('new') === '1';
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | 'ACTIVO' | 'FINALIZADO'>('ACTIVO');

  const params = useMemo(() => {
    const p: Record<string, string | undefined> = {};
    if (q) p.q = q;
    if (status) p.status = status;
    return p;
  }, [q, status]);

  const { data: alquileres, isLoading, refetch } = useQuery<Alquiler[]>('/alquileres', params);

  const closeDialog = () => router.replace('/alquileres');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alquileres"
        description="Alquileres vigentes y finalizados"
        actions={
          <Link href="/alquileres?new=1">
            <Button size="sm"><Plus className="h-4 w-4" /> Nuevo alquiler</Button>
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por inquilino o propiedad..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Todos</option>
          <option value="ACTIVO">Activos</option>
          <option value="FINALIZADO">Finalizados</option>
        </select>
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">#</th>
              <th className="px-3 py-2 text-left font-medium">Propiedad</th>
              <th className="px-3 py-2 text-left font-medium">Inquilino</th>
              <th className="px-3 py-2 text-right font-medium">Monto</th>
              <th className="px-3 py-2 text-center font-medium">Estado</th>
              <th className="px-3 py-2 text-left font-medium">Inicio</th>
              <th className="px-3 py-2 text-left font-medium">Fin</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-3 py-4 text-muted-foreground">Cargando…</td></tr>}
            {alquileres && alquileres.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-4 text-muted-foreground">Sin alquileres.</td></tr>
            )}
            {(alquileres ?? []).map((c) => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2">
                  <Link href={`/alquileres/${c.id}`} className="font-mono text-xs hover:underline">#{c.numero}</Link>
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">{c.propiedad.nombre}</div>
                  <div className="text-xs text-muted-foreground">{c.propiedad.direccion}</div>
                </td>
                <td className="px-3 py-2">{c.inquilino.name}</td>
                <td className="px-3 py-2 text-right font-medium">{formatMoney(c.monto, c.moneda)}</td>
                <td className="px-3 py-2 text-center">
                  {c.status === 'ACTIVO'
                    ? <Badge variant="outline">{label(alquilerStatusLabels, c.status)}</Badge>
                    : <Badge variant="secondary">{label(alquilerStatusLabels, c.status)}</Badge>}
                </td>
                <td className="px-3 py-2">{formatDate(c.fechaInicio)}</td>
                <td className="px-3 py-2">
                  {c.finalizadoEn ? <span className="text-muted-foreground">Fin. {formatDate(c.finalizadoEn)}</span>
                    : c.fechaFin ? formatDate(c.fechaFin)
                    : <span className="text-muted-foreground">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlquilerNewDialog open={newOpen} onClose={closeDialog} onSaved={() => { refetch(); closeDialog(); }} />
    </div>
  );
}

function AlquilerNewDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { data: propiedades } = useQuery<Propiedad[]>(open ? '/propiedades' : null, { active: 'true' });
  const { data: cuentas } = useQuery<Cuenta[]>(open ? '/cuentas' : null, { active: 'true' });
  const [propiedadId, setPropiedadId] = useState('');
  const [inquilinoId, setInquilinoId] = useState('');
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>('ARS');
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().slice(0, 10));
  const [fechaFin, setFechaFin] = useState('');
  const [notes, setNotes] = useState('');
  const { mutate, isLoading } = useMutation<Record<string, unknown>, { numero: number }>('/alquileres');

  async function submit() {
    if (!propiedadId || !inquilinoId || !monto || !fechaInicio) return;
    try {
      const res = await mutate({
        propiedadId,
        inquilinoId,
        monto: inputToCentavos(monto),
        moneda,
        fechaInicio,
        fechaFin: fechaFin || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success(`Alquiler #${res.numero} creado`);
      setPropiedadId(''); setInquilinoId(''); setMonto(''); setFechaFin(''); setNotes('');
      onSaved();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nuevo alquiler</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Propiedad</Label>
            <select value={propiedadId} onChange={(e) => setPropiedadId(e.target.value)}
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">Seleccionar...</option>
              {(propiedades ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.nombre} · {p.direccion}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Inquilino (cuenta)</Label>
            <select value={inquilinoId} onChange={(e) => setInquilinoId(e.target.value)}
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">Seleccionar...</option>
              {(cuentas ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.identifier ? ` (${c.identifier})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label>Monto</Label>
              <Input type="number" step="0.01" min="0" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="100000.00" />
            </div>
            <div>
              <Label>Moneda</Label>
              <select value={moneda} onChange={(e) => setMoneda(e.target.value as 'ARS' | 'USD')}
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm">
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Inicio</Label>
              <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </div>
            <div>
              <Label>Fin (planificado)</Label>
              <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <p className="text-xs text-muted-foreground">Los socios se precargan con los de la sociedad; podés ajustarlos después.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={isLoading || !propiedadId || !inquilinoId || !monto || !fechaInicio}>Crear</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
