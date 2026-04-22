'use client';

import { useState, useCallback, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useQuery } from '@/lib/hooks';
import { apiFetch } from '@/lib/api';
import { formatMoney, formatDate, toISODate, inputToCentavos } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox, type ComboboxOption } from '@/components/combobox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, ArrowLeft, Check, Link2, Layers } from 'lucide-react';

type Reconciliation = {
  id: string;
  accountId: string;
  date: string;
  status: string;
  bankBalance: number;
  systemBalance: number | null;
  difference: number | null;
  notes: string | null;
  account?: { id: string; name: string; currency: string };
  items?: ReconciliationItem[];
};

type ReconciliationItem = {
  id: string;
  description: string;
  bankAmount: number;
  systemAmount: number | null;
  isReconciled: boolean;
  transactionId: string | null;
  groupLabel: string | null;
  notes: string | null;
};

type Account = {
  id: string;
  name: string;
  path: string;
  currency: string;
  type: string;
};

type Transaction = {
  id: string;
  code: string;
  description: string;
  type: string;
  status: string;
  entries: { amount: number; type: string; account: { id: string; currency: string } }[];
};

const statusColors: Record<string, string> = {
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  COMPLETED: 'bg-green-100 text-green-800 border-green-200',
  DISCREPANCY: 'bg-red-100 text-red-800 border-red-200',
};

export default function ReconciliationPage() {
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: reconciliations, isLoading, refetch } = useQuery<Reconciliation[]>('/reconciliations');
  const { data: accounts } = useQuery<Account[]>('/accounts', { type: 'BANK' });

  const bankAccountOptions: ComboboxOption[] = (accounts || []).map((a) => ({
    value: a.id, label: a.name, sublabel: `${a.path} (${a.currency})`,
  }));

  const handleCreated = useCallback(() => {
    setShowForm(false);
    refetch();
  }, [refetch]);

  const columns: Column<Reconciliation>[] = [
    { header: 'Cuenta', accessor: (row) => row.account?.name || '-' },
    { header: 'Fecha', accessor: (row) => formatDate(row.date), className: 'w-28' },
    { header: 'Saldo Banco', accessor: (row) => (
      <span className="font-mono">{formatMoney(row.bankBalance, row.account?.currency)}</span>
    ), className: 'w-36 text-right' },
    { header: 'Diferencia', accessor: (row) => (
      row.difference != null ? (
        <span className={`font-mono ${Number(row.difference) === 0 ? 'text-green-600' : 'text-red-600'}`}>
          {formatMoney(row.difference, row.account?.currency)}
        </span>
      ) : '-'
    ), className: 'w-32 text-right' },
    { header: 'Estado', accessor: (row) => (
      <Badge className={`${statusColors[row.status] || ''} border`}>
        {row.status === 'IN_PROGRESS' ? 'En Progreso' : row.status === 'COMPLETED' ? 'Completa' : 'Discrepancia'}
      </Badge>
    ), className: 'w-32' },
  ];

  if (detailId) {
    return (
      <ReconciliationDetail
        id={detailId}
        onBack={() => { setDetailId(null); refetch(); }}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Conciliacion Bancaria"
        description="Comparar movimientos del banco con el sistema"
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-1 h-4 w-4" /> Nueva Conciliacion
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={reconciliations}
        isLoading={isLoading}
        rowKey={(r) => r.id}
        onRowClick={(r) => setDetailId(r.id)}
        emptyMessage="No hay conciliaciones."
      />

      {showForm && (
        <ReconciliationFormDialog
          bankAccountOptions={bankAccountOptions}
          onClose={() => setShowForm(false)}
          onSaved={handleCreated}
        />
      )}
    </>
  );
}

