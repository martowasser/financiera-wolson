'use client';

import { useState, useCallback, useMemo, useRef, type FormEvent, type RefObject } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useQuery } from '@/lib/hooks';
import { useKeyboardShortcuts } from '@/lib/shortcuts/use-keyboard-shortcuts';
import type { Shortcut } from '@/lib/shortcuts/types';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

type TabValue = 'sociedades' | 'personas';

const typeLabels: Record<string, string> = {
  COMPANY: 'Sociedad',
  PERSON: 'Persona',
  FIRM: 'Financiera',
  THIRD_PARTY: 'Tercero',
};

// Spanish gendered article for "Nueva/Nuevo {tipo}".
const typeArticle: Record<string, string> = {
  COMPANY: 'Nueva',
  PERSON: 'Nueva',
  FIRM: 'Nueva',
  THIRD_PARTY: 'Nuevo',
};

const tabDefaultType: Record<TabValue, string> = {
  sociedades: 'COMPANY',
  personas: 'PERSON',
};

const tabDescription: Record<TabValue, string> = {
  sociedades: 'Empresas y sociedades',
  personas: 'Personas físicas, financieras y terceros',
};

export default function EntitiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showNew = searchParams.get('new') === '1';
  const detailId = searchParams.get('id');
  const tabParam = searchParams.get('tab');
  const activeTab: TabValue = tabParam === 'personas' ? 'personas' : 'sociedades';

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Entity | null>(null);
  const [refetchTick, setRefetchTick] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Derived — the form is open when either ?new=1 (URL-driven from cmd+k etc.),
  // the user clicked the create button locally, or a row is being edited.
  const showForm = showNew || createOpen || editing !== null;

  const closeForm = useCallback(() => {
    setCreateOpen(false);
    setEditing(null);
    if (showNew) {
      router.replace(`/entities?tab=${activeTab}`);
    }
  }, [router, activeTab, showNew]);

  const handleCreateClick = useCallback(() => {
    setEditing(null);
    setCreateOpen(true);
  }, []);

  const handleTabChange = useCallback(
    (v: string | null) => {
      const next: TabValue = v === 'personas' ? 'personas' : 'sociedades';
      if (next !== activeTab) router.push(`/entities?tab=${next}`);
    },
    [router, activeTab],
  );

  const openDetail = useCallback(
    (id: string) => router.push(`/entities?id=${id}`),
    [router],
  );

  const closeDetail = useCallback(() => {
    // "Volver" pops history so users arriving from another page (cmd+k from
    // /dashboard, say) land back where they came from. If there's no history
    // to pop (direct link), fall back to the list with the active tab.
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/entities?tab=${activeTab}`);
    }
  }, [router, activeTab]);

  const defaultType = tabDefaultType[activeTab];
  const newLabel = activeTab === 'sociedades' ? 'Nueva Sociedad' : 'Nueva Persona';

  const shortcuts = useMemo<Shortcut[]>(
    () => [
      {
        id: 'entity-create',
        keys: ['c'],
        label: newLabel,
        group: 'Sociedades',
        when: () => !detailId && !showForm,
        run: handleCreateClick,
      },
      {
        id: 'entity-focus-search',
        keys: ['/'],
        label: 'Buscar',
        group: 'Sociedades',
        when: () => !detailId && !showForm,
        run: () => searchInputRef.current?.focus(),
      },
    ],
    [detailId, showForm, newLabel, handleCreateClick],
  );
  useKeyboardShortcuts(shortcuts);

  const handleSaved = useCallback(() => {
    setCreateOpen(false);
    setEditing(null);
    if (showNew) router.replace(`/entities?tab=${activeTab}`);
    setRefetchTick((t) => t + 1);
  }, [router, activeTab, showNew]);

  if (detailId) {
    return <EntityDetail entityId={detailId} onBack={closeDetail} />;
  }

  return (
    <>
      <PageHeader
        title="Sociedades y Personas"
        description={tabDescription[activeTab]}
        actions={
          <Button onClick={handleCreateClick}>
            <Plus className="mr-1 h-4 w-4" /> {newLabel}
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="sociedades">Sociedades</TabsTrigger>
          <TabsTrigger value="personas">Personas</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Keyed so switching tabs remounts the list and resets local search. */}
      <EntityList
        key={activeTab}
        activeTab={activeTab}
        refetchTick={refetchTick}
        searchInputRef={searchInputRef}
        onOpenDetail={openDetail}
        onEdit={setEditing}
      />

      <EntityFormDialog
        key={editing?.id ?? `new-${defaultType}`}
        open={showForm}
        entity={editing}
        defaultType={defaultType}
        onClose={closeForm}
        onSaved={handleSaved}
      />
    </>
  );
}

function EntityList({
  activeTab,
  refetchTick,
  searchInputRef,
  onOpenDetail,
  onEdit,
}: {
  activeTab: TabValue;
  refetchTick: number;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onOpenDetail: (id: string) => void;
  onEdit: (row: Entity) => void;
}) {
  const [search, setSearch] = useState('');

  const queryParams = activeTab === 'sociedades'
    ? { type: 'COMPANY', search: search || undefined, _t: refetchTick }
    : { onlyPersonas: true, search: search || undefined, _t: refetchTick };

  const { data: entities, isLoading } = useQuery<Entity[]>('/entities', queryParams);

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
        onClick={(e) => { e.stopPropagation(); onEdit(row); }}
      >
        <Pencil className="h-3 w-3" />
      </Button>
    ), className: 'w-12' },
  ];

  return (
    <>
      <Input
        ref={searchInputRef}
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
        onRowClick={(r) => onOpenDetail(r.id)}
        emptyMessage={activeTab === 'sociedades' ? 'No hay sociedades.' : 'No hay personas.'}
      />
    </>
  );
}

function EntityFormDialog({
  open,
  entity,
  defaultType = 'COMPANY',
  onClose,
  onSaved,
}: {
  open: boolean;
  entity: Entity | null;
  defaultType?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(entity?.name || '');
  const [type, setType] = useState(entity?.type || defaultType);
  const [taxId, setTaxId] = useState(entity?.taxId || '');
  const [notes, setNotes] = useState(entity?.notes || '');
  const [saving, setSaving] = useState(false);

  const isEdit = !!entity;
  const typeLabel = typeLabels[type] || 'Entidad';
  const title = isEdit
    ? `Editar ${typeLabel}`
    : `${typeArticle[type] ?? 'Nueva'} ${typeLabel}`;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await apiFetch(`/entities/${entity.id}`, {
          method: 'PUT',
          body: { name, type, taxId: taxId || null, notes: notes || null },
        });
        toast.success(`${typeLabel} actualizada`);
      } else {
        await apiFetch('/entities', {
          method: 'POST',
          body: { name, type, taxId: taxId || null, notes: notes || null },
        });
        toast.success(`${typeLabel} creada`);
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
            <DialogTitle>{title}</DialogTitle>
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
                <SelectTrigger><SelectValue labels={typeLabels} /></SelectTrigger>
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
