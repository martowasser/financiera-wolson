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
import { Combobox, type ComboboxOption } from '@/components/combobox';
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

type Property = {
  id: string;
  name: string;
  address: string | null;
  type: string | null;
  notes: string | null;
  isActive: boolean;
  entityId: string;
  entity?: { id: string; name: string };
};

type Entity = { id: string; name: string; type: string };

const typeLabels: Record<string, string> = {
  APARTMENT: 'Departamento',
  COMMERCIAL: 'Comercial',
  OFFICE: 'Oficina',
  PARKING: 'Cochera',
  WAREHOUSE: 'Deposito',
  LAND: 'Terreno',
  OTHER: 'Otro',
};

export default function PropertiesPage() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);

  const { data: properties, isLoading, refetch } = useQuery<Property[]>('/properties', {
    search: search || undefined,
  });
  const { data: entities } = useQuery<Entity[]>('/entities');

  const entityOptions: ComboboxOption[] = (entities || []).map((e) => ({
    value: e.id,
    label: e.name,
    sublabel: e.type,
  }));

  const handleSaved = useCallback(() => {
    setShowForm(false);
    setEditing(null);
    refetch();
  }, [refetch]);

  const columns: Column<Property>[] = [
    { header: 'Nombre', accessor: (row) => (
      <div>
        <span className="font-medium">{row.name}</span>
        <span className="text-xs text-muted-foreground ml-2">{row.entity?.name}</span>
      </div>
    ) },
    { header: 'Direccion', accessor: (row) => row.address || '-' },
    { header: 'Tipo', accessor: (row) => (
      <Badge variant="outline" className="text-xs">
        {row.type ? (typeLabels[row.type] || row.type) : '-'}
      </Badge>
    ), className: 'w-28' },
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

  return (
    <>
      <PageHeader
        title="Propiedades"
        description="Inmuebles administrados"
        actions={
          <Button onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Nueva Propiedad
          </Button>
        }
      />

      <Input
        placeholder="Buscar propiedad..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-64"
      />

      <DataTable
        columns={columns}
        data={properties}
        isLoading={isLoading}
        rowKey={(r) => r.id}
        emptyMessage="No hay propiedades."
      />

      <PropertyFormDialog
        open={showForm}
        property={editing}
        entityOptions={entityOptions}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSaved={handleSaved}
      />
    </>
  );
}

function PropertyFormDialog({
  open,
  property,
  entityOptions,
  onClose,
  onSaved,
}: {
  open: boolean;
  property: Property | null;
  entityOptions: ComboboxOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!property;
  const [name, setName] = useState(property?.name || '');
  const [address, setAddress] = useState(property?.address || '');
  const [type, setType] = useState(property?.type || 'APARTMENT');
  const [entityId, setEntityId] = useState(property?.entityId || '');
  const [notes, setNotes] = useState(property?.notes || '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        name,
        address: address || null,
        type,
        entityId,
        notes: notes || null,
      };
      if (isEdit) {
        await apiFetch(`/properties/${property.id}`, { method: 'PUT', body });
        toast.success('Propiedad actualizada');
      } else {
        await apiFetch('/properties', { method: 'POST', body });
        toast.success('Propiedad creada');
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
            <DialogTitle>{isEdit ? 'Editar Propiedad' : 'Nueva Propiedad'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-1">
              <Label>Propietario *</Label>
              <Combobox
                options={entityOptions}
                value={entityId}
                onChange={setEntityId}
                placeholder="Seleccionar entidad..."
              />
            </div>
            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-1">
              <Label>Direccion</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v ?? "")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notas</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving || !entityId}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
