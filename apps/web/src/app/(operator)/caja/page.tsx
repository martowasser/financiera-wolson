'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@/lib/hooks';
import { apiFetch } from '@/lib/api';
import { formatApiError } from '@/lib/api-errors';
import { formatMoney, formatDate, formatDateLong, formatDateTime } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, CalendarCheck } from 'lucide-react';
import { toast } from 'sonner';
import { label, movimientoTipoLabels, cajaStatusLabels } from '@/lib/labels';
import { CajaCerradaBanner } from '@/components/caja-cerrada-banner';

type Caja = {
  id: string;
  fecha: string;
  status: 'OPEN' | 'CLOSED';
  saldoInicialArs: string;
  saldoInicialUsd: string;
  saldoFinalArs: string | null;
  saldoFinalUsd: string | null;
  currentSaldoArs?: string;
  currentSaldoUsd?: string;
  cerradoEn: string | null;
  cerradoPor?: { name: string } | null;
  _count?: { movimientos: number };
};

type Movimiento = {
  id: string;
  numero: number;
  tipo: string;
  monto: string;
  moneda: string;
  notes: string | null;
  origenBucket: string | null;
  destinoBucket: string | null;
  bancoOrigen: { nombre: string } | null;
  bancoDestino: { nombre: string } | null;
  cuentaOrigen: { name: string } | null;
  cuentaDestino: { name: string } | null;
};

export default function CajaPage() {
  const { data: today, refetch: refetchToday } = useQuery<Caja>('/caja/today');
  const { data: recent, refetch: refetchRecent } = useQuery<Caja[]>('/caja');
  const todayFecha = today?.fecha.slice(0, 10);
  const { data: movs } = useQuery<Movimiento[]>(todayFecha ? '/movimientos' : null, todayFecha ? { fecha: todayFecha, limit: 200 } : undefined);
  const [cerrarOpen, setCerrarOpen] = useState(false);

  return (
    <div className="space-y-6">
      <CajaCerradaBanner />

      <PageHeader
        title="Caja"
        description={today ? formatDateLong(today.fecha) : '—'}
        actions={
          <>
            <Link href="/movimientos?new=1" className={buttonVariants({ size: 'sm' })}>
              <Plus className="h-4 w-4" /> Cargar movimiento
            </Link>
            {today?.status === 'OPEN' && (
              <Button size="sm" variant="outline" onClick={() => setCerrarOpen(true)}>
                <CalendarCheck className="h-4 w-4" /> Cerrar caja
              </Button>
            )}
          </>
        }
      />

      {today && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Saldo actual</span>
              {today.status === 'OPEN'
                ? <Badge variant="outline">{label(cajaStatusLabels, today.status)}</Badge>
                : <Badge variant="secondary">{label(cajaStatusLabels, today.status)}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-xs text-muted-foreground">Pesos</div>
                <div className="text-3xl font-semibold">{formatMoney(today.currentSaldoArs ?? today.saldoInicialArs, 'ARS')}</div>
                <div className="text-xs text-muted-foreground mt-1">Inicio del día: {formatMoney(today.saldoInicialArs, 'ARS')}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Dólares</div>
                <div className="text-3xl font-semibold">{formatMoney(today.currentSaldoUsd ?? today.saldoInicialUsd, 'USD')}</div>
                <div className="text-xs text-muted-foreground mt-1">Inicio del día: {formatMoney(today.saldoInicialUsd, 'USD')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Movimientos del día</CardTitle></CardHeader>
        <CardContent>
          {movs && movs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin movimientos todavía.</p>
          ) : (
            <MovList movs={movs ?? []} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Días recientes</CardTitle></CardHeader>
        <CardContent>
          {recent && recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin historial.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left font-normal py-1">Fecha</th>
                  <th className="text-left font-normal py-1">Estado</th>
                  <th className="text-right font-normal py-1"># Movs</th>
                  <th className="text-left font-normal py-1">Cerrado</th>
                </tr>
              </thead>
              <tbody>
                {(recent ?? []).map((c) => {
                  const fechaIso = c.fecha.slice(0, 10);
                  return (
                    <tr key={c.id} className="border-t hover:bg-muted/30">
                      <td className="py-2">
                        <Link href={`/caja/${fechaIso}`} className="hover:underline">{formatDate(c.fecha)}</Link>
                      </td>
                      <td className="py-2">
                        {c.status === 'OPEN'
                          ? <Badge variant="outline">{label(cajaStatusLabels, c.status)}</Badge>
                          : <Badge variant="secondary">{label(cajaStatusLabels, c.status)}</Badge>}
                      </td>
                      <td className="py-2 text-right font-mono text-xs">{c._count?.movimientos ?? 0}</td>
                      <td className="py-2 text-muted-foreground">
                        {c.cerradoEn ? `${formatDateTime(c.cerradoEn)}${c.cerradoPor?.name ? ' · ' + c.cerradoPor.name : ''}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {today && (
        <CerrarDialog
          caja={today}
          open={cerrarOpen}
          onClose={() => setCerrarOpen(false)}
          onSaved={() => { setCerrarOpen(false); refetchToday(); refetchRecent(); }}
        />
      )}
    </div>
  );
}

function MovList({ movs }: { movs: Movimiento[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-muted-foreground">
        <tr>
          <th className="text-left font-normal py-1">#</th>
          <th className="text-left font-normal py-1">Tipo</th>
          <th className="text-left font-normal py-1">Origen → Destino</th>
          <th className="text-right font-normal py-1">Monto</th>
        </tr>
      </thead>
      <tbody>
        {movs.map((m) => {
          const origen = m.bancoOrigen?.nombre ?? m.cuentaOrigen?.name ?? (m.origenBucket === 'CAJA' ? 'Caja' : '—');
          const destino = m.bancoDestino?.nombre ?? m.cuentaDestino?.name ?? (m.destinoBucket === 'CAJA' ? 'Caja' : '—');
          return (
            <tr key={m.id} className="border-t hover:bg-muted/30">
              <td className="py-2 font-mono text-xs">
                <Link href={`/movimientos?id=${m.id}`} className="hover:underline">#{m.numero}</Link>
              </td>
              <td className="py-2">{label(movimientoTipoLabels, m.tipo)}</td>
              <td className="py-2 text-muted-foreground">{origen} → {destino}</td>
              <td className="py-2 text-right font-medium">{formatMoney(m.monto, m.moneda)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CerrarDialog({ caja, open, onClose, onSaved }: { caja: Caja; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      await apiFetch(`/caja/${caja.id}/cerrar`, { method: 'POST', body: { notes: notes.trim() || undefined } });
      toast.success('Caja cerrada');
      onSaved();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Cerrar caja del día</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Se calcularán los saldos finales y se abrirá la caja del próximo día con esos valores como saldo inicial.
          </p>
          <div>
            <Label>Notas del cierre</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>Cerrar definitivamente</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
