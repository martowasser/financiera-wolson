'use client';

import { useState, useCallback, useRef, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useQuery } from '@/lib/hooks';
import { apiFetch } from '@/lib/api';
import { formatMoney, formatDate, inputToCentavos } from '@/lib/format';
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
import { Plus, X, Receipt, DollarSign } from 'lucide-react';

type Invoice = {
  id: string;
  code: string;
  leaseId: string;
  periodMonth: number;
  periodYear: number;
  baseAmount: number;
  vatAmount: number;
  totalAmount: number;
  netAmount: number;
  status: string;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  lease?: {
    id: string;
    currency: string;
    property?: { name: string };
    tenant?: { name: string };
  };
  retentions?: { id: string; concept: string; amount: number; notes: string | null }[];
};

type Lease = {
  id: string;
  currency: string;
  baseAmount: number;
  property?: { name: string };
  tenant?: { name: string };
};

type Account = {
  id: string;
  name: string;
  path: string;
  currency: string;
  type: string;
};

const statusLabels: Record<string, string> = {
  PENDING: 'Pendiente',
  PAID: 'Cobrado',
  PARTIAL: 'Parcial',
  CANCELLED: 'Cancelado',
};
const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'outline',
  PAID: 'default',
  PARTIAL: 'secondary',
  CANCELLED: 'destructive',
};

export default function InvoicesPage() {
  const searchParams = useSearchParams();
  const showNewParam = searchParams.get('new') === '1';

  const [showForm, setShowForm] = useState(showNewParam);
  const [collectTarget, setCollectTarget] = useState<Invoice | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');

  const { data: invoices, isLoading, refetch } = useQuery<Invoice[]>('/invoices', {
    status: filterStatus || undefined,
  });

  const handleCreated = useCallback(() => {
    setShowForm(false);
    refetch();
  }, [refetch]);

  const handleCollected = useCallback(() => {
    setCollectTarget(null);
    refetch();
  }, [refetch]);

  const columns: Column<Invoice>[] = [
    { header: 'Codigo', accessor: (row) => (
      <Badge variant={statusVariants[row.status] || 'outline'} className="font-mono text-xs">
        {row.code}
      </Badge>
    ), className: 'w-28' },
    { header: 'Propiedad', accessor: (row) => row.lease?.property?.name || '-' },
    { header: 'Inquilino', accessor: (row) => row.lease?.tenant?.name || '-' },
    { header: 'Periodo', accessor: (row) => `${row.periodMonth}/${row.periodYear}`, className: 'w-24' },
    { header: 'Total', accessor: (row) => formatMoney(row.totalAmount, row.lease?.currency), className: 'w-32 text-right' },
    { header: 'Neto', accessor: (row) => formatMoney(row.netAmount, row.lease?.currency), className: 'w-32 text-right' },
    { header: 'Estado', accessor: (row) => (
      <Badge variant={statusVariants[row.status] || 'outline'}>
        {statusLabels[row.status] || row.status}
      </Badge>
    ), className: 'w-28' },
    { header: '', accessor: (row) => (
      row.status === 'PENDING' ? (
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => { e.stopPropagation(); setCollectTarget(row); }}
        >
          <DollarSign className="h-3 w-3 mr-1" /> Cobrar
        </Button>
      ) : null
    ), className: 'w-28' },
  ];

  return (
    <>
      <PageHeader
        title="Cobro de Alquileres"
        description="Generar facturas y registrar cobros"
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-1 h-4 w-4" /> Nueva Factura
          </Button>
        }
      />

      <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v ?? "")}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="PENDING">Pendiente</SelectItem>
          <SelectItem value="PAID">Cobrado</SelectItem>
          <SelectItem value="CANCELLED">Cancelado</SelectItem>
        </SelectContent>
      </Select>

      <DataTable
        columns={columns}
        data={invoices}
        isLoading={isLoading}
        rowKey={(r) => r.id}
        emptyMessage="No hay facturas."
      />

      {showForm && (
        <InvoiceFormDialog onClose={() => setShowForm(false)} onSaved={handleCreated} />
      )}

      {collectTarget && (
        <CollectDialog invoice={collectTarget} onClose={() => setCollectTarget(null)} onCollected={handleCollected} />
      )}
    </>
  );
}

