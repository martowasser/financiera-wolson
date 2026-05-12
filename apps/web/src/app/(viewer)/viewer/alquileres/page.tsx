'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@/lib/hooks';
import { formatMoney, formatDate } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, FileWarning, MapPin, Home } from 'lucide-react';

type EstadoDelMes = 'AL_DIA' | 'SIN_FACTURAR' | 'PENDIENTE' | 'NO_APLICA';

type AlquilerSocio = { cuentaId: string; cuentaName: string; percentBps: number };

type Alquiler = {
  id: string;
  numero: number;
  propiedad: { id: string; nombre: string; direccion: string | null };
  inquilino: { id: string; name: string };
  monto: string;
  moneda: 'ARS' | 'USD';
  status: 'ACTIVO' | 'FINALIZADO';
  socios: AlquilerSocio[];
  estadoDelMes: EstadoDelMes;
  ultimoCobro: { id: string; fecha: string; comprobante: string | null; monto: string; moneda: string } | null;
};

type Posicion = {
  owner: { cuentaIds: string[]; names: string[] } | null;
};

const ESTADO_ORDER: Record<EstadoDelMes, number> = {
  PENDIENTE: 0,
  SIN_FACTURAR: 1,
  AL_DIA: 2,
  NO_APLICA: 3,
};

function correspondeCentavos(montoStr: string, percentBps: number): number {
  // monto * bps / 10000 — sub-centavo rounding is acceptable for display.
  return Math.round((Number(montoStr) * percentBps) / 10000);
}

type ResumenMes = {
  brutoArs: number; brutoUsd: number;
  esperadoArs: number; esperadoUsd: number;
  cobradoArs: number; cobradoUsd: number;
  pendienteCount: number;
};

function computeResumen(activos: Alquiler[], ownerCuentaIds: Set<string>): ResumenMes {
  const t: ResumenMes = {
    brutoArs: 0, brutoUsd: 0,
    esperadoArs: 0, esperadoUsd: 0,
    cobradoArs: 0, cobradoUsd: 0,
    pendienteCount: 0,
  };
  for (const a of activos) {
    const ownerBps = a.socios
      .filter((s) => ownerCuentaIds.has(s.cuentaId))
      .reduce((sum, s) => sum + s.percentBps, 0);
    const expected = correspondeCentavos(a.monto, ownerBps);
    const cobrado = a.ultimoCobro
      ? correspondeCentavos(a.ultimoCobro.monto, ownerBps)
      : 0;
    if (a.moneda === 'ARS') {
      t.brutoArs += Number(a.monto);
      t.esperadoArs += expected;
      t.cobradoArs += cobrado;
    } else {
      t.brutoUsd += Number(a.monto);
      t.esperadoUsd += expected;
      t.cobradoUsd += cobrado;
    }
    if (a.estadoDelMes === 'PENDIENTE') t.pendienteCount += 1;
  }
  return t;
}

// Devuelve la lista de participaciones con las cuentas owner fusionadas en una sola línea "Usted".
type Participacion = { key: string; label: string; percentBps: number };
function fuseParticipaciones(socios: AlquilerSocio[], ownerCuentaIds: Set<string>): Participacion[] {
  const ownerSocios = socios.filter((s) => ownerCuentaIds.has(s.cuentaId));
  const otrosSocios = socios.filter((s) => !ownerCuentaIds.has(s.cuentaId));
  const out: Participacion[] = [];
  if (ownerSocios.length > 0) {
    out.push({
      key: 'owner',
      label: 'Usted',
      percentBps: ownerSocios.reduce((sum, s) => sum + s.percentBps, 0),
    });
  }
  for (const s of otrosSocios) {
    out.push({ key: s.cuentaId, label: s.cuentaName, percentBps: s.percentBps });
  }
  return out;
}

