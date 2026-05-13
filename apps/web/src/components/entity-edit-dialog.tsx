'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatApiError } from '@/lib/api-errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

export type EntityField = 'name' | 'notes';

type EntityFieldConfig = {
  // Algunos modelos tienen `nombre` en lugar de `name`. Lo dejamos configurable.
  nameKey?: 'name' | 'nombre';
  // Si false, oculta el input de nombre (caso alquiler: solo notas).
  showName?: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  endpoint: string;        // ej "/sociedades/{id}"
  current: {
    name?: string;
    nombre?: string;
    notes: string | null;
  };
  // Etiqueta de la entidad para el title del dialog. Ej "sociedad".
  entityLabel: string;
  config?: EntityFieldConfig;
  onSaved?: () => void;
  // A dónde navegar después de archivar. Default: una página up via router.back().
  archiveRedirectTo?: string;
};

export function EntityEditDialog({
  open,
  onOpenChange,
  endpoint,
  current,
  entityLabel,
  config,
  onSaved,
  archiveRedirectTo,
}: Props) {
  const router = useRouter();
  const nameKey = config?.nameKey ?? 'name';
  const showName = config?.showName !== false;
  const initialName = (current[nameKey] as string | undefined) ?? '';
  const [name, setName] = useState(initialName);
  const [notes, setNotes] = useState(current.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setNotes(current.notes ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (showName) body[nameKey] = name.trim();
      body.notes = notes.trim() || null;
      await apiFetch(endpoint, { method: 'PUT', body });
      toast.success(`${capitalize(entityLabel)} actualizado`);
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    setArchiving(true);
    try {
      await apiFetch(endpoint, { method: 'DELETE' });
      toast.success(`${capitalize(entityLabel)} archivado`);
      setArchiveOpen(false);
      onOpenChange(false);
      if (archiveRedirectTo) router.push(archiveRedirectTo);
      else router.back();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setArchiving(false);
    }
  }

  const canSave = showName ? name.trim().length > 0 : true;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar {entityLabel}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {showName && (
              <div>
                <Label>Nombre</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}
            <div>
              <Label>Notas</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
            </div>
          </div>
          <DialogFooter className="justify-between">
            <Button variant="destructive" onClick={() => setArchiveOpen(true)} disabled={saving}>
              Archivar
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving || !canSave}>Guardar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archivar {entityLabel}</AlertDialogTitle>
            <AlertDialogDescription>
              Va a dejar de aparecer en los listados y en los pickers de nuevos
              movimientos. La historia que la referencia se conserva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={archive} disabled={archiving}>
              {archiving ? 'Archivando…' : 'Archivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
