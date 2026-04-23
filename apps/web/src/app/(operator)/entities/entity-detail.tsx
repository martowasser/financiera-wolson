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
import { ArrowLeft, Plus, Trash2, AlertTriangle, Check, Pencil } from 'lucide-react';
import { entityTypeLabels, label } from '@/lib/labels';

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

type Account = {
  id: string;
  name: string;
  path: string;
  type: string;
  currency: string;
  entityId: string;
};

type SociedadMember = {
  id: string;
  sociedadId: string;
  accountId: string;
  percentBps: number;
  account: Account;
};

type MemberValidation = {
  valid: boolean;
  breakdown: { currency: string; totalBps: number; valid: boolean }[];
};

type Props = {
  entityId: string;
  onBack: () => void;
};

export function EntityDetail({ entityId, onBack }: Props) {
  const [showOwnershipForm, setShowOwnershipForm] = useState(false);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [editMember, setEditMember] = useState<SociedadMember | null>(null);

  const { data: entity } = useQuery<Entity>(`/entities/${entityId}`);
  const { data: ownerships, refetch: refetchOwnerships } = useQuery<Ownership[]>(
    entity?.type === 'COMPANY' ? `/ownerships/entity/${entityId}` : null,
  );
  const { data: validation, refetch: refetchValidation } = useQuery<ValidationResult>(
    entity?.type === 'COMPANY' ? `/ownerships/entity/${entityId}/validate` : null,
  );
  const { data: members, refetch: refetchMembers } = useQuery<SociedadMember[]>(
    entity?.type === 'COMPANY' ? `/sociedad-members/sociedad/${entityId}` : null,
  );
  const { data: memberValidation, refetch: refetchMemberValidation } = useQuery<MemberValidation>(
    entity?.type === 'COMPANY' ? `/sociedad-members/sociedad/${entityId}/validate` : null,
  );
  const { data: allAccounts } = useQuery<Account[]>(
    entity?.type === 'COMPANY' ? '/accounts' : null,
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

  const handleMemberSaved = useCallback(() => {
    setShowMemberForm(false);
    setEditMember(null);
    refetchMembers();
    refetchMemberValidation();
  }, [refetchMembers, refetchMemberValidation]);

  const handleDeleteMember = useCallback(async (id: string) => {
    try {
      await apiFetch(`/sociedad-members/${id}`, { method: 'DELETE' });
      toast.success('Cuenta removida de la sociedad');
      refetchMembers();
      refetchMemberValidation();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error');
    }
  }, [refetchMembers, refetchMemberValidation]);

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

      <PageHeader title={entity.name} description={`${label(entityTypeLabels, entity.type)} ${entity.taxId ? `- ${entity.taxId}` : ''}`} />

      {entity.notes && (
        <p className="text-sm text-muted-foreground">{entity.notes}</p>
      )}

      {/* Ownership section — only meaningful for sociedades */}
      {entity.type === 'COMPANY' && (
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
      )}

      {entity.type === 'COMPANY' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Cuentas asociadas</CardTitle>
              {memberValidation && (
                memberValidation.valid ? (
                  <Badge variant="default" className="gap-1 bg-green-600">
                    <Check className="h-3 w-3" /> Suma 100%
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {memberValidation.breakdown.length === 0
                      ? 'Sin socios'
                      : memberValidation.breakdown
                          .map((b) => `${b.currency}: ${(b.totalBps / 100).toFixed(2)}%`)
                          .join(' · ')}
                  </Badge>
                )
              )}
            </div>
            <Button size="sm" onClick={() => setShowMemberForm(true)}>
              <Plus className="h-3 w-3 mr-1" /> Agregar cuenta
            </Button>
          </CardHeader>
          <CardContent>
            {!members || members.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No hay cuentas asociadas. Agregá las cuentas corrientes de los socios (con %) y los bancos propios de la sociedad (0%).
              </p>
            ) : (
              <div className="space-y-2">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={m.account.type === 'OWNER_CURRENT' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {m.account.type === 'OWNER_CURRENT' ? 'Socio' : 'Banco'}
                      </Badge>
                      <span className="font-medium text-sm">{m.account.name}</span>
                      <span className="text-xs text-muted-foreground">{m.account.currency}</span>
                      <Badge variant="outline" className="text-xs">
                        {(m.percentBps / 100).toFixed(2)}%
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      {m.account.type === 'OWNER_CURRENT' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditMember(m)}
                          title="Editar %"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteMember(m.id)}
                        title="Quitar"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <OwnershipFormDialog
        open={showOwnershipForm}
        entityId={entityId}
        entityOptions={entityOptions}
        onClose={() => setShowOwnershipForm(false)}
        onSaved={handleOwnershipSaved}
      />

      <SociedadMemberFormDialog
        open={showMemberForm}
        sociedadId={entityId}
        accounts={allAccounts ?? []}
        existingMemberAccountIds={(members ?? []).map((m) => m.accountId)}
        onClose={() => setShowMemberForm(false)}
        onSaved={handleMemberSaved}
      />

      <SociedadMemberEditDialog
        member={editMember}
        onClose={() => setEditMember(null)}
        onSaved={handleMemberSaved}
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

function SociedadMemberFormDialog({
  open,
  sociedadId,
  accounts,
  existingMemberAccountIds,
  onClose,
  onSaved,
}: {
  open: boolean;
  sociedadId: string;
  accounts: Account[];
  existingMemberAccountIds: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [accountId, setAccountId] = useState('');
  const [percentage, setPercentage] = useState('');
  const [saving, setSaving] = useState(false);

  const eligible = accounts.filter(
    (a) =>
      (a.type === 'OWNER_CURRENT' || a.type === 'BANK') &&
      !existingMemberAccountIds.includes(a.id),
  );

  const selected = eligible.find((a) => a.id === accountId) ?? null;
  const isBank = selected?.type === 'BANK';

  const options: ComboboxOption[] = eligible.map((a) => ({
    value: a.id,
    label: a.name,
    sublabel: `${a.type === 'OWNER_CURRENT' ? 'Socio' : 'Banco'} · ${a.currency}`,
  }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const pctValue = isBank ? 0 : Math.round(parseFloat(percentage) * 100);
    if (!isBank && (isNaN(pctValue) || pctValue <= 0 || pctValue > 10000)) {
      toast.error('Porcentaje debe ser entre 0.01% y 100%');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/sociedad-members', {
        method: 'POST',
        body: { sociedadId, accountId, percentBps: pctValue },
      });
      toast.success('Cuenta asociada');
      setAccountId('');
      setPercentage('');
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
            <DialogTitle>Asociar cuenta a la sociedad</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label>Cuenta *</Label>
              <Combobox
                options={options}
                value={accountId}
                onChange={setAccountId}
                placeholder="Seleccionar cuenta..."
                searchPlaceholder="Buscar..."
              />
              <p className="text-xs text-muted-foreground">
                Socios usan cuentas OWNER_CURRENT (con %). Bancos propios de la sociedad van al 0%.
              </p>
            </div>
            {!isBank && (
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
                  required={!isBank}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving || !accountId}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SociedadMemberEditDialog({
  member,
  onClose,
  onSaved,
}: {
  member: SociedadMember | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  if (!member) return null;
  return (
    <SociedadMemberEditDialogInner
      key={member.id}
      member={member}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function SociedadMemberEditDialogInner({
  member,
  onClose,
  onSaved,
}: {
  member: SociedadMember;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [percentage, setPercentage] = useState(() => (member.percentBps / 100).toFixed(2));
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const pctValue = Math.round(parseFloat(percentage) * 100);
    if (isNaN(pctValue) || pctValue < 0 || pctValue > 10000) {
      toast.error('Porcentaje debe ser entre 0% y 100%');
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/sociedad-members/${member.id}`, {
        method: 'PUT',
        body: { percentBps: pctValue },
      });
      toast.success('% actualizado');
      onSaved();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Editar % de {member.account.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label>Porcentaje (%) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Sólo afecta movimientos futuros. Los históricos mantienen el % con el que se distribuyeron.
              </p>
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
