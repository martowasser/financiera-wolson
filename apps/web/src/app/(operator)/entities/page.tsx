'use client';

import { useState, useCallback, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useQuery } from '@/lib/hooks';
import { apiFetch } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil } from 'lucide-react';
import { EntityDetail } from './entity-detail';

type Entity = {
  id: string;
  name: string;
  type: string;
  taxId: string | null;
  notes: string | null;
  isActive: boolean;
};

const typeLabels: Record<string, string> = {
  COMPANY: 'Sociedad',
  PERSON: 'Persona',
  FIRM: 'Financiera',
  THIRD_PARTY: 'Tercero',
};

export default function EntitiesPage() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Entity | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: entities, isLoading, refetch } = useQuery<Entity[]>('/entities', {
    search: search || undefined,
  });

  const handleSaved = useCallback(() => {
    setShowForm(false);
    setEditing(null);
    refetch();
  }, [refetch]);

  const columns: Column<Entity>[] = [
    { header: 'Nombre', accessor: 'name' },
    { header: 'Tipo', accessor: (row) => (
      <Badge variant="outline">{typeLabels[row.type] || row.type}</Badge>
    ), className: 'w-28' },
    { header: 'CUIT/CUIL', accessor: (row) => row.taxId || '-', className: 'w-36' },
    { header: 'Estado', accessor: (row) => (
      <Badge variant={row.isActive ? 'default' : 'secondary'}>
        {row.isActive ? 'Activa' : 'Inactiva'}
      </Badge>
    ), className: 'w-24' },
    { header: '', accessor: (row) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => { e.stopPropagation(); setEditing(row); setShowForm(true); }}
      >
        <Pencil className="h-3 w-3" />
      </Button>
    ), className: 'w-12' },
  ];

  if (detailId) {
    return (
      <EntityDetail
        entityId={detailId}
        onBack={() => setDetailId(null)}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Sociedades"
        description="Sociedades, personas y terceros"
        actions={
          <Button onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Nueva Sociedad
          </Button>
        }
      />

      <Input
        placeholder="Buscar..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-64"
      />

      <DataTable
        columns={columns}
        data={entities}
        isLoading={isLoading}
        rowKey={(r) => r.id}
        onRowClick={(r) => setDetailId(r.id)}
        emptyMessage="No hay sociedades."
      />

      <EntityFormDialog
        open={showForm}
        entity={editing}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSaved={handleSaved}
      />
    </>
  );
}

function EntityFormDialog({
  open,
  entity,
  onClose,
  onSaved,
}: {
  open: boolean;
  entity: Entity | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(entity?.name || '');
  const [type, setType] = useState(entity?.type || 'COMPANY');
  const [taxId, setTaxId] = useState(entity?.taxId || '');
  const [notes, setNotes] = useState(entity?.notes || '');
  const [saving, setSaving] = useState(false);

  // Reset form when entity changes
  const isEdit = !!entity;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await apiFetch(`/entities/${entity.id}`, {
          method: 'PUT',
          body: { name, type, taxId: taxId || null, notes: notes || null },
        });
        toast.success('Sociedad actualizada');
      } else {
        await apiFetch('/entities', {
          method: 'POST',
          body: { name, type, taxId: taxId || null, notes: notes || null },
        });
        toast.success('Sociedad creada');
      }
      onSaved();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Editar Sociedad' : 'Nueva Sociedad'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v ?? "")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMPANY">Sociedad</SelectItem>
                  <SelectItem value="PERSON">Persona</SelectItem>
                  <SelectItem value="FIRM">Financiera</SelectItem>
                  <SelectItem value="THIRD_PARTY">Tercero</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>CUIT/CUIL</Label>
              <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Notas</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
