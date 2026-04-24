'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@/lib/hooks';
import { formatMoney, formatDate } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { label, movimientoTipoLabels, contratoStatusLabels } from '@/lib/labels';

type Propiedad = {
  id: string;
  nombre: string;
  direccion: string;
  descripcion: string | null;
  notes: string | null;
  isActive: boolean;
  sociedad: { id: string; name: string };
  contratos: Array<{
    id: string;
    numero: number;
    status: 'ACTIVO' | 'FINALIZADO';
    fechaInicio: string;
    fechaFin: string | null;
    finalizadoEn: string | null;
    inquilino: { id: string; name: string };
  }>;
};

type Movimiento = {
  id: string;
  numero: number;
  fecha: string;
  tipo: string;
  monto: string;
  moneda: string;
  bancoOrigen: { nombre: string } | null;
  bancoDestino: { nombre: string } | null;
  cuentaOrigen: { name: string } | null;
  cuentaDestino: { name: string } | null;
};

export default function PropiedadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: p } = useQuery<Propiedad>(`/propiedades/${id}`);
  const { data: movs } = useQuery<Movimiento[]>('/movimientos', { propiedadId: id, limit: 50 });

  if (!p) return <div className="text-muted-foreground">Cargando…</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={p.nombre}
        description={p.direccion}
        actions={p.isActive ? <Badge variant="outline">Activa</Badge> : <Badge variant="secondary">Inactiva</Badge>}
      />

      <Card>
        <CardHeader><CardTitle className="text-sm">Datos</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="text-muted-foreground">Sociedad:</span> <Link href={`/sociedades/${p.sociedad.id}`} className="hover:underline">{p.sociedad.name}</Link></div>
          {p.descripcion && <div><span className="text-muted-foreground">Descripción:</span> {p.descripcion}</div>}
          {p.notes && <div className="whitespace-pre-wrap text-muted-foreground">{p.notes}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Contratos ({p.contratos.length})</CardTitle></CardHeader>
        <CardContent>
          {p.contratos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin contratos.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left font-normal py-1">#</th>
                  <th className="text-left font-normal py-1">Inquilino</th>
                  <th className="text-left font-normal py-1">Estado</th>
                  <th className="text-left font-normal py-1">Inicio</th>
                  <th className="text-left font-normal py-1">Fin</th>
                </tr>
              </thead>
              <tbody>
                {p.contratos.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-muted/30">
                    <td className="py-2">
                      <Link href={`/contratos/${c.id}`} className="font-mono text-xs hover:underline">#{c.numero}</Link>
                    </td>
                    <td className="py-2">{c.inquilino.name}</td>
                    <td className="py-2">
                      {c.status === 'ACTIVO'
                        ? <Badge variant="outline">{label(contratoStatusLabels, c.status)}</Badge>
                        : <Badge variant="secondary">{label(contratoStatusLabels, c.status)}</Badge>}
                    </td>
                    <td className="py-2">{formatDate(c.fechaInicio)}</td>
                    <td className="py-2">
                      {c.finalizadoEn
                        ? <span className="text-muted-foreground">Finalizado {formatDate(c.finalizadoEn)}</span>
                        : c.fechaFin ? formatDate(c.fechaFin) : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Movimientos</CardTitle></CardHeader>
        <CardContent>
          {movs && movs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin movimientos.</p>
          ) : (
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
                {(movs ?? []).map((m) => {
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
