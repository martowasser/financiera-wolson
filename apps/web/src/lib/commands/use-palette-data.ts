'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@/lib/hooks';
import type { PaletteCommand } from './types';

type CuentaSummary = { id: string; name: string; identifier: string | null };
type SociedadSummary = { id: string; name: string };
type PropiedadSummary = { id: string; nombre: string; direccion: string };
type AlquilerSummary = {
  id: string;
  numero: number;
  inquilino: { name: string };
  propiedad: { nombre: string };
};
type MovimientoSummary = {
  id: string;
  numero: number;
  tipo: string;
  monto: string;
  moneda: string;
  notes: string | null;
};

const RECENT_LIMIT = 200;

export function usePaletteData(isOpen: boolean): PaletteCommand[] {
  const router = useRouter();
  const { data: cuentas,    refetch: rA } = useQuery<CuentaSummary[]>('/cuentas');
  const { data: sociedades, refetch: rB } = useQuery<SociedadSummary[]>('/sociedades');
  const { data: propiedades,refetch: rC } = useQuery<PropiedadSummary[]>('/propiedades');
  const { data: alquileres, refetch: rD } = useQuery<AlquilerSummary[]>('/alquileres');
  const { data: movimientos,refetch: rE } = useQuery<MovimientoSummary[]>('/movimientos');

  useEffect(() => {
    if (isOpen) { rA(); rB(); rC(); rD(); rE(); }
  }, [isOpen, rA, rB, rC, rD, rE]);

  return useMemo(() => {
    const items: PaletteCommand[] = [];

    for (const c of cuentas ?? []) {
      items.push({
        id: `cuenta-${c.id}`,
        label: c.identifier ? `${c.name} · ${c.identifier}` : c.name,
        group: 'Cuentas',
        run: () => router.push(`/cuentas/${c.id}`),
      });
    }
    for (const s of sociedades ?? []) {
      items.push({
        id: `sociedad-${s.id}`,
        label: s.name,
        group: 'Sociedades',
        run: () => router.push(`/sociedades/${s.id}`),
      });
    }
    for (const p of propiedades ?? []) {
      items.push({
        id: `propiedad-${p.id}`,
        label: p.nombre,
        group: 'Propiedades',
        keywords: [p.direccion],
        run: () => router.push(`/propiedades/${p.id}`),
      });
    }
    for (const c of alquileres ?? []) {
      items.push({
        id: `alquiler-${c.id}`,
        label: `#${c.numero} · ${c.propiedad.nombre} · ${c.inquilino.name}`,
        group: 'Alquileres',
        keywords: ['contrato'],
        run: () => router.push(`/alquileres/${c.id}`),
      });
    }
    const recentMovs = (movimientos ?? []).slice(0, RECENT_LIMIT);
    for (const m of recentMovs) {
      items.push({
        id: `mov-${m.id}`,
        label: `#${m.numero} · ${m.tipo} · ${m.monto} ${m.moneda}${m.notes ? ' · ' + m.notes.slice(0, 60) : ''}`,
        group: 'Movimientos',
        run: () => router.push(`/movimientos?id=${m.id}`),
      });
    }
    return items;
  }, [cuentas, sociedades, propiedades, alquileres, movimientos, router]);
}
