'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { formatDate } from '@/lib/format';
import { movimientoTipoLabels, monedaLabels, label } from '@/lib/labels';
import { Calendar, Filter, Search, X } from 'lucide-react';

export type FilterKey =
  | 'from'
  | 'to'
  | 'tipo'
  | 'q'
  | 'moneda'
  | 'sociedadId'
  | 'cuentaId'
  | 'propiedadId'
  | 'alquilerId';

export type FiltersState = Partial<Record<FilterKey, string>>;

type Props = {
  filters: FiltersState;
  onChange: (key: FilterKey, value: string | undefined) => void;
  onClear: () => void;
  availableFilters: FilterKey[];
};

// Filtros faceted (los que se agregan vía "+ Filtro").
const FACET_FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'tipo', label: 'Tipo' },
  { key: 'moneda', label: 'Moneda' },
  { key: 'sociedadId', label: 'Sociedad' },
  { key: 'cuentaId', label: 'Cuenta' },
  { key: 'propiedadId', label: 'Propiedad' },
  { key: 'alquilerId', label: 'Alquiler' },
];

export function FiltersBar({ filters, onChange, onClear, availableFilters }: Props) {
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  // Cuando el usuario elige un facet desde "+ Filtro", swapeamos el contenido
  // del mismo popover al picker de ese facet.
  const [pendingFacet, setPendingFacet] = useState<FilterKey | null>(null);
  const [openChipFacet, setOpenChipFacet] = useState<FilterKey | null>(null);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const showSearch = availableFilters.includes('q');
  const showDates = availableFilters.includes('from') || availableFilters.includes('to');
  const visibleFacets = FACET_FILTERS.filter((f) => availableFilters.includes(f.key));
  const activeFacets = visibleFacets.filter((f) => filters[f.key]);
  const facetsAvailableToAdd = visibleFacets.filter((f) => !filters[f.key]);

  const hasActive = useMemo(
    () => activeFacets.length > 0 || !!filters.from || !!filters.to || !!filters.q,
    [activeFacets.length, filters.from, filters.to, filters.q],
  );

  // Hotkeys: '/' enfoca search, 'f' abre el menú de + Filtro.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === '/' && showSearch) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'f' && facetsAvailableToAdd.length > 0) {
        e.preventDefault();
        setFilterMenuOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSearch, facetsAvailableToAdd.length]);

  function closeFilterMenu() {
    setFilterMenuOpen(false);
    setPendingFacet(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showSearch && (
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchRef}
            placeholder="Buscar… (/)"
            value={filters.q ?? ''}
            onChange={(e) => onChange('q', e.target.value || undefined)}
            className="pl-8 w-56"
          />
        </div>
      )}

      {showDates && (
        <DateRangeChip
          open={datePopoverOpen}
          onOpenChange={setDatePopoverOpen}
          from={filters.from}
          to={filters.to}
          onChange={(from, to) => {
            onChange('from', from);
            onChange('to', to);
          }}
        />
      )}

      {activeFacets.map((f) => (
        <FacetChip
          key={f.key}
          facetKey={f.key}
          label={f.label}
          value={filters[f.key]!}
          open={openChipFacet === f.key}
          onOpenChange={(v) => setOpenChipFacet(v ? f.key : null)}
          onChange={(val) => onChange(f.key, val)}
        />
      ))}

      {facetsAvailableToAdd.length > 0 && (
        <Popover
          open={filterMenuOpen}
          onOpenChange={(v) => {
            if (!v) closeFilterMenu();
            else setFilterMenuOpen(true);
          }}
        >
          <PopoverTrigger
            render={(props) => (
              <Button size="sm" variant="outline" {...props}>
                <Filter className="h-3.5 w-3.5" /> Filtro
              </Button>
            )}
          />
          <PopoverContent align="start" className="w-64 p-0">
            {pendingFacet === null ? (
              <Command>
                <CommandInput placeholder="Filtrar por… (f)" autoFocus />
                <CommandList>
                  <CommandEmpty>Sin filtros.</CommandEmpty>
                  <CommandGroup>
                    {facetsAvailableToAdd.map((f) => (
                      <CommandItem key={f.key} value={f.label} onSelect={() => setPendingFacet(f.key)}>
                        {f.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            ) : (
              <FacetPicker
                facetKey={pendingFacet}
                onPick={(val) => {
                  onChange(pendingFacet, val);
                  closeFilterMenu();
                }}
              />
            )}
          </PopoverContent>
        </Popover>
      )}

      {hasActive && (
        <Button size="sm" variant="ghost" onClick={onClear}>Limpiar</Button>
      )}
    </div>
  );
}

// ---------- Date chip ----------

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function fmtIso(d: Date) { return d.toISOString().slice(0, 10); }

function DateRangeChip({
  open,
  onOpenChange,
  from,
  to,
  onChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  from?: string;
  to?: string;
  onChange: (from?: string, to?: string) => void;
}) {
  const today = new Date();
  const labelText = useMemo(() => {
    if (!from && !to) return 'Fecha';
    if (from && to) return `${formatDate(from)} – ${formatDate(to)}`;
    if (from) return `Desde ${formatDate(from)}`;
    if (to) return `Hasta ${formatDate(to)}`;
    return 'Fecha';
  }, [from, to]);

  const hasValue = !!(from || to);

  function quickPick(kind: 'thisMonth' | 'lastMonth' | 'thisYear' | 'clear') {
    if (kind === 'thisMonth') {
      onChange(fmtIso(startOfMonth(today)), fmtIso(today));
    } else if (kind === 'lastMonth') {
      const ref = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      onChange(fmtIso(startOfMonth(ref)), fmtIso(endOfMonth(ref)));
    } else if (kind === 'thisYear') {
      onChange(`${today.getFullYear()}-01-01`, fmtIso(today));
    } else {
      onChange(undefined, undefined);
    }
    onOpenChange(false);
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={(props) => (
          <Button
            size="sm"
            variant={hasValue ? 'secondary' : 'outline'}
            {...props}
          >
            <Calendar className="h-3.5 w-3.5" />
            {labelText}
          </Button>
        )}
      />
      <PopoverContent align="start" className="w-72 gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" onClick={() => quickPick('thisMonth')}>Este mes</Button>
          <Button size="sm" variant="outline" onClick={() => quickPick('lastMonth')}>Mes pasado</Button>
          <Button size="sm" variant="outline" onClick={() => quickPick('thisYear')}>Este año</Button>
        </div>
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Personalizado</div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={from ?? ''}
              onChange={(e) => onChange(e.target.value || undefined, to)}
              className="h-8"
            />
            <span className="text-xs text-muted-foreground">a</span>
            <Input
              type="date"
              value={to ?? ''}
              onChange={(e) => onChange(from, e.target.value || undefined)}
              className="h-8"
            />
          </div>
        </div>
        {hasValue && (
          <Button size="sm" variant="ghost" onClick={() => quickPick('clear')}>Limpiar fechas</Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ---------- Facet chip + picker ----------

function FacetChip({
  facetKey,
  label,
  value,
  open,
  onOpenChange,
  onChange,
}: {
  facetKey: FilterKey;
  label: string;
  value: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChange: (val: string | undefined) => void;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={(props) => (
          <Badge
            variant="secondary"
            className="cursor-pointer hover:bg-secondary/80 gap-1 pr-1"
            {...props}
          >
            <span>{label}:</span>
            <FacetValueLabel facetKey={facetKey} value={value} />
            <button
              type="button"
              aria-label="Quitar filtro"
              className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-sm hover:bg-background/60"
              onClick={(e) => { e.stopPropagation(); onChange(undefined); }}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
      />
      <PopoverContent align="start" className="w-64 p-0">
        <FacetPicker
          facetKey={facetKey}
          selectedValue={value}
          onPick={(val) => { onChange(val); onOpenChange(false); }}
        />
      </PopoverContent>
    </Popover>
  );
}

function FacetPicker({
  facetKey,
  selectedValue,
  onPick,
}: {
  facetKey: FilterKey;
  selectedValue?: string;
  onPick: (val: string) => void;
}) {
  if (facetKey === 'tipo') {
    const items = Object.entries(movimientoTipoLabels).filter(([k]) => k !== 'REPARTO_SOCIO');
    return (
      <Command>
        <CommandInput placeholder="Buscar tipo…" />
        <CommandList>
          <CommandEmpty>Sin resultados.</CommandEmpty>
          <CommandGroup>
            {items.map(([key, lbl]) => (
              <CommandItem
                key={key}
                value={`${lbl} ${key}`}
                onSelect={() => onPick(key)}
                data-checked={selectedValue === key || undefined}
              >
                {lbl}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    );
  }
  if (facetKey === 'moneda') {
    return (
      <Command>
        <CommandList>
          <CommandGroup>
            {Object.entries(monedaLabels).map(([key, lbl]) => (
              <CommandItem
                key={key}
                value={lbl}
                onSelect={() => onPick(key)}
                data-checked={selectedValue === key || undefined}
              >
                {lbl}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    );
  }
  return (
    <EntityPicker
      facetKey={facetKey}
      selectedId={selectedValue}
      onPick={onPick}
    />
  );
}

type SociedadOpt = { id: string; name: string };
type CuentaOpt = { id: string; name: string };
type PropiedadOpt = { id: string; nombre: string };
type AlquilerOpt = { id: string; numero: number; propiedad: { nombre: string }; inquilino: { name: string } };

function EntityPicker({
  facetKey,
  selectedId,
  onPick,
}: {
  facetKey: FilterKey;
  selectedId?: string;
  onPick: (val: string) => void;
}) {
  const endpoint =
    facetKey === 'sociedadId' ? '/sociedades' :
    facetKey === 'cuentaId'   ? '/cuentas' :
    facetKey === 'propiedadId' ? '/propiedades' :
    facetKey === 'alquilerId' ? '/alquileres' :
    null;
  const params =
    facetKey === 'cuentaId' || facetKey === 'propiedadId' ? { active: 'true' } :
    facetKey === 'alquilerId' ? { status: 'ACTIVO' } :
    undefined;

  // Mientras el endpoint está cargando, useQuery devuelve null. Renderizamos
  // siempre un Command para que cmdk maneje el foco y la nav por teclado.
  const { data, isLoading } = useQuery<SociedadOpt[] | CuentaOpt[] | PropiedadOpt[] | AlquilerOpt[]>(endpoint, params);

  type Item = { id: string; label: string };
  const items: Item[] = useMemo(() => {
    if (!data) return [];
    if (facetKey === 'sociedadId') return (data as SociedadOpt[]).map((d) => ({ id: d.id, label: d.name }));
    if (facetKey === 'cuentaId') return (data as CuentaOpt[]).map((d) => ({ id: d.id, label: d.name }));
    if (facetKey === 'propiedadId') return (data as PropiedadOpt[]).map((d) => ({ id: d.id, label: d.nombre }));
    if (facetKey === 'alquilerId') return (data as AlquilerOpt[]).map((d) => ({ id: d.id, label: `#${d.numero} · ${d.propiedad.nombre} · ${d.inquilino.name}` }));
    return [];
  }, [data, facetKey]);

  return (
    <Command>
      <CommandInput placeholder="Buscar…" />
      <CommandList>
        {isLoading && <div className="py-4 text-center text-sm text-muted-foreground">Cargando…</div>}
        {!isLoading && <CommandEmpty>Sin resultados.</CommandEmpty>}
        <CommandGroup>
          {items.map((it) => (
            <CommandItem
              key={it.id}
              value={it.label}
              onSelect={() => onPick(it.id)}
              data-checked={selectedId === it.id || undefined}
            >
              {it.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

function FacetValueLabel({ facetKey, value }: { facetKey: FilterKey; value: string }) {
  if (facetKey === 'tipo') return <span>{label(movimientoTipoLabels, value)}</span>;
  if (facetKey === 'moneda') return <span>{label(monedaLabels, value)}</span>;
  return <EntityValueLabel facetKey={facetKey} id={value} />;
}

function EntityValueLabel({ facetKey, id }: { facetKey: FilterKey; id: string }) {
  const endpoint =
    facetKey === 'sociedadId' ? `/sociedades/${id}` :
    facetKey === 'cuentaId'   ? `/cuentas/${id}` :
    facetKey === 'propiedadId' ? `/propiedades/${id}` :
    facetKey === 'alquilerId' ? `/alquileres/${id}` :
    null;
  const { data } = useQuery<{ id: string; name?: string; nombre?: string; numero?: number }>(endpoint);
  if (!data) return <span className="opacity-60">…</span>;
  const txt = data.name ?? data.nombre ?? (data.numero != null ? `#${data.numero}` : id);
  return <span className="font-medium">{txt}</span>;
}