// === Invoice Form ===
function InvoiceFormDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: leases } = useQuery<Lease[]>('/leases', { isActive: true });

  const [leaseId, setLeaseId] = useState('');
  const [periodMonth, setPeriodMonth] = useState(String(new Date().getMonth() + 1));
  const [periodYear, setPeriodYear] = useState(String(new Date().getFullYear()));
  const [baseAmount, setBaseAmount] = useState('');
  const [vatAmount, setVatAmount] = useState('');
  const [retentions, setRetentions] = useState<{ concept: string; amount: string }[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const retKeyRef = useRef(0);

  const leaseOptions: ComboboxOption[] = (leases || []).map((l) => ({
    value: l.id,
    label: `${l.property?.name} - ${l.tenant?.name}`,
    sublabel: `${formatMoney(l.baseAmount, l.currency)} ${l.currency}`,
  }));

  const selectedLease = leases?.find((l) => l.id === leaseId);

  // Auto-fill base amount from lease
  const handleLeaseChange = (id: string) => {
    setLeaseId(id);
    const lease = leases?.find((l) => l.id === id);
    if (lease) {
      setBaseAmount((Number(lease.baseAmount) / 100).toFixed(2));
    }
  };

  const addRetention = () => {
    setRetentions((prev) => [...prev, { concept: '', amount: '' }]);
  };

  const updateRetention = (idx: number, field: string, value: string) => {
    setRetentions((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const removeRetention = (idx: number) => {
    setRetentions((prev) => prev.filter((_, i) => i !== idx));
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/invoices', {
        method: 'POST',
        body: {
          leaseId,
          periodMonth: parseInt(periodMonth),
          periodYear: parseInt(periodYear),
          baseAmount: inputToCentavos(baseAmount),
          vatAmount: vatAmount ? inputToCentavos(vatAmount) : undefined,
          retentions: retentions.filter((r) => r.concept && r.amount).map((r) => ({
            concept: r.concept,
            amount: inputToCentavos(r.amount),
          })),
          notes: notes || undefined,
        },
      });
      toast.success('Factura creada');
      onSaved();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nueva Factura de Alquiler</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-1">
              <Label>Contrato *</Label>
              <Combobox options={leaseOptions} value={leaseId} onChange={handleLeaseChange} placeholder="Seleccionar contrato..." />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Mes *</Label>
                <Select value={periodMonth} onValueChange={(v) => setPeriodMonth(v ?? "")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        {new Date(2000, i).toLocaleDateString('es-AR', { month: 'long' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Año *</Label>
                <Input type="number" value={periodYear} onChange={(e) => setPeriodYear(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Monto Base *</Label>
                <Input type="number" step="0.01" min="0" value={baseAmount} onChange={(e) => setBaseAmount(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>IVA</Label>
                <Input type="number" step="0.01" min="0" value={vatAmount} onChange={(e) => setVatAmount(e.target.value)} placeholder="0.00" />
              </div>
            </div>

            {/* Retentions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Retenciones</Label>
                <Button type="button" variant="outline" size="sm" onClick={addRetention}>
                  <Plus className="h-3 w-3 mr-1" /> Retencion
                </Button>
              </div>
              {retentions.map((r, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    placeholder="Concepto (GANANCIAS, IIBB...)"
                    value={r.concept}
                    onChange={(e) => updateRetention(idx, 'concept', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Monto"
                    value={r.amount}
                    onChange={(e) => updateRetention(idx, 'amount', e.target.value)}
                    className="w-28"
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeRetention(idx)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <Label>Notas</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving || !leaseId}>
              {saving ? 'Creando...' : 'Crear Factura'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// === Collect Dialog ===
function CollectDialog({
  invoice,
  onClose,
  onCollected,
}: {
  invoice: Invoice;
  onClose: () => void;
  onCollected: () => void;
}) {
  const { data: accounts } = useQuery<Account[]>('/accounts');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [debitAccountId, setDebitAccountId] = useState('');
  const [creditAccountId, setCreditAccountId] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [bankReference, setBankReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const accountOptions: ComboboxOption[] = (accounts || []).map((a) => ({
    value: a.id,
    label: a.name,
    sublabel: `${a.path} (${a.currency})`,
  }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch(`/invoices/${invoice.id}/collect`, {
        method: 'POST',
        body: {
          paymentMethod,
          debitAccountId,
          creditAccountId,
          checkNumber: checkNumber || undefined,
          bankReference: bankReference || undefined,
          notes: notes || undefined,
        },
      });
      toast.success(`Factura ${invoice.code} cobrada`);
      onCollected();
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
            <DialogTitle>Cobrar {invoice.code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Card>
              <CardContent className="py-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-mono">{formatMoney(invoice.totalAmount, invoice.lease?.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Neto a cobrar</span>
                  <span className="font-mono font-medium">{formatMoney(invoice.netAmount, invoice.lease?.currency)}</span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-1">
              <Label>Medio de Pago</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v ?? "")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Efectivo</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Transferencia</SelectItem>
                  <SelectItem value="CHECK">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentMethod === 'CHECK' && (
              <div className="space-y-1">
                <Label>Numero de Cheque</Label>
                <Input value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} />
              </div>
            )}
            {paymentMethod === 'BANK_TRANSFER' && (
              <div className="space-y-1">
                <Label>Referencia Bancaria</Label>
                <Input value={bankReference} onChange={(e) => setBankReference(e.target.value)} />
              </div>
            )}

            <div className="space-y-1">
              <Label>Cuenta Debito (donde entra el dinero) *</Label>
              <Combobox options={accountOptions} value={debitAccountId} onChange={setDebitAccountId} placeholder="Ej: Efectivo ARS..." />
            </div>
            <div className="space-y-1">
              <Label>Cuenta Credito (ingreso) *</Label>
              <Combobox options={accountOptions} value={creditAccountId} onChange={setCreditAccountId} placeholder="Ej: Income:Rental..." />
            </div>

            <div className="space-y-1">
              <Label>Notas</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving || !debitAccountId || !creditAccountId}>
              {saving ? 'Cobrando...' : 'Registrar Cobro'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