// === Detail: Split-screen view ===
function ReconciliationDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: recon, refetch } = useQuery<Reconciliation>(`/reconciliations/${id}`);
  const { data: transactions } = useQuery<Transaction[]>(
    recon ? '/transactions' : null,
    recon ? { status: 'CONFIRMED' } : undefined,
  );
  const [showItemForm, setShowItemForm] = useState(false);
  const [matchingItem, setMatchingItem] = useState<ReconciliationItem | null>(null);
  const [selectedForGroup, setSelectedForGroup] = useState<Set<string>>(new Set());
  const [groupLabel, setGroupLabel] = useState('');
  const [completing, setCompleting] = useState(false);

  const handleItemAdded = useCallback(() => {
    setShowItemForm(false);
    refetch();
  }, [refetch]);

  const handleMatched = useCallback(() => {
    setMatchingItem(null);
    refetch();
  }, [refetch]);

  const handleGlobalize = useCallback(async () => {
    if (selectedForGroup.size < 2 || !groupLabel) return;
    try {
      await apiFetch(`/reconciliations/${id}/globalize`, {
        method: 'POST',
        body: { itemIds: Array.from(selectedForGroup), groupLabel },
      });
      toast.success('Items globalizados');
      setSelectedForGroup(new Set());
      setGroupLabel('');
      refetch();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error');
    }
  }, [id, selectedForGroup, groupLabel, refetch]);

  const handleComplete = useCallback(async () => {
    setCompleting(true);
    try {
      await apiFetch(`/reconciliations/${id}/complete`, { method: 'POST' });
      toast.success('Conciliacion completa');
      refetch();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error');
    } finally {
      setCompleting(false);
    }
  }, [id, refetch]);

  if (!recon) return null;

  const items = recon.items || [];
  const reconciledCount = items.filter((i) => i.isReconciled).length;
  const progress = items.length > 0 ? Math.round((reconciledCount / items.length) * 100) : 0;
  const isInProgress = recon.status === 'IN_PROGRESS';

  const toggleGroupItem = (itemId: string) => {
    setSelectedForGroup((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver
      </Button>

      <PageHeader
        title={`Conciliacion — ${recon.account?.name}`}
        description={`${formatDate(recon.date)} | Saldo banco: ${formatMoney(recon.bankBalance, recon.account?.currency)}`}
        actions={
          <div className="flex gap-2">
            {isInProgress && (
              <>
                <Button variant="outline" size="sm" onClick={() => setShowItemForm(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Item
                </Button>
                <Button size="sm" onClick={handleComplete} disabled={completing}>
                  <Check className="h-3 w-3 mr-1" /> Completar
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{reconciledCount}/{items.length} conciliados</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Split screen */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left: Bank items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Items del Banco</CardTitle>
            {selectedForGroup.size >= 2 && (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Etiqueta grupo..."
                  value={groupLabel}
                  onChange={(e) => setGroupLabel(e.target.value)}
                  className="w-40 h-7 text-xs"
                />
                <Button size="sm" variant="outline" onClick={handleGlobalize} disabled={!groupLabel}>
                  <Layers className="h-3 w-3 mr-1" /> Globalizar
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[500px]">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No hay items. Agregue movimientos del banco.</p>
              ) : (
                <div className="space-y-1">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                        item.isReconciled
                          ? 'bg-green-50 border-green-200'
                          : item.groupLabel
                          ? 'bg-yellow-50 border-yellow-200'
                          : 'bg-white border-border'
                      }`}
                    >
                      {isInProgress && !item.isReconciled && (
                        <Checkbox
                          checked={selectedForGroup.has(item.id)}
                          onCheckedChange={() => toggleGroupItem(item.id)}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="truncate block">{item.description}</span>
                        {item.groupLabel && (
                          <span className="text-xs text-yellow-700">[{item.groupLabel}]</span>
                        )}
                      </div>
                      <span className="font-mono shrink-0">{formatMoney(item.bankAmount, recon.account?.currency)}</span>
                      {isInProgress && !item.isReconciled && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setMatchingItem(item)}
                          title="Match con transaccion"
                        >
                          <Link2 className="h-3 w-3" />
                        </Button>
                      )}
                      {item.isReconciled && (
                        <Check className="h-4 w-4 text-green-600 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right: System transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Movimientos del Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[500px]">
              {!transactions || transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No hay movimientos.</p>
              ) : (
                <div className="space-y-1">
                  {transactions.slice(0, 50).map((txn) => (
                    <div
                      key={txn.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className="text-xs shrink-0">{txn.code}</Badge>
                        <span className="truncate">{txn.description}</span>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">{txn.type}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Status info */}
      {recon.status !== 'IN_PROGRESS' && (
        <div className={`rounded-md border px-4 py-3 text-sm ${statusColors[recon.status] || ''}`}>
          Conciliacion {recon.status === 'COMPLETED' ? 'completa' : 'con discrepancia'}.
          {recon.difference != null && ` Diferencia: ${formatMoney(recon.difference, recon.account?.currency)}`}
        </div>
      )}

      {/* Dialogs */}
      {showItemForm && (
        <AddItemDialog
          reconciliationId={id}
          currency={recon.account?.currency}
          onClose={() => setShowItemForm(false)}
          onSaved={handleItemAdded}
        />
      )}

      {matchingItem && (
        <MatchDialog
          item={matchingItem}
          transactions={transactions || []}
          onClose={() => setMatchingItem(null)}
          onMatched={handleMatched}
        />
      )}
    </>
  );
}

// === Add Item Dialog ===
function AddItemDialog({
  reconciliationId,
  currency,
  onClose,
  onSaved,
}: {
  reconciliationId: string;
  currency?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [description, setDescription] = useState('');
  const [bankAmount, setBankAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch(`/reconciliations/${reconciliationId}/items`, {
        method: 'POST',
        body: {
          description,
          bankAmount: inputToCentavos(bankAmount),
          importedFrom: 'manual',
          notes: notes || undefined,
        },
      });
      toast.success('Item agregado');
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
            <DialogTitle>Agregar Item del Banco ({currency})</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-1">
              <Label>Descripcion *</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-1">
              <Label>Monto *</Label>
              <Input type="number" step="0.01" value={bankAmount} onChange={(e) => setBankAmount(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Notas</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Agregando...' : 'Agregar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// === Match Dialog ===
function MatchDialog({
  item,
  transactions,
  onClose,
  onMatched,
}: {
  item: ReconciliationItem;
  transactions: Transaction[];
  onClose: () => void;
  onMatched: () => void;
}) {
  const [selectedTxnId, setSelectedTxnId] = useState('');
  const [saving, setSaving] = useState(false);

  const txnOptions: ComboboxOption[] = transactions.map((t) => ({
    value: t.id,
    label: `${t.code} — ${t.description}`,
    sublabel: t.type,
  }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch(`/reconciliations/items/${item.id}/match`, {
        method: 'POST',
        body: { transactionId: selectedTxnId },
      });
      toast.success('Item conciliado');
      onMatched();
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
            <DialogTitle>Conciliar Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="rounded-md border px-3 py-2 text-sm">
              <span className="text-muted-foreground">Item: </span>
              <span className="font-medium">{item.description}</span>
              <span className="font-mono ml-2">{formatMoney(item.bankAmount)}</span>
            </div>
            <div className="space-y-1">
              <Label>Movimiento del Sistema *</Label>
              <Combobox
                options={txnOptions}
                value={selectedTxnId}
                onChange={setSelectedTxnId}
                placeholder="Seleccionar movimiento..."
                searchPlaceholder="Buscar por codigo o descripcion..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving || !selectedTxnId}>
              {saving ? 'Conciliando...' : 'Conciliar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// === New Reconciliation Dialog ===
function ReconciliationFormDialog({
  bankAccountOptions,
  onClose,
  onSaved,
}: {
  bankAccountOptions: ComboboxOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(toISODate(new Date()));
  const [bankBalance, setBankBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/reconciliations', {
        method: 'POST',
        body: {
          accountId,
          date,
          bankBalance: inputToCentavos(bankBalance),
          notes: notes || undefined,
        },
      });
      toast.success('Conciliacion creada');
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
            <DialogTitle>Nueva Conciliacion</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-1">
              <Label>Cuenta Bancaria *</Label>
              <Combobox options={bankAccountOptions} value={accountId} onChange={setAccountId} placeholder="Seleccionar banco..." />
            </div>
            <div className="space-y-1">
              <Label>Fecha *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Saldo del Banco *</Label>
              <Input type="number" step="0.01" value={bankBalance} onChange={(e) => setBankBalance(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Notas</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving || !accountId}>
              {saving ? 'Creando...' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
