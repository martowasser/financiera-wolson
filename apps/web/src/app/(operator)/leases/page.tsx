'use client';

import { useState, useCallback, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useQuery } from '@/lib/hooks';
import { apiFetch } from '@/lib/api';
import { formatMoney, formatDate, centavosToInput, inputToCentavos } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Combobox, type ComboboxOption } from '@/components/combobox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Plus, ArrowLeft, DollarSign } from 'lucide-react';

type Lease = {
  id: string;
  propertyId: string;
  tenantId: string;
  currency: string;
  baseAmount: number;
  managedBy: string;
  thirdPartyEntityId: string | null;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  notes: string | null;
  property?: { id: string; name: string };
  tenant?: { id: string; name: string };
  thirdParty?: { id: string; name: string } | null;
  priceHistory?: LeasePrice[];
};

type LeasePrice = {
  id: string;
  amount: number;
  validFrom: string;
  validUntil: string | null;
};

type Entity = { id: string; name: string; type: string };
type Property = { id: string; name: string; entityId: string; entity?: { name: string } };

export default function LeasesPage() {
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: leases, isLoading, refetch } = useQuery<Lease[]>('/leases');
  const { data: entities } = useQuery<Entity[]>('/entities');
  const { data: properties } = useQuery<Property[]>('/properties');

  const entityOptions: ComboboxOption[] = (entities || []).map((e) => ({
    value: e.id, label: e.name, sublabel: e.type,
  }));
  const propertyOptions: ComboboxOption[] = (properties || []).map((p) => ({
    value: p.id, label: p.name, sublabel: p.entity?.name,
  }));

  const handleSaved = useCallback(() => {
    setShowForm(false);
    refetch();
  }, [refetch]);

  const columns: Column<Lease>[] = [
    { header: 'Propiedad', accessor: (row) => row.property?.name || '-' },
    { header: 'Inquilino', accessor: (row) => row.tenant?.name || '-' },
    { header: 'Monto', accessor: (row) => formatMoney(row.baseAmount, row.currency), className: 'w-32 text-right' },
    { header: 'Tipo', accessor: (row) => (
      <Badge variant={row.managedBy === 'DIRECT' ? 'default' : 'secondary'} className="text-xs">
        {row.managedBy === 'DIRECT' ? 'Directo' : 'Tercero'}
      </Badge>
    ), className: 'w-24' },
    { header: 'Desde', accessor: (row) => formatDate(row.startDate), className: 'w-28' },
    { header: 'Estado', accessor: (row) => (
      <Badge variant={row.isActive ? 'default' : 'secondary'}>
        {row.isActive ? 'Activo' : 'Inactivo'}
      </Badge>
    ), className: 'w-24' },
  ];

  if (detailId) {
    return (
      <LeaseDetail
        leaseId={detailId}
        onBack={() => setDetailId(null)}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Contratos de Alquiler"
        description="Leases con historial de precios"
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-1 h-4 w-4" /> Nuevo Contrato
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={leases}
        isLoading={isLoading}
        rowKey={(r) => r.id}
        onRowClick={(r) => setDetailId(r.id)}
        emptyMessage="No hay contratos."
      />

      <LeaseFormDialog
        open={showForm}
        entityOptions={entityOptions}
        propertyOptions={propertyOptions}
        onClose={() => setShowForm(false)}
        onSaved={handleSaved}
      />
    </>
  );
}

