'use client';

import { useState, useCallback, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useQuery } from '@/lib/hooks';
import { apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox, type ComboboxOption } from '@/components/combobox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ArrowLeft, Plus, Trash2, AlertTriangle, Check } from 'lucide-react';

type Entity = {
  id: string;
  name: string;
  type: string;
  taxId: string | null;
  notes: string | null;
};

type Ownership = {
  id: string;
  entityId: string;
  ownerId: string;
  percentage: number;
  validFrom: string;
  validUntil: string | null;
  owner: { id: string; name: string };
};

type ValidationResult = {
  valid: boolean;
  totalPercentage: number;
  count: number;
};

type Props = {
  entityId: string;
  onBack: () => void;
};

export function EntityDetail({ entityId, onBack }: Props) {
  const [showOwnershipForm, setShowOwnershipForm] = useState(false);

  const { data: entity } = useQuery<Entity>(`/entities/${entityId}`);
  const { data: ownerships, refetch: refetchOwnerships } = useQuery<Ownership[]>(
    `/ownerships/entity/${entityId}`,
  );
  const { data: validation, refetch: refetchValidation } = useQuery<ValidationResult>(
    `/ownerships/entity/${entityId}/validate`,
  );
  const { data: allEntities } = useQuery<Entity[]>('/entities');

  const entityOptions: ComboboxOption[] = (allEntities || [])
    .filter((e) => e.id !== entityId)
    .map((e) => ({
      value: e.id,
      label: e.name,
      sublabel: e.type,
    }));

  const handleOwnershipSaved = useCallback(() => {
    setShowOwnershipForm(false);
    refetchOwnerships();
    refetchValidation();
  }, [refetchOwnerships, refetchValidation]);

  const handleDeleteOwnership = useCallback(async (id: string) => {
    try {
      await apiFetch(`/ownerships/${id}`, { method: 'DELETE' });
      toast.success('Socio desactivado');
      refetchOwnerships();
      refetchValidation();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error');
    }
  }, [refetchOwnerships, refetchValidation]);

  if (!entity) return null;

  const isValid = validation?.valid ?? false;
  const totalPct = (validation?.totalPercentage ?? 0) / 100;

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
      </div>

      <PageHeader title={entity.name} description={`${entity.type} ${entity.taxId ? `- ${entity.taxId}` : ''}`} />

      {entity.notes && (
        <p className="text-sm text-muted-foreground">{entity.notes}</p>
      )}

      {/* Ownership section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Socios / Ownership</CardTitle>
            {isValid ? (
              <Badge variant="default" className="gap-1 bg-green-600">
                <Check className="h-3 w-3" /> {totalPct}%
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> {totalPct}% (debe ser 100%)
              </Badge>
            )}
          </div>
          <Button size="sm" onClick={() => setShowOwnershipForm(true)}>
            <Plus className="h-3 w-3 mr-1" /> Agregar Socio
          </Button>
        </CardHeader>
        <CardContent>
          {(!ownerships || ownerships.length === 0) ? (
            <p className="text-sm text-muted-foreground py-4">No hay socios configurados.</p>
          ) : (
            <div className="space-y-2">
              {ownerships.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">{o.owner.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {(o.percentage / 100).toFixed(2)}%
                    </Badge>
                    {o.validUntil && (
                      <span className="text-xs text-muted-foreground">
                        hasta {formatDate(o.validUntil)}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteOwnership(o.id)}
                    title="Desactivar"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <OwnershipFormDialog
        open={showOwnershipForm}
        entityId={entityId}
        entityOptions={entityOptions}
        onClose={() => setShowOwnershipForm(false)}
        onSaved={handleOwnershipSaved}
      />
    </>
  );
}

function OwnershipFormDialog({
  open,
  entityId,
  entityOptions,
  onClose,
  onSaved,
}: {
  open: boolean;
  entityId: string;
  entityOptions: ComboboxOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [ownerId, setOwnerId] = useState('');
  const [percentage, setPercentage] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const pctValue = Math.round(parseFloat(percentage) * 100);
    if (isNaN(pctValue) || pctValue <= 0 || pctValue > 10000) {
      toast.error('Porcentaje debe ser entre 0.01% y 100%');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/ownerships', {
        method: 'POST',
        body: { entityId, ownerId, percentage: pctValue },
      });
      toast.success('Socio agregado');
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
            <DialogTitle>Agregar Socio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label>Socio *</Label>
              <Combobox
                options={entityOptions}
                value={ownerId}
                onChange={setOwnerId}
                placeholder="Seleccionar socio..."
                searchPlaceholder="Buscar..."
              />
            </div>
            <div className="space-y-1">
              <Label>Porcentaje (%) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                placeholder="50.00"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving || !ownerId}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
