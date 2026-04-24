'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ViewerSection } from '@/components/viewer/viewer-section';
import { ViewerDisclosure } from '@/components/viewer/viewer-disclosure';
import { LeaseStatusBadge } from '@/components/viewer/status-badge';
import { useAuth } from '@/lib/auth-context';
import { useQuery } from '@/lib/hooks';
import { formatMoney, formatDateLong, toISODate } from '@/lib/format';

type Entity = {
  id: string;
  name: string;
  type: string;
};

type WeightedDetail = {
  entityName: string;
  accountName: string;
  accountPath: string;
  percentage: number;
  accountBalance: string;
  weightedBalance: string;
};

type WeightedBalanceCurrency = {
  currency: string;
  totalBalance: string;
  details: WeightedDetail[];
};

type LeaseStatusItem = {
  leaseId: string;
  status: 'PAID' | 'PENDING' | 'NO_INVOICE';
};

type Period = { id: string; date: string; status: 'OPEN' | 'CLOSED' };

type CashFlowItem = {
  currency: string;
  inflows: string;
  outflows: string;
  netFlow: string;
};

type Transaction = {
  id: string;
  description: string;
  entries: { type: 'DEBIT' | 'CREDIT'; amount: string }[];
};

type MovementsResponse = {
  period: { id: string; date: string; status: string };
  transactionCount: number;
  transactions: Transaction[];
};

const DONUT_COLORS = ['#6ee7b7', '#fca5a5', '#a5b4fc', '#fcd34d', '#f9a8d4', '#5eead4'];

const currencyLabel: Record<string, string> = {
  ARS: 'Pesos',
  USD: 'Dólares',
};

