'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@/lib/hooks';
import { formatMoney, formatDate, formatDateLong, formatDateTime } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { label, movimientoTipoLabels, cajaStatusLabels } from '@/lib/labels';
import { MovimientosPanel } from '@/components/movimientos-panel';

type Resumen = {
  caja: {
    id: string;
    fecha: string;
    status: 'OPEN' | 'CLOSED';
    saldoInicialArs: string;
    saldoInicialUsd: string;
    saldoFinalArs: string | null;
    saldoFinalUsd: string | null;
    currentSaldoArs: string;
    currentSaldoUsd: string;
    cerradoEn: string | null;
    cerradoPor: { id: string; name: string } | null;
    notes: string | null;
  };
  totalCount: number;
  totalesPorTipo: Record<string, { ingresoArs: string; ingresoUsd: string; egresoArs: string; egresoUsd: string }>;
};

export default function CajaHistoricoPage({ params }: { params: Promise<{ fecha: string }> }) {
  const { fecha } = use(params);
  const router = useRouter();
  const { data: resumen } = useQuery<Resumen>(`/reports/caja/${fecha}/resumen`);

  if (!resumen) return <div className="text-muted-foreground">Cargando…</div>;
  const c = resumen.caja;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Caja del ${formatDate(c.fecha)}`}
        description={formatDateLong(c.fecha)}
        actions={
          c.status === 'OPEN'
            ? <Badge variant="outline">{label(cajaStatusLabels, c.status)}</Badge>
            : <Badge variant="secondary">{label(cajaStatusLabels, c.status)}</Badge>
        }
      />

      <Card>
        <CardHeader><CardTitle>Resumen</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Saldo inicial</div>
              <div className="text-sm">{formatMoney(c.saldoInicialArs, 'ARS')}</div>
              <div className="text-sm">{formatMoney(c.saldoInicialUsd, 'USD')}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Saldo {c.status === 'CLOSED' ? 'final' : 'actual'}</div>
              <div className="text-sm font-semibold">{formatMoney(c.saldoFinalArs ?? c.currentSaldoArs, 'ARS')}</div>
              <div className="text-sm font-semibold">{formatMoney(c.saldoFinalUsd ?? c.currentSaldoUsd, 'USD')}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Movimientos</div>
              <div className="text-sm">{resumen.totalCount}</div>
              {c.cerradoEn && c.cerradoPor && (
                <div className="text-xs text-muted-foreground mt-1">
                  Cerrado {formatDateTime(c.cerradoEn)} · {c.cerradoPor.name}
                </div>
              )}
            </div>
          </div>

          {Object.keys(resumen.totalesPorTipo).length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="text-xs font-medium mb-2">Totales por tipo</div>
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="text-left font-normal">Tipo</th>
                    <th className="text-right font-normal">Ingreso ARS</th>
                    <th className="text-right font-normal">Ingreso USD</th>
                    <th className="text-right font-normal">Egreso ARS</th>
                    <th className="text-right font-normal">Egreso USD</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(resumen.totalesPorTipo).map(([tipo, t]) => (
                    <tr key={tipo} className="border-t">
                      <td className="py-1">{label(movimientoTipoLabels, tipo)}</td>
                      <td className="py-1 text-right">{formatMoney(t.ingresoArs, 'ARS')}</td>
                      <td className="py-1 text-right">{formatMoney(t.ingresoUsd, 'USD')}</td>
                      <td className="py-1 text-right">{formatMoney(t.egresoArs, 'ARS')}</td>
                      <td className="py-1 text-right">{formatMoney(t.egresoUsd, 'USD')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <MovimientosPanel
        scope={{ fecha }}
        filenameHint={`caja-${fecha}`}
        hideFilters={['from', 'to']}
        extracto={{ kind: 'caja', label: `caja-${fecha}` }}
        onRowClick={(m) => router.push(`/movimientos?id=${m.id}`)}
      />
    </div>
  );
}
