'use client';

import { useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@/lib/hooks';
import { formatApiError } from '@/lib/api-errors';
import { formatMoney } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

type Cuenta = {
  id: string;
  name: string;
  identifier: string | null;
};

type Sociedad = {
  id: string;
  name: string;
  notes: string | null;
  isActive: boolean;
  banco: {
    id: string;
    nombre: string;
    numero: string;
    saldoArs: string;
    saldoUsd: string;
    isActive: boolean;
  } | null;
  socios: Array<{ cuentaId: string; percentBps: number }>;
  propiedades: Array<{ id: string }>;
  _count?: { propiedades: number };
};

export default function SociedadesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const newOpen = searchParams.get('new') === '1';
  const [q, setQ] = useState('');

  const params = useMemo(() => {
    const p: Record<string, string> = {
      includeBanco: 'true',
      includeSocios: 'true',
      includePropiedades: 'true',
    };
    if (q) p.q = q;
    return p;
  }, [q]);

  const { data: sociedades, isLoading, refetch } = useQuery<Sociedad[]>('/sociedades', params);

  const closeDialog = () => router.replace('/sociedades');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sociedades"
        description="Sociedades propietarias de inmuebles y titulares de bancos"
        actions={
          <Link href="/sociedades?new=1">
            <Button size="sm"><Plus className="h-4 w-4" /> Nueva sociedad</Button>
          </Link>
        }
      />

      <div className="flex items-center gap-2">
        <Input
          placeholder="Buscar por nombre..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Nombre</th>
              <th className="px-3 py-2 text-center font-medium"># Socios</th>
              <th className="px-3 py-2 text-left font-medium">Banco</th>
              <th className="px-3 py-2 text-right font-medium">Saldo ARS</th>
              <th className="px-3 py-2 text-right font-medium">Saldo USD</th>
              <th className="px-3 py-2 text-center font-medium"># Propiedades</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-3 py-4 text-muted-foreground">Cargando…</td></tr>
            )}
            {sociedades && sociedades.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-4 text-muted-foreground">Sin sociedades.</td></tr>
            )}
            {(sociedades ?? []).map((s) => {
              const propCount = s._count?.propiedades ?? s.propiedades?.length ?? 0;
              return (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <Link href={`/sociedades/${s.id}`} className="font-medium hover:underline">{s.name}</Link>
                  </td>
                  <td className="px-3 py-2 text-center">{s.socios?.length ?? 0}</td>
                  <td className="px-3 py-2">
                    {s.banco
                      ? <span className="font-mono text-xs">{s.banco.numero}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {s.banco
                      ? <span className={Number(s.banco.saldoArs) < 0 ? 'text-red-600' : ''}>{formatMoney(s.banco.saldoArs, 'ARS')}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {s.banco
                      ? <span className={Number(s.banco.saldoUsd) < 0 ? 'text-red-600' : ''}>{formatMoney(s.banco.saldoUsd, 'USD')}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-center">{propCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SociedadFormDialog open={newOpen} onClose={closeDialog} onSaved={() => { refetch(); closeDialog(); }} />
    </div>
  );
}

type SocioRow = { cuentaId: string; percent: string };

function SociedadFormDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [socios, setSocios] = useState<SocioRow[]>([]);
  const { mutate, isLoading } = useMutation<Record<string, unknown>, unknown>('/sociedades');
  const { data: cuentas } = useQuery<Cuenta[]>(open ? '/cuentas' : null, { active: 'true' });

  const sumBps = useMemo(() => {
    return socios.reduce((acc, s) => {
      const n = parseFloat(s.percent);
      if (Number.isNaN(n)) return acc;
      return acc + Math.round(n * 100);
    }, 0);
  }, [socios]);

  const hasSocios = socios.length > 0;
  const sociosValid = !hasSocios || sumBps === 10000;
  const allSociosFilled = socios.every((s) => s.cuentaId && s.percent.trim() !== '');

  function addSocio() {
    setSocios((rows) => [...rows, { cuentaId: '', percent: '' }]);
  }

  function updateSocio(idx: number, patch: Partial<SocioRow>) {
    setSocios((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function removeSocio(idx: number) {
    setSocios((rows) => rows.filter((_, i) => i !== idx));
  }

  async function submit() {
    if (!name.trim()) return;
    if (hasSocios && (!allSociosFilled || !sociosValid)) {
      toast.error('Los socios deben sumar 100%');
      return;
    }
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        notes: notes.trim() || undefined,
      };
      if (hasSocios) {
        body.socios = socios.map((s) => ({
          cuentaId: s.cuentaId,
          percentBps: Math.round(parseFloat(s.percent) * 100),
        }));
      }
      await mutate(body);
      toast.success('Sociedad creada');
      setName(''); setNotes(''); setSocios([]);
      onSaved();
    } catch (e) {
      toast.error(formatApiError(e, 'Error al crear'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nueva sociedad</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Socios (opcional)</Label>
              <Button type="button" size="sm" variant="ghost" onClick={addSocio}>
                <Plus className="h-4 w-4" /> Agregar
              </Button>
            </div>
            {socios.length === 0 && (
              <p className="text-xs text-muted-foreground">Podés dejarla sin socios y configurarlos más tarde.</p>
            )}
            {socios.map((s, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  value={s.cuentaId}
                  onChange={(e) => updateSocio(idx, { cuentaId: e.target.value })}
                  className="flex-1 rounded-md border bg-transparent px-2 py-1.5 text-sm"
                >
                  <option value="">— Elegir cuenta —</option>
                  {(cuentas ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.identifier ? ` (${c.identifier})` : ''}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="%"
                  value={s.percent}
                  onChange={(e) => updateSocio(idx, { percent: e.target.value })}
                  className="w-24"
                />
                <Button type="button" size="icon" variant="ghost" onClick={() => removeSocio(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {hasSocios && (
              <p className={`text-xs ${sociosValid ? 'text-muted-foreground' : 'text-red-600'}`}>
                Suma: {(sumBps / 100).toFixed(2)}% {sociosValid ? '✓' : '(debe ser 100%)'}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={submit}
            disabled={isLoading || !name.trim() || (hasSocios && (!allSociosFilled || !sociosValid))}
          >
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
