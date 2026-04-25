'use client';

import { use, useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@/lib/hooks';
import { formatApiError } from '@/lib/api-errors';
import { formatMoney, formatDate } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { label, movimientoTipoLabels } from '@/lib/labels';

type Cuenta = { id: string; name: string; identifier: string | null };

type Sociedad = {
  id: string;
  name: string;
  notes: string | null;
  isActive: boolean;
  banco: { id: string; nombre: string; numero: string; saldoArs: string; saldoUsd: string; isActive: boolean } | null;
  socios: Array<{ cuentaId: string; percentBps: number; cuenta: { id: string; name: string } }>;
  propiedades: Array<{ id: string; nombre: string; direccion: string }>;
};

type Movimiento = {
  id: string;
  numero: number;
  fecha: string;
  tipo: string;
  monto: string;
  moneda: string;
  notes: string | null;
  bancoOrigen: { nombre: string } | null;
  bancoDestino: { nombre: string } | null;
  cuentaOrigen: { name: string } | null;
  cuentaDestino: { name: string } | null;
};

export default function SociedadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: sociedad, refetch } = useQuery<Sociedad>(`/sociedades/${id}`);
  const { data: movs } = useQuery<Movimiento[]>('/movimientos', { sociedadId: id, limit: 50 });
  const { data: cuentas } = useQuery<Cuenta[]>('/cuentas', { active: 'true' });

  if (!sociedad) return <div className="text-muted-foreground">Cargando…</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={sociedad.name}
        description={sociedad.notes ?? undefined}
        actions={
          sociedad.isActive
            ? <Badge variant="outline">Activa</Badge>
            : <Badge variant="secondary">Inactiva</Badge>
        }
      />

      <BancoSection sociedad={sociedad} onChange={refetch} />

      <SociosSection sociedad={sociedad} cuentas={cuentas ?? []} onChange={refetch} />

      <Card>
        <CardHeader><CardTitle>Propiedades ({sociedad.propiedades.length})</CardTitle></CardHeader>
        <CardContent>
          {sociedad.propiedades.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin propiedades cargadas.</p>
          ) : (
            <ul className="space-y-1">
              {sociedad.propiedades.map((p) => (
                <li key={p.id}>
                  <Link href={`/propiedades/${p.id}`} className="text-sm hover:underline">
                    <span className="font-medium">{p.nombre}</span> <span className="text-muted-foreground">· {p.direccion}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Movimientos</CardTitle></CardHeader>
        <CardContent>
          {movs && movs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin movimientos.</p>
          ) : (
            <MovTable movs={movs ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BancoSection({ sociedad, onChange }: { sociedad: Sociedad; onChange: () => void }) {
  const [creating, setCreating] = useState(false);
  const [nombre, setNombre] = useState('');
  const [numero, setNumero] = useState('');
  const createBanco = useMutation<Record<string, string>, unknown>('/bancos');

  async function save() {
    if (!nombre.trim() || !numero.trim()) return;
    try {
      await createBanco.mutate({ sociedadId: sociedad.id, nombre: nombre.trim(), numero: numero.trim() });
      toast.success('Banco creado');
      setNombre(''); setNumero(''); setCreating(false);
      onChange();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  }

  if (!sociedad.banco) {
    return (
      <Card>
        <CardHeader><CardTitle>Banco</CardTitle></CardHeader>
        <CardContent>
          {creating ? (
            <div className="flex items-end gap-2">
              <div>
                <Label>Nombre</Label>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Banco Nación" />
              </div>
              <div>
                <Label>Número</Label>
                <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ej: 042" />
              </div>
              <Button onClick={save} disabled={createBanco.isLoading}>Crear</Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
            </div>
          ) : (
            <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Crear banco</Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Banco {sociedad.banco.numero} — {sociedad.banco.nombre}</span>
          {sociedad.banco.isActive
            ? <Badge variant="outline">Activo</Badge>
            : <Badge variant="secondary">Cerrado</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Saldo ARS</div>
            <div className={`text-xl font-semibold ${Number(sociedad.banco.saldoArs) < 0 ? 'text-red-600' : ''}`}>
              {formatMoney(sociedad.banco.saldoArs, 'ARS')}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Saldo USD</div>
            <div className={`text-xl font-semibold ${Number(sociedad.banco.saldoUsd) < 0 ? 'text-red-600' : ''}`}>
              {formatMoney(sociedad.banco.saldoUsd, 'USD')}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type SocioRow = { cuentaId: string; percent: string };

function SociosSection({ sociedad, cuentas, onChange }: { sociedad: Sociedad; cuentas: Cuenta[]; onChange: () => void }) {
  const [rows, setRows] = useState<SocioRow[]>([]);
  const save = useMutation<{ socios: Array<{ cuentaId: string; percentBps: number }> }, unknown>(
    `/sociedades/${sociedad.id}/socios`,
  );

  useEffect(() => {
    setRows(sociedad.socios.map((s) => ({ cuentaId: s.cuentaId, percent: (s.percentBps / 100).toFixed(2) })));
  }, [sociedad.socios]);

  const sumBps = useMemo(() => {
    return rows.reduce((acc, s) => {
      const n = parseFloat(s.percent);
      return Number.isNaN(n) ? acc : acc + Math.round(n * 100);
    }, 0);
  }, [rows]);

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
          <span>Socios</span>
          <Button size="sm" variant="ghost" onClick={() => setRows((r) => [...r, { cuentaId: '', percent: '' }])}>
            <Plus className="h-4 w-4" /> Agregar
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rows.length === 0 && <p className="text-sm text-muted-foreground">Sin socios.</p>}
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
                type="number" step="0.01" min="0" max="100" placeholder="%"
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

function MovTable({ movs }: { movs: Movimiento[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-muted-foreground">
        <tr>
          <th className="text-left font-normal py-1">#</th>
          <th className="text-left font-normal py-1">Fecha</th>
          <th className="text-left font-normal py-1">Tipo</th>
          <th className="text-left font-normal py-1">Origen → Destino</th>
          <th className="text-right font-normal py-1">Monto</th>
        </tr>
      </thead>
      <tbody>
        {movs.map((m) => {
          const origen = m.bancoOrigen?.nombre ?? m.cuentaOrigen?.name ?? '—';
          const destino = m.bancoDestino?.nombre ?? m.cuentaDestino?.name ?? '—';
          return (
            <tr key={m.id} className="border-t hover:bg-muted/30">
              <td className="py-2 font-mono text-xs">#{m.numero}</td>
              <td className="py-2">{formatDate(m.fecha)}</td>
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
