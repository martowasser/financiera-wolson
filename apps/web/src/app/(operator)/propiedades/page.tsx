'use client';

import { useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@/lib/hooks';
import { formatApiError } from '@/lib/api-errors';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

type Sociedad = {
  id: string;
  name: string;
};

type Propiedad = {
  id: string;
  nombre: string;
  direccion: string;
  descripcion: string | null;
  isActive: boolean;
  deletedAt: string | null;
  sociedad: { id: string; name: string };
  _count: { alquileres: number };
};

export default function PropiedadesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const newOpen = searchParams.get('new') === '1';
  const [q, setQ] = useState('');
  const [sociedadId, setSociedadId] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const params = useMemo(() => {
    const p: Record<string, string | undefined> = {};
    if (q) p.q = q;
    if (sociedadId) p.sociedadId = sociedadId;
    if (!includeInactive) p.active = 'true';
    if (showArchived) p.showArchived = 'true';
    return p;
  }, [q, sociedadId, includeInactive, showArchived]);

  const { data: propiedades, isLoading, refetch } = useQuery<Propiedad[]>('/propiedades', params);
  const { data: sociedades } = useQuery<Sociedad[]>('/sociedades');

  const closeDialog = () => router.replace('/propiedades');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Propiedades"
        description="Inmuebles administrados por las sociedades"
        actions={
          <Link href="/propiedades?new=1">
            <Button size="sm"><Plus className="h-4 w-4" /> Nueva propiedad</Button>
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por nombre o dirección..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
        <select
          value={sociedadId}
          onChange={(e) => setSociedadId(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todas las sociedades</option>
          {(sociedades ?? []).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
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
              <th className="px-3 py-2 text-left font-medium">Dirección</th>
              <th className="px-3 py-2 text-left font-medium">Sociedad</th>
              <th className="px-3 py-2 text-right font-medium"># Alquileres</th>
              <th className="px-3 py-2 text-center font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="px-3 py-4 text-muted-foreground">Cargando…</td></tr>
            )}
            {propiedades && propiedades.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-4 text-muted-foreground">Sin propiedades.</td></tr>
            )}
            {(propiedades ?? []).map((p) => {
              const archived = !!p.deletedAt;
              return (
              <tr key={p.id} className={`border-b last:border-0 hover:bg-muted/30 ${archived ? 'opacity-50' : ''}`}>
                <td className="px-3 py-2">
                  <Link href={`/propiedades/${p.id}`} className="font-medium hover:underline">{p.nombre}</Link>
                  {archived && <span className="ml-2 text-xs text-muted-foreground">(archivada)</span>}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{p.direccion}</td>
                <td className="px-3 py-2">{p.sociedad.name}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">{p._count.alquileres}</td>
                <td className="px-3 py-2 text-center">
                  {p.isActive
                    ? <Badge variant="outline">Activa</Badge>
                    : <Badge variant="secondary">Inactiva</Badge>}
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>

      <PropiedadFormDialog
        open={newOpen}
        sociedades={sociedades ?? []}
        onClose={closeDialog}
        onSaved={() => { refetch(); closeDialog(); }}
      />
    </div>
  );
}

function PropiedadFormDialog({
  open,
  sociedades,
  onClose,
  onSaved,
}: {
  open: boolean;
  sociedades: Sociedad[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [sociedadId, setSociedadId] = useState('');
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [notes, setNotes] = useState('');
  const { mutate, isLoading } = useMutation<Record<string, string | undefined>, unknown>('/propiedades');

  async function submit() {
    if (!sociedadId || !nombre.trim() || !direccion.trim()) return;
    try {
      await mutate({
        sociedadId,
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        descripcion: descripcion.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success('Propiedad creada');
      setSociedadId(''); setNombre(''); setDireccion(''); setDescripcion(''); setNotes('');
      onSaved();
    } catch (e) {
      toast.error(formatApiError(e, 'Error al crear'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nueva propiedad</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="sociedadId">Sociedad</Label>
            <select
              id="sociedadId"
              value={sociedadId}
              onChange={(e) => setSociedadId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Seleccionar...</option>
              {sociedades.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
          </div>
          <div>
            <Label htmlFor="direccion">Dirección</Label>
            <Input id="direccion" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea id="descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} />
          </div>
          <div>
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={submit}
            disabled={isLoading || !sociedadId || !nombre.trim() || !direccion.trim()}
          >
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