export default function ViewerDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  const today = useMemo(() => toISODate(new Date()), []);

  const { data: entities } = useQuery<Entity[]>('/entities');

  const ownerEntityId = useMemo(() => {
    if (!entities || !user) return null;
    const match = entities.find(
      (e) => e.type === 'PERSON' && e.name.toLowerCase().includes(user.name.toLowerCase()),
    );
    return match?.id ?? null;
  }, [entities, user]);

  const { data: weightedBalances, isLoading: loadingBalances } =
    useQuery<WeightedBalanceCurrency[]>(
      ownerEntityId ? `/reports/owner/${ownerEntityId}/weighted-balances` : null,
    );

  const { data: leases, isLoading: loadingLeases } =
    useQuery<LeaseStatusItem[]>('/reports/leases/status');

  const paidCount = leases?.filter((l) => l.status === 'PAID').length ?? 0;
  const pendingCount = leases?.filter((l) => l.status === 'PENDING').length ?? 0;
  const noInvoiceCount = leases?.filter((l) => l.status === 'NO_INVOICE').length ?? 0;

  const { data: periods } = useQuery<Period[]>('/periods');

  const activePeriod = useMemo(() => {
    if (!periods || periods.length === 0) return null;
    const open = periods
      .filter((p) => p.status === 'OPEN')
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (open) return open;
    return [...periods].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  }, [periods]);

  const { data: cashFlow } = useQuery<CashFlowItem[]>(
    activePeriod ? `/reports/period/${activePeriod.id}/cash-flow` : null,
  );

  const { data: movements } = useQuery<MovementsResponse>(
    activePeriod ? `/reports/period/${activePeriod.id}/movements` : null,
  );

  return (
    <>
      <header className="space-y-1">
        <h1 className="text-[28px] font-bold tracking-tight">
          Bienvenido, {user?.name ?? ''}
        </h1>
        <p className="text-lg text-muted-foreground">{formatDateLong(today)}</p>
      </header>

      {/* Bloque 1 — Su plata */}
      <ViewerSection title="Su plata">
        {loadingBalances ? (
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        ) : weightedBalances && weightedBalances.length > 0 ? (
          <>
            <div
              className={
                weightedBalances.length === 1
                  ? 'flex justify-center'
                  : 'grid gap-8 md:grid-cols-2'
              }
            >
              {weightedBalances.map((wb) => (
                <CurrencyDonut key={wb.currency} wb={wb} />
              ))}
            </div>

            <ViewerDisclosure summary="Ver detalle por cuenta">
              <div className="space-y-6">
                {weightedBalances.map((wb) => (
                  <div key={wb.currency}>
                    <h3 className="text-lg font-semibold mb-3">
                      {currencyLabel[wb.currency] ?? wb.currency}
                    </h3>
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full text-[17px]">
                        <thead>
                          <tr className="border-b bg-muted/50 text-left">
                            <th className="px-4 py-3 font-medium">Sociedad</th>
                            <th className="px-4 py-3 font-medium">Cuenta</th>
                            <th className="px-4 py-3 text-right font-medium">%</th>
                            <th className="px-4 py-3 text-right font-medium">Saldo cuenta</th>
                            <th className="px-4 py-3 text-right font-medium">Su parte</th>
                          </tr>
                        </thead>
                        <tbody>
                          {wb.details.map((d, i) => (
                            <tr
                              key={i}
                              className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                              onClick={() => {
                                const entity = entities?.find((e) => e.name === d.entityName);
                                if (entity) router.push(`/viewer/entities/${entity.id}`);
                              }}
                            >
                              <td className="px-4 py-3">{d.entityName}</td>
                              <td className="px-4 py-3 text-muted-foreground">{d.accountName}</td>
                              <td className="px-4 py-3 text-right">
                                {(d.percentage / 100).toFixed(0)}%
                              </td>
                              <td className="px-4 py-3 text-right font-mono">
                                {formatMoney(d.accountBalance, wb.currency)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-medium">
                                {formatMoney(d.weightedBalance, wb.currency)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </ViewerDisclosure>
          </>
        ) : (
          <p className="text-lg text-muted-foreground py-8 text-center">
            Todavía no hay saldos registrados.
          </p>
        )}
      </ViewerSection>

      {/* Bloque 2 — Sus alquileres */}
      <ViewerSection title="Sus alquileres">
        {loadingLeases ? (
          <div className="grid gap-6 md:grid-cols-3">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            <LeaseStatCard
              status="PAID"
              count={paidCount}
              onClick={() => router.push('/viewer/leases')}
            />
            <LeaseStatCard
              status="PENDING"
              count={pendingCount}
              onClick={() => router.push('/viewer/leases')}
            />
            <LeaseStatCard
              status="NO_INVOICE"
              count={noInvoiceCount}
              onClick={() => router.push('/viewer/leases')}
            />
          </div>
        )}
      </ViewerSection>

      {/* Bloque 3 — Lo que pasó hoy */}
      <ViewerSection
        title={
          activePeriod?.status === 'OPEN' || !activePeriod
            ? 'Lo que pasó hoy'
            : `Lo que pasó el ${formatDateLong(activePeriod.date)}`
        }
        subtitle={activePeriod ? formatDateLong(activePeriod.date) : undefined}
      >
        {!activePeriod ? (
          <p className="text-lg text-muted-foreground py-8 text-center">
            Todavía no hubo movimientos registrados.
          </p>
        ) : !cashFlow || cashFlow.length === 0 ? (
          <p className="text-lg text-muted-foreground py-8 text-center">
            Este día no tuvo movimientos.
          </p>
        ) : (
          <>
            <div className="space-y-8">
              {cashFlow.map((cf) => (
                <CashFlowBars key={cf.currency} cf={cf} />
              ))}
            </div>

            {movements && movements.transactions.length > 0 && (
              <ViewerDisclosure
                summary={`Ver movimientos detallados (${movements.transactionCount})`}
              >
                <ul className="divide-y">
                  {movements.transactions.map((txn) => {
                    const total = txn.entries
                      .filter((e) => e.type === 'DEBIT')
                      .reduce((sum, e) => sum + Number(e.amount), 0);
                    return (
                      <li
                        key={txn.id}
                        className="flex items-center justify-between gap-4 py-3 text-[17px]"
                      >
                        <span>{txn.description}</span>
                        <span className="font-mono font-medium">{formatMoney(total)}</span>
                      </li>
                    );
                  })}
                </ul>
              </ViewerDisclosure>
            )}
          </>
        )}
      </ViewerSection>
    </>
  );
}

function CurrencyDonut({ wb }: { wb: WeightedBalanceCurrency }) {
  const data = wb.details.map((d) => ({
    name: d.entityName,
    value: Math.max(Number(d.weightedBalance), 0),
  }));
  const totalForPct = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-center">
        {currencyLabel[wb.currency] ?? wb.currency}
        <span className="ml-2 text-muted-foreground text-lg">
          ({wb.currency === 'ARS' ? '$' : wb.currency === 'USD' ? 'US$' : wb.currency})
        </span>
      </h3>

      <div className="relative h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={70}
              outerRadius={110}
              paddingAngle={data.length > 1 ? 2 : 0}
              stroke="var(--background)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-2xl font-bold font-mono">
            {formatMoney(wb.totalBalance, wb.currency)}
          </div>
          <div className="text-base text-muted-foreground">Total</div>
        </div>
      </div>

      <ul className="space-y-2 text-base">
        {data.map((d, i) => {
          const pct = totalForPct > 0 ? Math.round((d.value / totalForPct) * 100) : 0;
          return (
            <li key={i} className="flex items-center gap-3">
              <span
                className="inline-block w-4 h-4 rounded-sm"
                style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                aria-hidden
              />
              <span className="flex-1">{d.name}</span>
              <span className="text-muted-foreground">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LeaseStatCard({
  status,
  count,
  onClick,
}: {
  status: 'PAID' | 'PENDING' | 'NO_INVOICE';
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-4 rounded-xl border bg-background py-8 px-6 hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-40"
      aria-label={`Ver alquileres — estado ${status}`}
    >
      <LeaseStatusBadge status={status} size="xl" />
      <span className="text-5xl font-bold font-mono">{count}</span>
    </button>
  );
}

function CashFlowBars({ cf }: { cf: CashFlowItem }) {
  const inflow = Number(cf.inflows);
  const outflow = Number(cf.outflows);
  const net = Number(cf.netFlow);
  const max = Math.max(inflow, outflow, 1);

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">
        {currencyLabel[cf.currency] ?? cf.currency}
        <span className="ml-2 text-muted-foreground text-lg">
          ({cf.currency === 'ARS' ? '$' : cf.currency === 'USD' ? 'US$' : cf.currency})
        </span>
      </h3>
      <div className="space-y-3">
        <BarRow label="Entradas" value={inflow} max={max} color="bg-green-500" currency={cf.currency} />
        <BarRow label="Salidas" value={outflow} max={max} color="bg-red-500" currency={cf.currency} />
      </div>
      <div className="flex items-center gap-3 text-lg">
        <span className="text-muted-foreground">Neto:</span>
        <span className={`font-mono font-semibold ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {net >= 0 ? '+' : ''}
          {formatMoney(net, cf.currency)}
        </span>
        {net >= 0 ? (
          <CheckCircle2 size={22} className="text-green-600" aria-hidden />
        ) : (
          <AlertCircle size={22} className="text-red-600" aria-hidden />
        )}
      </div>
    </div>
  );
}

function BarRow({
  label,
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
      <span className="w-24 text-base text-muted-foreground shrink-0">{label}</span>
      <div className="flex-1 h-8 bg-muted rounded-md overflow-hidden">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
      <span className="w-40 text-right font-mono text-lg font-semibold">
        {formatMoney(value, currency)}
      </span>
    </div>
  );
}
