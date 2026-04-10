'use client';

import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@/lib/hooks';
import { formatMoney, formatDate } from '@/lib/format';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';

type Period = {
  id: string;
  date: string;
  status: string;
};

type EntryAccount = {
  id: string;
  name: string;
  path: string;
  currency: string;
};

type Entry = {
  id: string;
  accountId: string;
  type: 'DEBIT' | 'CREDIT';
  amount: string;
  description: string | null;
  account: EntryAccount;
};

type Transaction = {
  id: string;
  code: string;
  description: string;
  type: string;
  paymentMethod: string | null;
  entries: Entry[];
  createdBy: { id: string; name: string };
  createdAt: string;
};

type PeriodSummaryItem = {
  type: string;
  count: number;
  totalAmount: string;
};

type MovementsResponse = {
  period: { id: string; date: string; status: string };
  transactionCount: number;
  summary: PeriodSummaryItem[];
  transactions: Transaction[];
};

type CashFlowItem = {
  currency: string;
  inflows: string;
  outflows: string;
  netFlow: string;
};

export default function IncomeExpensesPage() {
  const { data: periods, isLoading: loadingPeriods } = useQuery<Period[]>('/periods');

  const sortedPeriods = useMemo(() => {
    if (!periods) return [];
    return [...periods].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [periods]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedPeriod = sortedPeriods[selectedIndex] ?? null;

  const { data: movements, isLoading: loadingMovements } = useQuery<MovementsResponse>(
    selectedPeriod ? `/reports/period/${selectedPeriod.id}/movements` : null,
  );

  const { data: cashFlow, isLoading: loadingCashFlow } = useQuery<CashFlowItem[]>(
    selectedPeriod ? `/reports/period/${selectedPeriod.id}/cash-flow` : null,
  );

  const canPrev = selectedIndex < sortedPeriods.length - 1;
  const canNext = selectedIndex > 0;

  return (
    <>
      <PageHeader
        title="Ingresos y Gastos"
        description="Flujo de fondos por periodo"
      />

      {/* Period navigation */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <Button
            variant="outline"
            size="sm"
            disabled={!canPrev}
            onClick={() => setSelectedIndex((i) => i + 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>
          <div className="text-center">
            {loadingPeriods ? (
              <Skeleton className="h-6 w-40" />
            ) : selectedPeriod ? (
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">{formatDate(selectedPeriod.date)}</span>
                <Badge variant={selectedPeriod.status === 'OPEN' ? 'default' : 'secondary'}>
                  {selectedPeriod.status === 'OPEN' ? 'Abierto' : 'Cerrado'}
                </Badge>
              </div>
            ) : (
              <span className="text-muted-foreground">No hay periodos</span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!canNext}
            onClick={() => setSelectedIndex((i) => i - 1)}
          >
            Siguiente
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardContent>
      </Card>

      {/* Cash flow summary */}
      {loadingCashFlow ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : cashFlow && cashFlow.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-3">
          {cashFlow.map((cf) => (
            <div key={cf.currency} className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Ingresos {cf.currency}
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-green-600">
                    {formatMoney(cf.inflows, cf.currency)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Egresos {cf.currency}
                  </CardTitle>
                  <TrendingDown className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-red-600">
                    {formatMoney(cf.outflows, cf.currency)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Flujo neto {cf.currency}
                  </CardTitle>
                  <Minus className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-xl font-bold ${Number(cf.netFlow) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatMoney(cf.netFlow, cf.currency)}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      ) : selectedPeriod ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No hay movimientos de caja en este periodo
          </CardContent>
        </Card>
      ) : null}

      {/* Transaction summary by type */}
      {movements && movements.summary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumen por tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium">Tipo</th>
                    <th className="px-4 py-2 text-right font-medium">Cantidad</th>
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.summary.map((s) => (
                    <tr key={s.type} className="border-b last:border-0">
                      <td className="px-4 py-2">
                        <Badge variant="outline">{s.type}</Badge>
                      </td>
                      <td className="px-4 py-2 text-right">{s.count}</td>
                      <td className="px-4 py-2 text-right font-mono">{formatMoney(s.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction list */}
      {loadingMovements ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : movements && movements.transactions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Transacciones ({movements.transactionCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium">Codigo</th>
                    <th className="px-4 py-2 text-left font-medium">Descripcion</th>
                    <th className="px-4 py-2 text-left font-medium">Tipo</th>
                    <th className="px-4 py-2 text-left font-medium">Medio</th>
                    <th className="px-4 py-2 text-right font-medium">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.transactions.map((txn) => {
                    const debitTotal = txn.entries
                      .filter((e) => e.type === 'DEBIT')
                      .reduce((sum, e) => sum + Number(e.amount), 0);
                    return (
                      <tr key={txn.id} className="border-b last:border-0">
                        <td className="px-4 py-2 font-mono text-muted-foreground">{txn.code}</td>
                        <td className="px-4 py-2">{txn.description}</td>
                        <td className="px-4 py-2">
                          <Badge variant="outline">{txn.type}</Badge>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {txn.paymentMethod === 'CASH'
                            ? 'Efectivo'
                            : txn.paymentMethod === 'BANK_TRANSFER'
                              ? 'Transferencia'
                              : txn.paymentMethod === 'CHECK'
                                ? 'Cheque'
                                : txn.paymentMethod ?? '-'}
                        </td>
                        <td className="px-4 py-2 text-right font-mono">{formatMoney(debitTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : selectedPeriod ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No hay transacciones en este periodo
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
