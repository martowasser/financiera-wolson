'use client';

import { useMemo, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@/lib/hooks';
import { apiFetch } from '@/lib/api';
import { formatApiError } from '@/lib/api-errors';
import { formatMoney, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { label, movimientoTipoLabels, bucketLabels } from '@/lib/labels';
import { FiltersBar, type FilterKey, type FiltersState } from './movimientos-panel/filters-bar';

// Tipo común para los movimientos que devuelve /movimientos.
// Mantener en sync con el include del backend (apps/api/src/modules/movimiento/service.ts:listMovimientos).
export type PanelMov = {
  id: string;
  numero: number;
  fecha: string;
  tipo: string;
  monto: string;
  moneda: string;
  origenBucket: string | null;
  destinoBucket: string | null;
  notes: string | null;
  comprobante: string | null;
  facturado: boolean;
  bancoOrigen: { id: string; nombre: string } | null;
  bancoDestino: { id: string; nombre: string } | null;
  cuentaOrigen: { id: string; name: string } | null;
  cuentaDestino: { id: string; name: string } | null;
  cuentaContraparte: { id: string; name: string } | null;
  sociedad: { id: string; name: string } | null;
  propiedad: { id: string; nombre: string } | null;
  alquiler: { id: string; numero: number } | null;
  derivadoDe: { id: string; numero: number; tipo: string } | null;
};

export type Scope = {
  cuentaId?: string;
  sociedadId?: string;
  propiedadId?: string;
  alquilerId?: string;
  bancoId?: string;
  fecha?: string;
};

type Props = {
  scope?: Scope;
  defaultLimit?: number;
  filenameHint?: string;
  hideFilters?: FilterKey[];
  onRowClick?: (mov: PanelMov) => void;
};

export function MovimientosPanel({
  scope,
  defaultLimit = 200,
  filenameHint,
  hideFilters = [],
  onRowClick,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [downloading, setDownloading] = useState(false);

  const filters: FiltersState = useMemo(() => ({
    from:        searchParams.get('from')        || undefined,
    to:          searchParams.get('to')          || undefined,
    tipo:        searchParams.get('tipo')        || undefined,
    q:           searchParams.get('q')           || undefined,
    moneda:      searchParams.get('moneda')      || undefined,
    sociedadId:  searchParams.get('sociedadId')  || undefined,
    cuentaId:    searchParams.get('cuentaId')    || undefined,
    propiedadId: searchParams.get('propiedadId') || undefined,
    alquilerId:  searchParams.get('alquilerId')  || undefined,
  }), [searchParams]);

  const queryParams = { ...filters, ...scope, limit: defaultLimit };
  const { data: movs, isLoading } = useQuery<PanelMov[]>('/movimientos', queryParams);

  function setFilter(key: FilterKey, value: string | undefined) {
    const sp = new URLSearchParams(searchParams.toString());
    if (value && value.trim() !== '') sp.set(key, value);
    else sp.delete(key);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function clearFilters() {
    const sp = new URLSearchParams(searchParams.toString());
    (Object.keys(filters) as FilterKey[]).forEach((k) => sp.delete(k));
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Las claves de filtro disponibles son las que NO están fijadas por scope ni
  // ocultas explícitamente. Si scope.cuentaId está seteado, filtrar por
  // cuentaId desde la UI no tiene sentido.
  const allFilterKeys: FilterKey[] = ['from', 'to', 'q', 'tipo', 'moneda', 'sociedadId', 'cuentaId', 'propiedadId', 'alquilerId'];
  const availableFilters: FilterKey[] = useMemo(() => {
    return allFilterKeys.filter((k) => {
      if (hideFilters.includes(k)) return false;
      if (scope?.sociedadId && k === 'sociedadId') return false;
      if (scope?.cuentaId && k === 'cuentaId') return false;
      if (scope?.propiedadId && k === 'propiedadId') return false;
      if (scope?.alquilerId && k === 'alquilerId') return false;
      if (scope?.bancoId && k === 'sociedadId') return false; // banco implica sociedad
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideFilters.join(','), scope?.sociedadId, scope?.cuentaId, scope?.propiedadId, scope?.alquilerId, scope?.bancoId]);

  async function downloadCsv() {
    setDownloading(true);
    try {
      const all = await apiFetch<PanelMov[]>('/movimientos', { params: { ...filters, ...scope, limit: 5000 } });
      const csv = movsToCsv(all);
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = csvFilename(filenameHint);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Descargado: ${all.length} movimientos`);
    } catch (e) {
      toast.error(formatApiError(e, 'Error al descargar'));
    } finally {
      setDownloading(false);
    }
  }

  const count = movs?.length ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={downloadCsv} disabled={downloading}>
          <Download className="h-4 w-4" /> {downloading ? 'Descargando…' : 'Descargar CSV'}
        </Button>
        <div className="h-6 w-px bg-border mx-1" />
        <FiltersBar
          filters={filters}
          onChange={setFilter}
          onClear={clearFilters}
          availableFilters={availableFilters}
        />
      </div>

      {!isLoading && (
        <div className="text-xs text-muted-foreground">
          {count === defaultLimit
            ? `Mostrando primeros ${defaultLimit} — refiná filtros para ver más`
            : `${count} ${count === 1 ? 'movimiento' : 'movimientos'}`}
        </div>
      )}

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-2 py-2 text-left font-medium">#</th>
              <th className="px-2 py-2 text-left font-medium">Fecha</th>
              <th className="px-2 py-2 text-left font-medium">Tipo</th>
              <th className="px-2 py-2 text-right font-medium">Monto</th>
              <th className="px-2 py-2 text-left font-medium">Origen → Destino</th>
              <th className="px-2 py-2 text-left font-medium">Contexto</th>
              <th className="px-2 py-2 text-left font-medium">Notas</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-2 py-4 text-muted-foreground">Cargando…</td></tr>}
            {movs && movs.length === 0 && <tr><td colSpan={7} className="px-2 py-4 text-muted-foreground">Sin movimientos.</td></tr>}
            {(movs ?? []).map((m) => (
              <tr
                key={m.id}
                onClick={() => onRowClick?.(m)}
                className={`border-b last:border-0 ${onRowClick ? 'hover:bg-muted/30 cursor-pointer' : ''}`}
              >
                <td className="px-2 py-2 font-mono text-xs">#{m.numero}</td>
                <td className="px-2 py-2">{formatDate(m.fecha)}</td>
                <td className="px-2 py-2">
                  <Badge variant="outline">{label(movimientoTipoLabels, m.tipo)}</Badge>
                </td>
                <td className="px-2 py-2 text-right font-medium">{formatMoney(m.monto, m.moneda)}</td>
                <td className="px-2 py-2 text-muted-foreground text-xs">{legibleSide(m, 'origen')} → {legibleSide(m, 'destino')}</td>
                <td className="px-2 py-2 text-xs text-muted-foreground">{contextoLine(m)}</td>
                <td className="px-2 py-2 text-xs text-muted-foreground truncate max-w-[220px]">{m.notes ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function legibleSide(m: Pick<PanelMov, 'origenBucket' | 'destinoBucket' | 'bancoOrigen' | 'bancoDestino' | 'cuentaOrigen' | 'cuentaDestino'>, side: 'origen' | 'destino'): string {
  const bucket = side === 'origen' ? m.origenBucket : m.destinoBucket;
  const banco = side === 'origen' ? m.bancoOrigen : m.bancoDestino;
  const cuenta = side === 'origen' ? m.cuentaOrigen : m.cuentaDestino;
  if (!bucket) return '—';
  if (bucket === 'CAJA') return 'Caja';
  if (bucket === 'BANCO') return `${label(bucketLabels, bucket)} ${banco?.nombre ?? ''}`.trim();
  if (bucket === 'CUENTA_CORRIENTE') return `${cuenta?.name ?? ''}`;
  return bucket;
}

function contextoLine(m: PanelMov) {
  const parts: string[] = [];
  if (m.alquiler) parts.push(`#${m.alquiler.numero}`);
  if (m.propiedad) parts.push(m.propiedad.nombre);
  if (m.sociedad) parts.push(m.sociedad.name);
  if (m.cuentaContraparte) parts.push(m.cuentaContraparte.name);
  return parts.length ? parts.join(' · ') : '—';
}

// ---- CSV ----

function csvCell(v: string | number | null | undefined): string {
  if (v == null) return '';
  const s = String(v);
  // Escapamos comilla doble como "" y rodeamos el campo con comillas si hay coma, comilla o newline.
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function movsToCsv(movs: PanelMov[]): string {
  const headers = ['Numero', 'Fecha', 'Tipo', 'Monto', 'Moneda', 'Origen', 'Destino', 'Sociedad', 'Propiedad', 'Alquiler', 'Contraparte', 'Comprobante', 'Facturado', 'Notas'];
  const rows = movs.map((m) => [
    `#${m.numero}`,
    m.fecha.slice(0, 10),
    label(movimientoTipoLabels, m.tipo),
    (Number(m.monto) / 100).toFixed(2),
    m.moneda,
    legibleSide(m, 'origen'),
    legibleSide(m, 'destino'),
    m.sociedad?.name ?? '',
    m.propiedad?.nombre ?? '',
    m.alquiler ? `#${m.alquiler.numero}` : '',
    m.cuentaContraparte?.name ?? '',
    m.comprobante ?? '',
    m.facturado ? 'Si' : 'No',
    m.notes ?? '',
  ].map(csvCell).join(','));
  return [headers.join(','), ...rows].join('\r\n');
}

function sanitize(s: string | undefined): string {
  if (!s) return '';
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9-]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '').slice(0, 40);
}

function csvFilename(hint?: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const tag = sanitize(hint);
  return tag ? `movimientos-${tag}-${today}.csv` : `movimientos-${today}.csv`;
}
