'use client';

import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ViewerSection } from '@/components/viewer/viewer-section';
import { ViewerDisclosure } from '@/components/viewer/viewer-disclosure';
import { useQuery } from '@/lib/hooks';
import { formatMoney, formatDateLong } from '@/lib/format';
import { ChevronLeft, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { transactionTypeLabels, label } from '@/lib/labels';

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

const currencyLabel: Record<string, string> = {
  ARS: 'Pesos',
  USD: 'Dólares',
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
      <PageHeader title="Ingresos y Gastos" description="Flujo de fondos por día" />

      {/* Period navigation */}
      <ViewerSection>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Button
            variant="outline"
            size="lg"
            className="min-h-12 text-lg"
            disabled={!canPrev}
            onClick={() => setSelectedIndex((i) => i + 1)}
          >
            <ChevronLeft className="h-5 w-5 mr-2" />
            Anterior
          </Button>
          <div className="text-center">
            {loadingPeriods ? (
              <Skeleton className="h-8 w-64 mx-auto" />
            ) : selectedPeriod ? (
              <div className="flex flex-col items-center gap-2">
                <span className="text-2xl font-bold">{formatDateLong(selectedPeriod.date)}</span>
                <Badge
                  variant={selectedPeriod.status === 'OPEN' ? 'default' : 'secondary'}
                  className="text-base px-3 py-1"
                >
                  {selectedPeriod.status === 'OPEN' ? 'Abierto' : 'Cerrado'}
                </Badge>
              </div>
            ) : (
              <span className="text-lg text-muted-foreground">No hay períodos</span>
            )}
          </div>
          <Button
            variant="outline"
            size="lg"
            className="min-h-12 text-lg"
            disabled={!canNext}
            onClick={() => setSelectedIndex((i) => i - 1)}
          >
            Siguiente
            <ChevronRight className="h-5 w-5 ml-2" />
          </Button>
        </div>
      </ViewerSection>

      {/* Cash flow summary */}
      {loadingCashFlow ? (
        <ViewerSection>
          <Skeleton className="h-40" />
        </ViewerSection>
      ) : cashFlow && cashFlow.length > 0 ? (
        cashFlow.map((cf) => <CashFlowBlock key={cf.currency} cf={cf} />)
      ) : selectedPeriod ? (
        <ViewerSection>
          <p className="text-lg text-muted-foreground py-8 text-center">
            Este día no tuvo movimientos.
          </p>
        </ViewerSection>
      ) : null}

      {/* Transaction details */}
      {loadingMovements ? (
        <ViewerSection>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </ViewerSection>
      ) : movements && movements.transactions.length > 0 ? (
        <ViewerSection>
          <ViewerDisclosure summary={`Ver movimientos (${movements.transactionCount})`}>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-[17px]">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="px-4 py-3 font-medium">Descripción</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 text-right font-medium">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.transactions.map((txn) => {
                    const debitTotal = txn.entries
                      .filter((e) => e.type === 'DEBIT')
                      .reduce((sum, e) => sum + Number(e.amount), 0);
                    return (
                      <tr key={txn.id} className="border-b last:border-0">
                        <td className="px-4 py-3">{txn.description}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-sm">
                            {label(transactionTypeLabels, txn.type)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{formatMoney(debitTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ViewerDisclosure>

          {movements.summary.length > 0 && (
            <ViewerDisclosure summary="Ver resumen por tipo">
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-[17px]">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left">
                      <th className="px-4 py-3 font-medium">Tipo</th>
                      <th className="px-4 py-3 text-right font-medium">Cantidad</th>
                      <th className="px-4 py-3 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.summary.map((s) => (
                      <tr key={s.type} className="border-b last:border-0">
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-sm">
                            {label(transactionTypeLabels, s.type)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">{s.count}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatMoney(s.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ViewerDisclosure>
          )}
        </ViewerSection>
      ) : null}
    </>
  );
}

function CashFlowBlock({ cf }: { cf: CashFlowItem }) {
  const inflow = Number(cf.inflows);
  const outflow = Number(cf.outflows);
  const net = Number(cf.netFlow);
  const max = Math.max(inflow, outflow, 1);

  return (
    <ViewerSection
      title={`${currencyLabel[cf.currency] ?? cf.currency} (${
        cf.currency === 'ARS' ? '$' : cf.currency === 'USD' ? 'US$' : cf.currency
      })`}
    >
      <div className="space-y-4">
        <Row label="Entradas" value={inflow} max={max} color="bg-green-500" currency={cf.currency} />
        <Row label="Salidas" value={outflow} max={max} color="bg-red-500" currency={cf.currency} />
      </div>
      <div className="flex items-center gap-3 text-xl pt-2">
        <span className="text-muted-foreground">Neto:</span>
        <span className={`font-mono font-bold ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {net >= 0 ? '+' : ''}
          {formatMoney(net, cf.currency)}
        </span>
        {net >= 0 ? (
          <CheckCircle2 size={26} className="text-green-600" aria-hidden />
        ) : (
          <AlertCircle size={26} className="text-red-600" aria-hidden />
        )}
      </div>
    </ViewerSection>
  );
}

function Row({
  label: rowLabel,
  value,
  max,
  color,
  currency,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  currency: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-4">
      <span className="w-28 text-lg text-muted-foreground shrink-0">{rowLabel}</span>
      <div className="flex-1 h-10 bg-muted rounded-md overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} aria-hidden />
      </div>
      <span className="w-48 text-right font-mono text-2xl font-bold">
        {formatMoney(value, currency)}
      </span>
    </div>
  );
}
