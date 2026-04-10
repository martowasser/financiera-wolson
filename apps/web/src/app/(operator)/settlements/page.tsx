'use client';

import { useState, useCallback, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useQuery } from '@/lib/hooks';
import { apiFetch } from '@/lib/api';
import { formatMoney, formatDate, toISODate } from '@/lib/format';
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
import { Plus, Check, ArrowLeft } from 'lucide-react';

type Settlement = {
  id: string;
  entityId: string;
  periodFrom: string;
  periodTo: string;
  currency: string;
  grossIncome: number;
  totalExpenses: number;
  netIncome: number;
  distributions: { ownerId: string; ownerName: string; percentage: number; amount: string }[];
  status: string;
  approvedAt: string | null;
  notes: string | null;
  createdAt: string;
  entity?: { name: string };
};

type Entity = { id: string; name: string; type: string };

const statusLabels: Record<string, string> = {
  DRAFT: 'Borrador',
  APPROVED: 'Aprobada',
  DISTRIBUTED: 'Distribuida',
};

export default function SettlementsPage() {
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');

  const { data: settlements, isLoading, refetch } = useQuery<Settlement[]>('/settlements', {
    status: filterStatus || undefined,
  });
  const { data: entities } = useQuery<Entity[]>('/entities');

  const entityOptions: ComboboxOption[] = (entities || [])
    .filter((e) => e.type === 'COMPANY')
    .map((e) => ({ value: e.id, label: e.name, sublabel: e.type }));

  const handleCreated = useCallback(() => {
    setShowForm(false);
    refetch();
  }, [refetch]);

  const columns: Column<Settlement>[] = [
    { header: 'Entidad', accessor: (row) => row.entity?.name || '-' },
    { header: 'Periodo', accessor: (row) => (
      `${formatDate(row.periodFrom)} - ${formatDate(row.periodTo)}`
    ) },
    { header: 'Moneda', accessor: 'currency', className: 'w-16' },
    { header: 'Ingreso Neto', accessor: (row) => (
      <span className="font-mono">{formatMoney(row.netIncome, row.currency)}</span>
    ), className: 'w-36 text-right' },
    { header: 'Estado', accessor: (row) => (
      <Badge variant={row.status === 'APPROVED' ? 'default' : row.status === 'DISTRIBUTED' ? 'secondary' : 'outline'}>
        {statusLabels[row.status] || row.status}
      </Badge>
    ), className: 'w-28' },
  ];

  if (detailId) {
    const s = settlements?.find((s) => s.id === detailId);
    return (
      <SettlementDetail
        settlement={s || null}
        onBack={() => setDetailId(null)}
        onApproved={refetch}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Liquidacion de Socios"
        description="Calculo y distribucion de resultados"
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-1 h-4 w-4" /> Nueva Liquidacion
          </Button>
        }
      />

      <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v ?? "")}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="DRAFT">Borrador</SelectItem>
          <SelectItem value="APPROVED">Aprobada</SelectItem>
          <SelectItem value="DISTRIBUTED">Distribuida</SelectItem>
        </SelectContent>
      </Select>

      <DataTable
        columns={columns}
        data={settlements}
        isLoading={isLoading}
        rowKey={(r) => r.id}
        onRowClick={(r) => setDetailId(r.id)}
        emptyMessage="No hay liquidaciones."
      />

      {showForm && (
        <SettlementFormDialog
          entityOptions={entityOptions}
          onClose={() => setShowForm(false)}
          onSaved={handleCreated}
        />
      )}
    </>
  );
}

function SettlementDetail({
  settlement,
  onBack,
  onApproved,
}: {
  settlement: Settlement | null;
  onBack: () => void;
  onApproved: () => void;
}) {
  const [approving, setApproving] = useState(false);

  if (!settlement) return <p className="text-muted-foreground">Liquidacion no encontrada.</p>;

  async function handleApprove() {
    setApproving(true);
    try {
      await apiFetch(`/settlements/${settlement!.id}/approve`, { method: 'POST' });
      toast.success('Liquidacion aprobada');
      onApproved();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error');
    } finally {
      setApproving(false);
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver
      </Button>

      <PageHeader
        title={`Liquidacion — ${settlement.entity?.name}`}
        description={`${formatDate(settlement.periodFrom)} - ${formatDate(settlement.periodTo)} | ${settlement.currency}`}
        actions={
          settlement.status === 'DRAFT' ? (
            <Button onClick={handleApprove} disabled={approving}>
              <Check className="h-4 w-4 mr-1" /> {approving ? 'Aprobando...' : 'Aprobar'}
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ingresos Brutos</span>
              <span className="font-mono">{formatMoney(settlement.grossIncome, settlement.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gastos Totales</span>
              <span className="font-mono text-red-600">{formatMoney(settlement.totalExpenses, settlement.currency)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-medium">
              <span>Ingreso Neto</span>
              <span className="font-mono">{formatMoney(settlement.netIncome, settlement.currency)}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-muted-foreground">Estado</span>
              <Badge variant={settlement.status === 'APPROVED' ? 'default' : 'outline'}>
                {statusLabels[settlement.status]}
              </Badge>
            </div>
            {settlement.notes && (
              <p className="text-muted-foreground pt-2 border-t">{settlement.notes}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Distribucion entre Socios</CardTitle>
          </CardHeader>
          <CardContent>
            {!settlement.distributions || settlement.distributions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Sin distribuciones.</p>
            ) : (
              <div className="space-y-2">
                {settlement.distributions.map((d) => (
                  <div key={d.ownerId} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{d.ownerName}</span>
                      <Badge variant="secondary" className="text-xs">{(d.percentage / 100).toFixed(2)}%</Badge>
                    </div>
                    <span className="font-mono">{formatMoney(d.amount, settlement.currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function SettlementFormDialog({
  entityOptions,
  onClose,
  onSaved,
}: {
  entityOptions: ComboboxOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [entityId, setEntityId] = useState('');
  const [periodFrom, setPeriodFrom] = useState(toISODate(firstOfMonth));
  const [periodTo, setPeriodTo] = useState(toISODate(lastOfMonth));
  const [currency, setCurrency] = useState('ARS');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/settlements', {
        method: 'POST',
        body: { entityId, periodFrom, periodTo, currency, notes: notes || undefined },
      });
      toast.success('Liquidacion calculada');
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
            <DialogTitle>Nueva Liquidacion</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-1">
              <Label>Entidad (Sociedad) *</Label>
              <Combobox options={entityOptions} value={entityId} onChange={setEntityId} placeholder="Seleccionar sociedad..." />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Desde *</Label>
                <Input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>Hasta *</Label>
                <Input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} required />
              </div>
            </div>
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
              <Label>Notas</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving || !entityId}>
              {saving ? 'Calculando...' : 'Calcular Liquidacion'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
