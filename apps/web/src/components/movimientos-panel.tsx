'use client';

import { useMemo, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@/lib/hooks';
import { apiFetch } from '@/lib/api';
import { formatApiError } from '@/lib/api-errors';
import { formatMoney, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { label, movimientoTipoLabels, bucketLabels } from '@/lib/labels';

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

type FilterKey = 'from' | 'to' | 'tipo' | 'q' | 'moneda';

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

  const filters = useMemo(() => ({
    from: searchParams.get('from') || undefined,
    to: searchParams.get('to') || undefined,
    tipo: searchParams.get('tipo') || undefined,
    q: searchParams.get('q') || undefined,
    moneda: searchParams.get('moneda') || undefined,
  }), [searchParams]);

  const hasAnyFilter = !!(filters.from || filters.to || filters.tipo || filters.q || filters.moneda);

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
    (['from', 'to', 'tipo', 'q', 'moneda'] as FilterKey[]).forEach((k) => sp.delete(k));
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

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

  const show = (k: FilterKey) => !hideFilters.includes(k);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={downloadCsv} disabled={downloading}>
          <Download className="h-4 w-4" /> {downloading ? 'Descargando…' : 'Descargar CSV'}
        </Button>
        <div className="h-6 w-px bg-border mx-1" />
        {show('q') && (
          <Input
            placeholder="Buscar en notas o comprobante…"
            value={filters.q ?? ''}
            onChange={(e) => setFilter('q', e.target.value)}
            className="max-w-xs"
          />
        )}
        {show('tipo') && (
          <select
            value={filters.tipo ?? ''}
            onChange={(e) => setFilter('tipo', e.target.value || undefined)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Todos los tipos</option>
            {Object.keys(movimientoTipoLabels).filter((t) => t !== 'REPARTO_SOCIO').map((t) => (
              <option key={t} value={t}>{movimientoTipoLabels[t]}</option>
            ))}
          </select>
        )}
        {show('moneda') && (
          <select
            value={filters.moneda ?? ''}
            onChange={(e) => setFilter('moneda', e.target.value || undefined)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">ARS + USD</option>
            <option value="ARS">Pesos</option>
            <option value="USD">Dólares</option>
          </select>
        )}
        {show('from') && (
          <Input
            type="date"
            value={filters.from ?? ''}
            onChange={(e) => setFilter('from', e.target.value || undefined)}
            className="w-40"
          />
        )}
        {show('to') && (
          <>
            <span className="text-xs text-muted-foreground">a</span>
            <Input
              type="date"
              value={filters.to ?? ''}
              onChange={(e) => setFilter('to', e.target.value || undefined)}
              className="w-40"
            />
          </>
        )}
        {hasAnyFilter && (
          <Button size="sm" variant="ghost" onClick={clearFilters}>Limpiar</Button>
        )}
      </div>

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
                  {m.derivadoDe
                    ? <span className="text-xs text-muted-foreground">Reparto de #{m.derivadoDe.numero} · {label(movimientoTipoLabels, m.derivadoDe.tipo)}</span>
                    : <Badge variant="outline">{label(movimientoTipoLabels, m.tipo)}</Badge>}
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

function tipoLabelForCsv(m: PanelMov): string {
  if (m.derivadoDe) {
    return `Reparto de #${m.derivadoDe.numero} · ${label(movimientoTipoLabels, m.derivadoDe.tipo)}`;
  }
  return label(movimientoTipoLabels, m.tipo);
}

export function movsToCsv(movs: PanelMov[]): string {
  const headers = ['Numero', 'Fecha', 'Tipo', 'Monto', 'Moneda', 'Origen', 'Destino', 'Sociedad', 'Propiedad', 'Alquiler', 'Contraparte', 'Comprobante', 'Facturado', 'Notas'];
  const rows = movs.map((m) => [
    `#${m.numero}`,
    m.fecha.slice(0, 10),
    tipoLabelForCsv(m),
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