function LeaseDetail({ leaseId, onBack }: { leaseId: string; onBack: () => void }) {
  const { data: lease, refetch } = useQuery<Lease>(`/leases/${leaseId}`);
  const [showPriceForm, setShowPriceForm] = useState(false);

  const handlePriceSaved = useCallback(() => {
    setShowPriceForm(false);
    refetch();
  }, [refetch]);

  if (!lease) return null;

  return (
    <>
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver
      </Button>

      <PageHeader
        title={`${lease.property?.name} - ${lease.tenant?.name}`}
        description={`${lease.managedBy === 'DIRECT' ? 'Directo' : 'Rendido por tercero'}${lease.thirdParty ? ` (${lease.thirdParty.name})` : ''} | ${lease.currency}`}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Detalles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monto Base</span>
              <span className="font-mono">{formatMoney(lease.baseAmount, lease.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Inicio</span>
              <span>{formatDate(lease.startDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fin</span>
              <span>{lease.endDate ? formatDate(lease.endDate) : 'Indefinido'}</span>
            </div>
            {lease.notes && <p className="text-muted-foreground pt-2 border-t">{lease.notes}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Historial de Precios
            </CardTitle>
            <Button size="sm" onClick={() => setShowPriceForm(true)}>
              <Plus className="h-3 w-3 mr-1" /> Nuevo Precio
            </Button>
          </CardHeader>
          <CardContent>
            {!lease.priceHistory || lease.priceHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Sin historial.</p>
            ) : (
              <div className="space-y-2">
                {lease.priceHistory.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div>
                      <span>{formatDate(p.validFrom)}</span>
                      {p.validUntil && (
                        <span className="text-muted-foreground"> - {formatDate(p.validUntil)}</span>
                      )}
                    </div>
                    <span className="font-mono font-medium">{formatMoney(p.amount, lease.currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {showPriceForm && (
        <PriceFormDialog
          leaseId={leaseId}
          currency={lease.currency}
          onClose={() => setShowPriceForm(false)}
          onSaved={handlePriceSaved}
        />
      )}
    </>
  );
}

function LeaseFormDialog({
  open,
  entityOptions,
  propertyOptions,
  onClose,
  onSaved,
}: {
  open: boolean;
  entityOptions: ComboboxOption[];
  propertyOptions: ComboboxOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [propertyId, setPropertyId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [currency, setCurrency] = useState('ARS');
  const [baseAmount, setBaseAmount] = useState('');
  const [managedBy, setManagedBy] = useState('DIRECT');
  const [thirdPartyEntityId, setThirdPartyEntityId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/leases', {
        method: 'POST',
        body: {
          propertyId,
          tenantId,
          currency,
          baseAmount: inputToCentavos(baseAmount),
          managedBy,
          thirdPartyEntityId: managedBy === 'THIRD_PARTY' ? thirdPartyEntityId : null,
          startDate,
          notes: notes || null,
        },
      });
      toast.success('Contrato creado');
      onSaved();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nuevo Contrato</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-1">
              <Label>Propiedad *</Label>
              <Combobox options={propertyOptions} value={propertyId} onChange={setPropertyId} placeholder="Seleccionar propiedad..." />
            </div>
            <div className="space-y-1">
              <Label>Inquilino *</Label>
              <Combobox options={entityOptions} value={tenantId} onChange={setTenantId} placeholder="Seleccionar inquilino..." />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Moneda</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v ?? "")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">ARS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Monto Base *</Label>
                <Input type="number" step="0.01" min="0" value={baseAmount} onChange={(e) => setBaseAmount(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Tipo de Gestion</Label>
              <Select value={managedBy} onValueChange={(v) => setManagedBy(v ?? "")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIRECT">Directo</SelectItem>
                  <SelectItem value="THIRD_PARTY">Rendido por Tercero</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {managedBy === 'THIRD_PARTY' && (
              <div className="space-y-1">
                <Label>Tercero *</Label>
                <Combobox options={entityOptions} value={thirdPartyEntityId} onChange={setThirdPartyEntityId} placeholder="Seleccionar..." />
              </div>
            )}
            <div className="space-y-1">
              <Label>Fecha Inicio *</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Notas</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving || !propertyId || !tenantId}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PriceFormDialog({
  leaseId,
  currency,
  onClose,
  onSaved,
}: {
  leaseId: string;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch(`/leases/${leaseId}/prices`, {
        method: 'POST',
        body: {
          amount: inputToCentavos(amount),
          validFrom,
        },
      });
      toast.success('Precio actualizado');
      onSaved();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nuevo Precio ({currency})</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-1">
              <Label>Monto *</Label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-1">
              <Label>Vigente Desde *</Label>
              <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} required />
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
