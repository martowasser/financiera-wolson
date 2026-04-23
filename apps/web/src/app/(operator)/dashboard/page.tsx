'use client';

import Link from 'next/link';
import { useQuery } from '@/lib/hooks';
import { formatMoney } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeftRight,
  DollarSign,
  Receipt,
  CalendarCheck,
  Plus,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { transactionTypeLabels, label } from '@/lib/labels';

type Period = { id: string; date: string; status: string };
type Account = {
  id: string;
  name: string;
  path: string;
  currency: string;
  type: string;
  debitsPosted: number;
  creditsPosted: number;
  normalBalance: string;
};
type Transaction = {
  id: string;
  code: string;
  description: string;
  type: string;
  status: string;
  createdAt: string;
  entries: { amount: number; type: string; accountId: string; account: { id: string; currency: string; type: string } }[];
};
type LeaseStatus = {
  leaseId: string;
  property: { name: string };
  tenant: { name: string };
  currency: string;
  baseAmount: number;
  invoiceCount: number;
  pendingCount: number;
};

function getBalance(account: Account): number {
  if (account.normalBalance === 'DEBIT') {
    return Number(account.debitsPosted) - Number(account.creditsPosted);
  }
  return Number(account.creditsPosted) - Number(account.debitsPosted);
}

export default function DashboardPage() {
  const { data: period } = useQuery<Period>('/periods/today');
  const { data: accounts, isLoading: loadingAccounts } = useQuery<Account[]>('/accounts', { type: 'CASH' });
  const { data: transactions, isLoading: loadingTxns } = useQuery<Transaction[]>(
    period ? '/transactions' : null,
    period ? { periodId: period.id } : undefined,
  );
  const { data: leaseStatus, isLoading: loadingLeases } = useQuery<LeaseStatus[]>('/reports/leases/status');

  const cashARS = accounts?.find((a) => a.currency === 'ARS' && a.type === 'CASH');
  const cashUSD = accounts?.find((a) => a.currency === 'USD' && a.type === 'CASH');

  // Arrastre: saldo al cierre del día anterior = saldo actual − delta neto del día para efectivo.
  function todayNetForAccount(accountId: string | undefined): number {
    if (!accountId) return 0;
    return (transactions || [])
      .filter((t) => t.status === 'CONFIRMED')
      .flatMap((t) => t.entries || [])
      .filter((e) => e.accountId === accountId)
      .reduce((sum, e) => sum + (e.type === 'DEBIT' ? 1 : -1) * Number(e.amount), 0);
  }
  const carryARS = cashARS ? getBalance(cashARS) - todayNetForAccount(cashARS.id) : 0;
  const carryUSD = cashUSD ? getBalance(cashUSD) - todayNetForAccount(cashUSD.id) : 0;

  const todayTxns = transactions || [];
  const todayIncome = todayTxns
    .filter((t) => t.type === 'INCOME' && t.status === 'CONFIRMED')
    .reduce((sum, t) => {
      const debitEntry = t.entries?.find((e) => e.type === 'DEBIT');
      return sum + (debitEntry ? Number(debitEntry.amount) : 0);
    }, 0);
  const todayExpense = todayTxns
    .filter((t) => t.type === 'EXPENSE' && t.status === 'CONFIRMED')
    .reduce((sum, t) => {
      const debitEntry = t.entries?.find((e) => e.type === 'DEBIT');
      return sum + (debitEntry ? Number(debitEntry.amount) : 0);
    }, 0);

  const pendingLeases = leaseStatus?.filter((l) => l.pendingCount > 0) || [];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Resumen operativo — ${new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
      />

      {/* Quick actions */}
      <div className="flex gap-2 flex-wrap">
        <Link href="/transactions?new=1" className={buttonVariants()}>
          <Plus className="mr-1 h-4 w-4" /> Nuevo Movimiento
        </Link>
        <Link href="/invoices?new=1" className={buttonVariants({ variant: 'outline' })}>
          <Receipt className="mr-1 h-4 w-4" /> Cobrar Alquiler
        </Link>
        <Link href="/period" className={buttonVariants({ variant: 'outline' })}>
          <CalendarCheck className="mr-1 h-4 w-4" /> Cierre del Dia
        </Link>
      </div>

      {/* Arrastre del día anterior */}
      <Card className="border-l-4 border-l-primary/60">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <CalendarCheck className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Arrastre del día anterior
              </p>
              <p className="text-xs text-muted-foreground">
                Con lo que arrancó la caja de seguridad
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Pesos</p>
              <p className="text-lg font-semibold">{formatMoney(carryARS, 'ARS')}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Dólares</p>
              <p className="text-lg font-semibold">{formatMoney(carryUSD, 'USD')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Balance cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Efectivo ARS</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingAccounts ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold">
                {cashARS ? formatMoney(getBalance(cashARS), 'ARS') : '$ 0,00'}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Efectivo USD</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingAccounts ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold">
                {cashUSD ? formatMoney(getBalance(cashUSD), 'USD') : 'US$ 0,00'}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Hoy</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {loadingTxns ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-green-600">
                {formatMoney(todayIncome, 'ARS')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Gastos Hoy</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            {loadingTxns ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-red-600">
                {formatMoney(todayExpense, 'ARS')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4" />
              Movimientos del Dia ({todayTxns.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTxns ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : todayTxns.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No hay movimientos hoy.</p>
            ) : (
              <div className="space-y-2">
                {todayTxns.slice(0, 8).map((txn) => (
                  <Link
                    key={txn.id}
                    href={`/transactions?id=${txn.id}`}
                    className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-accent text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant={txn.status === 'REVERSED' ? 'destructive' : 'secondary'} className="text-xs">
                        {txn.code}
                      </Badge>
                      <span className="truncate max-w-[200px]">{txn.description}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {label(transactionTypeLabels, txn.type)}
                    </Badge>
                  </Link>
                ))}
                {todayTxns.length > 8 && (
                  <Link href="/transactions" className="text-xs text-muted-foreground hover:underline block text-center py-1">
                    Ver todas ({todayTxns.length})
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending rents */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Alquileres Pendientes ({pendingLeases.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingLeases ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : pendingLeases.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No hay alquileres pendientes.</p>
            ) : (
              <div className="space-y-2">
                {pendingLeases.slice(0, 8).map((l) => (
                  <div
                    key={l.leaseId}
                    className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent"
                  >
                    <div>
                      <span className="font-medium">{l.property?.name}</span>
                      <span className="text-muted-foreground ml-2">{l.tenant?.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>{formatMoney(l.baseAmount, l.currency)}</span>
                      <Badge variant="destructive" className="text-xs">
                        {l.pendingCount} pend.
                      </Badge>
                    </div>
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
