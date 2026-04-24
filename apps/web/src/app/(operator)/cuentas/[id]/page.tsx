'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@/lib/hooks';
import { formatMoney, formatDate } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { label, movimientoTipoLabels } from '@/lib/labels';

type Cuenta = {
  id: string;
  name: string;
  identifier: string | null;
  notes: string | null;
  saldoArs: string;
  saldoUsd: string;
  isActive: boolean;
  createdAt: string;
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
  sociedad: { name: string } | null;
};

export default function CuentaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: cuenta } = useQuery<Cuenta>(`/cuentas/${id}`);
  const { data: movs } = useQuery<Movimiento[]>(`/cuentas/${id}/movimientos`);

  if (!cuenta) return <div className="text-muted-foreground">Cargando…</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={cuenta.name}
        description={cuenta.identifier ? `Identificador: ${cuenta.identifier}` : 'Sin identificador'}
        actions={cuenta.isActive ? <Badge variant="outline">Activa</Badge> : <Badge variant="secondary">Inactiva</Badge>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Saldo ARS</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-semibold ${Number(cuenta.saldoArs) < 0 ? 'text-red-600' : ''}`}>
              {formatMoney(cuenta.saldoArs, 'ARS')}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Saldo USD</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-semibold ${Number(cuenta.saldoUsd) < 0 ? 'text-red-600' : ''}`}>
              {formatMoney(cuenta.saldoUsd, 'USD')}
            </div>
          </CardContent>
        </Card>
      </div>

      {cuenta.notes && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Notas</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{cuenta.notes}</p></CardContent>
        </Card>
      )}

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