function EstadoBadge({ estado }: { estado: EstadoDelMes }) {
  const map = {
    AL_DIA:       { Icon: CheckCircle2, label: 'Cobrado este mes', cls: 'bg-green-100 text-green-900 border-green-300' },
    SIN_FACTURAR: { Icon: FileWarning,  label: 'Sin factura',      cls: 'bg-gray-100 text-gray-900 border-gray-300' },
    PENDIENTE:    { Icon: AlertTriangle,label: 'Pendiente de cobro',cls: 'bg-amber-100 text-amber-900 border-amber-300' },
    NO_APLICA:    { Icon: Home,         label: 'Finalizado',       cls: 'bg-slate-100 text-slate-700 border-slate-300' },
  }[estado];
  const { Icon, label, cls } = map;
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${cls}`}>
      <Icon className="h-5 w-5" />
      <span className="font-medium">{label}</span>
    </span>
  );
}

function ResumenCard({ resumen }: { resumen: ResumenMes }) {
  const pendienteArs = resumen.esperadoArs - resumen.cobradoArs;
  const pendienteUsd = resumen.esperadoUsd - resumen.cobradoUsd;

  // Mostramos sólo las monedas que tengan algún valor (evita "US$ 0,00" cuando todo es en pesos).
  const hayArs = resumen.esperadoArs > 0 || resumen.cobradoArs > 0 || pendienteArs > 0;
  const hayUsd = resumen.esperadoUsd > 0 || resumen.cobradoUsd > 0 || pendienteUsd > 0;

  const todoCobrado = pendienteArs <= 0 && pendienteUsd <= 0 && resumen.pendienteCount === 0;

  return (
    <Card>
      <CardContent className="space-y-6">
        <div className="text-center py-4 space-y-3">
          <div className="text-xl font-medium">Este mes va a cobrar en total</div>
          <div className="space-y-1">
            {hayArs && <div className="viewer-amount-xl">{formatMoney(resumen.esperadoArs, 'ARS')}</div>}
            {hayUsd && <div className="viewer-amount-xl">{formatMoney(resumen.esperadoUsd, 'USD')}</div>}
            {!hayArs && !hayUsd && (
              <div className="viewer-amount-xl text-muted-foreground">$ 0,00</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-5 space-y-2">
            <div className="flex items-center gap-2 text-green-900">
              <CheckCircle2 className="h-6 w-6" />
              <span className="font-medium">Ya cobró</span>
            </div>
            {resumen.cobradoArs > 0 && (
              <div className="viewer-amount-md text-green-900">{formatMoney(resumen.cobradoArs, 'ARS')}</div>
            )}
            {resumen.cobradoUsd > 0 && (
              <div className="viewer-amount-md text-green-900">{formatMoney(resumen.cobradoUsd, 'USD')}</div>
            )}
            {resumen.cobradoArs === 0 && resumen.cobradoUsd === 0 && (
              <div className="viewer-amount-md text-green-900/60">$ 0,00</div>
            )}
          </div>

          <div className={`rounded-2xl border-2 p-5 space-y-2 ${todoCobrado ? 'border-muted bg-muted/30' : 'border-amber-200 bg-amber-50'}`}>
            <div className={`flex items-center gap-2 ${todoCobrado ? 'text-muted-foreground' : 'text-amber-900'}`}>
              <AlertTriangle className="h-6 w-6" />
              <span className="font-medium">Le falta cobrar</span>
            </div>
            {pendienteArs > 0 && (
              <div className="viewer-amount-md text-amber-900">{formatMoney(pendienteArs, 'ARS')}</div>
            )}
            {pendienteUsd > 0 && (
              <div className="viewer-amount-md text-amber-900">{formatMoney(pendienteUsd, 'USD')}</div>
            )}
            {pendienteArs <= 0 && pendienteUsd <= 0 && (
              <div className="viewer-amount-md text-muted-foreground">$ 0,00</div>
            )}
          </div>
        </div>

        {todoCobrado ? (
          <div className="flex items-center gap-2 text-green-900 bg-green-50 border-2 border-green-200 rounded-xl px-4 py-3">
            <CheckCircle2 className="h-6 w-6 shrink-0" />
            <span className="font-medium">Está todo cobrado este mes.</span>
          </div>
        ) : (
          resumen.pendienteCount > 0 && (
            <div className="flex items-center gap-2 text-amber-900 bg-amber-50 border-2 border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <span className="font-medium">
                {resumen.pendienteCount === 1
                  ? 'Todavía falta cobrar 1 alquiler este mes.'
                  : `Todavía faltan cobrar ${resumen.pendienteCount} alquileres este mes.`}
              </span>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}

function AlquilerCard({ alquiler, ownerCuentaIds }: { alquiler: Alquiler; ownerCuentaIds: Set<string> }) {
  const participaciones = fuseParticipaciones(alquiler.socios, ownerCuentaIds);
  const ownerBpsTotal = alquiler.socios
    .filter((s) => ownerCuentaIds.has(s.cuentaId))
    .reduce((sum, s) => sum + s.percentBps, 0);
  const corresponde = ownerBpsTotal > 0
    ? correspondeCentavos(alquiler.monto, ownerBpsTotal)
    : null;

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <MapPin className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
            <div>
              <div className="font-semibold">{alquiler.propiedad.nombre}</div>
              {alquiler.propiedad.direccion && (
                <div className="text-muted-foreground">{alquiler.propiedad.direccion}</div>
              )}
            </div>
          </div>
          <EstadoBadge estado={alquiler.estadoDelMes} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="text-muted-foreground">Inquilino</div>
            <div className="font-medium">{alquiler.inquilino.name}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Cobra por mes</div>
            <div className="font-semibold">{formatMoney(alquiler.monto, alquiler.moneda)}</div>
          </div>
        </div>

        {participaciones.length > 0 && (
          <div>
            <div className="text-muted-foreground mb-1">Participaciones</div>
            <ul className="space-y-1">
              {participaciones.map((p) => (
                <li key={p.key} className="flex items-center justify-between">
                  <span>{p.label}</span>
                  <span className="font-medium">{(p.percentBps / 100).toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {corresponde !== null && alquiler.status === 'ACTIVO' && (
          <div className="border-t pt-3">
            <div className="text-muted-foreground">Lo que le corresponde a usted</div>
            <div className="viewer-amount-md">{formatMoney(corresponde, alquiler.moneda)}</div>
          </div>
        )}

        {alquiler.ultimoCobro && (
          <div className="text-muted-foreground border-t pt-3">
            Último cobro: {formatDate(alquiler.ultimoCobro.fecha)}
            {alquiler.ultimoCobro.comprobante && ` · comprobante ${alquiler.ultimoCobro.comprobante}`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ViewerAlquileresPage() {
  const { data: alquileres, isLoading: loadingAlq, error: errorAlq } = useQuery<Alquiler[]>('/reports/alquileres');
  const { data: posicion } = useQuery<Posicion>('/reports/posicion');
  const [tab, setTab] = useState<'ACTIVO' | 'FINALIZADO'>('ACTIVO');

  const ownerCuentaIds = useMemo(
    () => new Set(posicion?.owner?.cuentaIds ?? []),
    [posicion],
  );

  const { activos, finalizados } = useMemo(() => {
    const list = alquileres ?? [];
    return {
      activos: list
        .filter((a) => a.status === 'ACTIVO')
        .sort((a, b) => ESTADO_ORDER[a.estadoDelMes] - ESTADO_ORDER[b.estadoDelMes]),
      finalizados: list.filter((a) => a.status === 'FINALIZADO'),
    };
  }, [alquileres]);

  const resumen = useMemo(
    () => computeResumen(activos, ownerCuentaIds),
    [activos, ownerCuentaIds],
  );

  const current = tab === 'ACTIVO' ? activos : finalizados;

  return (
    <div className="space-y-6">
      <h1>Sus alquileres</h1>

      {tab === 'ACTIVO' && activos.length > 0 && <ResumenCard resumen={resumen} />}

      <div className="flex gap-2">
        <Button
          size="lg"
          variant={tab === 'ACTIVO' ? 'default' : 'outline'}
          onClick={() => setTab('ACTIVO')}
        >
          Activos ({activos.length})
        </Button>
        <Button
          size="lg"
          variant={tab === 'FINALIZADO' ? 'default' : 'outline'}
          onClick={() => setTab('FINALIZADO')}
        >
          Finalizados ({finalizados.length})
        </Button>
      </div>

      {loadingAlq && (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-4xl" />
          <Skeleton className="h-48 w-full rounded-4xl" />
        </div>
      )}

      {errorAlq && (
        <Card>
          <CardContent>
            <p className="text-destructive">No pudimos cargar sus alquileres. Intente recargar la página.</p>
          </CardContent>
        </Card>
      )}

      {!loadingAlq && !errorAlq && current.length === 0 && (
        <Card>
          <CardContent className="text-center py-12 space-y-2">
            <Home className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">
              {tab === 'ACTIVO'
                ? 'Todavía no hay alquileres activos cargados.'
                : 'No hay alquileres finalizados.'}
            </p>
          </CardContent>
        </Card>
      )}

      {!loadingAlq && current.length > 0 && (
        <div className="space-y-4">
          {current.map((a) => (
            <AlquilerCard key={a.id} alquiler={a} ownerCuentaIds={ownerCuentaIds} />
          ))}
        </div>
      )}
    </div>
  );
}
