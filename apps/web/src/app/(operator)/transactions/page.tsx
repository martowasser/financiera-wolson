'use client';

import { useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@/lib/hooks';
import { formatMoney, formatDateTime } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, type Column } from '@/components/data-table';
import { Plus, RotateCcw } from 'lucide-react';
import { TransactionForm } from './transaction-form';
import { ReverseDialog } from './reverse-dialog';
import { TransactionDetail } from './transaction-detail';

type Transaction = {
  id: string;
  code: string;
  description: string;
  type: string;
  status: string;
  paymentMethod: string | null;
  createdAt: string;
  periodId: string;
  entries: {
    id: string;
    type: string;
    amount: number;
    account: { id: string; name: string; path: string; currency: string };
  }[];
};

type Period = { id: string; date: string; status: string };

export default function TransactionsPage() {
  const searchParams = useSearchParams();
  const showNew = searchParams.get('new') === '1';
  const detailId = searchParams.get('id');

  const [showForm, setShowForm] = useState(showNew);
  const [reverseTarget, setReverseTarget] = useState<{ id: string; code: string; description: string } | null>(null);
  const [selectedTxn, setSelectedTxn] = useState<string | null>(detailId);
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [search, setSearch] = useState('');

  const { data: period } = useQuery<Period>('/periods/today');
  const { data: transactions, isLoading, refetch } = useQuery<Transaction[]>('/transactions', {
    periodId: period?.id,
    type: filterType || undefined,
    status: filterStatus || undefined,
    search: search || undefined,
  });

  const handleCreated = useCallback(() => {
    setShowForm(false);
    refetch();
  }, [refetch]);

  const handleReversed = useCallback(() => {
    setReverseTarget(null);
    refetch();
  }, [refetch]);

  const columns: Column<Transaction>[] = [
    { header: 'Codigo', accessor: (row) => (
      <Badge variant={row.status === 'REVERSED' ? 'destructive' : 'secondary'} className="font-mono text-xs">
        {row.code}
      </Badge>
    ), className: 'w-28' },
    { header: 'Descripcion', accessor: 'description' },
    { header: 'Tipo', accessor: (row) => (
      <Badge variant="outline" className="text-xs">{row.type}</Badge>
    ), className: 'w-24' },
    { header: 'Monto', accessor: (row) => {
      const debitEntry = row.entries?.find((e) => e.type === 'DEBIT');
      if (!debitEntry) return '-';
      return formatMoney(debitEntry.amount, debitEntry.account.currency);
    }, className: 'w-32 text-right' },
    { header: 'Medio', accessor: (row) => row.paymentMethod || '-', className: 'w-28' },
    { header: 'Fecha', accessor: (row) => formatDateTime(row.createdAt), className: 'w-36' },
    { header: '', accessor: (row) => (
      row.status === 'CONFIRMED' ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); setReverseTarget(row); }}
          title="Revertir"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      ) : null
    ), className: 'w-12' },
  ];

  if (selectedTxn) {
    return (
      <TransactionDetail
        id={selectedTxn}
        onBack={() => setSelectedTxn(null)}
        onReverse={(txn) => { setSelectedTxn(null); setReverseTarget(txn); }}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Transacciones"
        description={period ? `Periodo: ${new Date(period.date).toLocaleDateString('es-AR')} — ${period.status}` : ''}
        actions={
          <Button onClick={() => setShowForm(true)} disabled={period?.status === 'CLOSED'}>
            <Plus className="mr-1 h-4 w-4" /> Nueva Transaccion
          </Button>
        }
      />

      {showForm && period && (
        <TransactionForm
          periodId={period.id}
          onSuccess={handleCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <Select value={filterType} onValueChange={(v) => setFilterType(v ?? '')}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="INCOME">Ingreso</SelectItem>
            <SelectItem value="EXPENSE">Egreso</SelectItem>
            <SelectItem value="TRANSFER">Transferencia</SelectItem>
            <SelectItem value="BANK_FEE">Gasto Bancario</SelectItem>
            <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v ?? '')}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="CONFIRMED">Confirmada</SelectItem>
            <SelectItem value="REVERSED">Revertida</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={transactions}
        isLoading={isLoading}
        rowKey={(r) => r.id}
        onRowClick={(r) => setSelectedTxn(r.id)}
        emptyMessage="No hay transacciones en este periodo."
      />

      {reverseTarget && (
        <ReverseDialog
          transaction={reverseTarget}
          onSuccess={handleReversed}
          onClose={() => setReverseTarget(null)}
        />
      )}
    </>
  );
}
