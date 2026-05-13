'use client';

import { useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@/lib/hooks';
import { formatApiError } from '@/lib/api-errors';
import { formatMoney } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

type Cuenta = {
  id: string;
  name: string;
  identifier: string | null;
  notes: string | null;
  saldoArs: string;
  saldoUsd: string;
  isActive: boolean;
  isOwner: boolean;
  deletedAt: string | null;
};

export default function CuentasPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const newOpen = searchParams.get('new') === '1';
  const [q, setQ] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const params = useMemo(() => {
    const p: Record<string, string | undefined> = {};
    if (q) p.q = q;
    if (!includeInactive) p.active = 'true';
    if (showArchived) p.showArchived = 'true';
    return p;
  }, [q, includeInactive, showArchived]);

  const { data: cuentas, isLoading, refetch } = useQuery<Cuenta[]>('/cuentas', params);

  const closeDialog = () => router.replace('/cuentas');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cuentas"
        description="Cuentas corrientes de socios, inquilinos y terceros"
        actions={
          <Link href="/cuentas?new=1">
            <Button size="sm"><Plus className="h-4 w-4" /> Nueva cuenta</Button>
          </Link>
        }
      />

      <div className="flex items-center gap-2">
        <Input
          placeholder="Buscar por nombre o identificador..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
        <Button
          variant={includeInactive ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setIncludeInactive((v) => !v)}
        >
          {includeInactive ? 'Mostrando inactivas' : 'Solo activas'}
        </Button>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <Checkbox checked={showArchived} onCheckedChange={(v) => setShowArchived(v === true)} />
          Mostrar archivadas
        </label>
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Nombre</th>
              <th className="px-3 py-2 text-left font-medium">Identificador</th>
              <th className="px-3 py-2 text-right font-medium">Saldo ARS</th>
              <th className="px-3 py-2 text-right font-medium">Saldo USD</th>
              <th className="px-3 py-2 text-center font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="px-3 py-4 text-muted-foreground">Cargando…</td></tr>
            )}
            {cuentas && cuentas.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-4 text-muted-foreground">Sin cuentas.</td></tr>
            )}
            {(cuentas ?? []).map((c) => {
              const archived = !!c.deletedAt;
              return (
              <tr key={c.id} className={`border-b last:border-0 hover:bg-muted/30 ${archived ? 'opacity-50' : ''}`}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Link href={`/cuentas/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                    {c.isOwner && <Badge>Cuenta de Alberto</Badge>}
                    {archived && <span className="text-xs text-muted-foreground">(archivada)</span>}
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{c.identifier ?? '—'}</td>
                <td className="px-3 py-2 text-right">
                  <span className={Number(c.saldoArs) < 0 ? 'text-red-600' : ''}>{formatMoney(c.saldoArs, 'ARS')}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className={Number(c.saldoUsd) < 0 ? 'text-red-600' : ''}>{formatMoney(c.saldoUsd, 'USD')}</span>
                </td>
                <td className="px-3 py-2 text-center">
                  {c.isActive
                    ? <Badge variant="outline">Activa</Badge>
                    : <Badge variant="secondary">Inactiva</Badge>}
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>

      <CuentaFormDialog open={newOpen} onClose={closeDialog} onSaved={() => { refetch(); closeDialog(); }} />
    </div>
  );
}

function CuentaFormDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [notes, setNotes] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const { mutate, isLoading } = useMutation<Record<string, unknown>, unknown>('/cuentas');

  async function submit() {
    if (!name.trim()) return;
    try {
      await mutate({
        name: name.trim(),
        identifier: identifier.trim() || undefined,
        notes: notes.trim() || undefined,
        isOwner,
      });
      toast.success(isOwner ? 'Cuenta creada y marcada como de Alberto' : 'Cuenta creada');
      setName(''); setIdentifier(''); setNotes(''); setIsOwner(false);
      onSaved();
    } catch (e) {
      toast.error(formatApiError(e, 'Error al crear'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nueva cuenta</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <Label htmlFor="identifier">Identificador (opcional)</Label>
            <Input id="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Ej: ALB, J27" />
          </div>
          <div>
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <div className="flex items-start justify-between gap-3 rounded-md border p-3">
            <div className="space-y-1">
              <Label htmlFor="new-isOwner" className="text-sm font-medium">Es cuenta de Alberto?</Label>
              <p className="text-xs text-muted-foreground">
                Marcar si esta cuenta pertenece a Alberto. Puede tener varias.
              </p>
            </div>
            <Switch id="new-isOwner" checked={isOwner} onCheckedChange={setIsOwner} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={isLoading || !name.trim()}>Crear</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
