'use client';

import Link from 'next/link';
import { useQuery } from '@/lib/hooks';
import { formatMoney, formatDate } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, Building2, Plus, CalendarCheck } from 'lucide-react';
import { label, movimientoTipoLabels, estadoDelMesLabels } from '@/lib/labels';
import { CajaCerradaBanner } from '@/components/caja-cerrada-banner';

type CajaToday = {
  id: string;
  fecha: string;
  status: 'OPEN' | 'CLOSED';
  currentSaldoArs: string;
  currentSaldoUsd: string;
};

type Posicion = {
  sociedades: Array<{ id: string; name: string; banco: { saldoArs: string; saldoUsd: string } | null }>;
  caja: { saldoArs: string; saldoUsd: string };
};

type Movimiento = {
  id: string;
  numero: number;
  fecha: string;
  tipo: string;
  monto: string;
  moneda: string;
  notes: string | null;
};

type Alquiler = {
  id: string;
  numero: number;
  propiedad: { nombre: string };
  inquilino: { name: string };
  monto: string;
  moneda: string;
  estadoDelMes: 'AL_DIA' | 'SIN_FACTURAR' | 'PENDIENTE' | 'NO_APLICA';
};

export default function DashboardPage() {
  const { data: caja } = useQuery<CajaToday>('/caja/today');
  const { data: posicion } = useQuery<Posicion>('/reports/posicion');
  const today = new Date().toISOString().slice(0, 10);
  const { data: hoyMovs } = useQuery<Movimiento[]>('/movimientos', { fecha: today, limit: 10 });
  const { data: alquileres } = useQuery<Alquiler[]>('/reports/alquileres');

  const totalBancosArs = posicion
    ? posicion.sociedades.reduce((sum, s) => sum + (s.banco ? Number(s.banco.saldoArs) : 0), 0)
    : 0;
  const totalBancosUsd = posicion
    ? posicion.sociedades.reduce((sum, s) => sum + (s.banco ? Number(s.banco.saldoUsd) : 0), 0)
    : 0;

  const pendientes = (alquileres ?? []).filter((a) => a.estadoDelMes === 'PENDIENTE');

  return (
    <div className="space-y-6">
      <CajaCerradaBanner />

      <PageHeader
        title="Dashboard"
        description={`Hoy: ${formatDate(today)}`}
        actions={
          <>
            <Link href="/movimientos?new=1" className={buttonVariants({ size: 'sm' })}>
              <Plus className="h-4 w-4" /> Cargar movimiento
            </Link>
            <Link href="/caja" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <CalendarCheck className="h-4 w-4" /> Caja
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Caja ARS
            </CardTitle>
          </CardHeader>
          <CardContent>
            {caja ? (
              <div className="text-2xl font-semibold">{formatMoney(caja.currentSaldoArs, 'ARS')}</div>
            ) : (
              <Skeleton className="h-8 w-32" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Caja USD
            </CardTitle>
          </CardHeader>
          <CardContent>
            {caja ? (
              <div className="text-2xl font-semibold">{formatMoney(caja.currentSaldoUsd, 'USD')}</div>
            ) : (
              <Skeleton className="h-8 w-32" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Bancos ARS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatMoney(totalBancosArs, 'ARS')}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Bancos USD
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatMoney(totalBancosUsd, 'USD')}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Movimientos de hoy</span>
              <Link href="/movimientos" className="text-xs text-muted-foreground hover:underline">Ver todos</Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hoyMovs && hoyMovs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin movimientos hoy.</p>
            ) : (
              <ul className="space-y-2">
                {(hoyMovs ?? []).map((m) => (
                  <li key={m.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                    <div>
                      <span className="font-mono text-xs text-muted-foreground">#{m.numero}</span>{' '}
                      <span>{label(movimientoTipoLabels, m.tipo)}</span>
                      {m.notes && <span className="text-muted-foreground"> · {m.notes.slice(0, 40)}</span>}
                    </div>
                    <span className="font-medium">{formatMoney(m.monto, m.moneda)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Alquileres pendientes del mes</span>
              <Link href="/contratos" className="text-xs text-muted-foreground hover:underline">Ver contratos</Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendientes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay alquileres pendientes.</p>
            ) : (
              <ul className="space-y-2">
                {pendientes.map((a) => (
                  <li key={a.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                    <div>
                      <Link href={`/contratos/${a.id}`} className="font-mono text-xs text-muted-foreground hover:underline">#{a.numero}</Link>{' '}
                      <span>{a.propiedad.nombre} · {a.inquilino.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatMoney(a.monto, a.moneda)}</span>
                      <Badge variant="secondary">{label(estadoDelMesLabels, a.estadoDelMes)}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
