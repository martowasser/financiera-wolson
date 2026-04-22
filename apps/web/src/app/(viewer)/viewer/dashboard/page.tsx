'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { useQuery } from '@/lib/hooks';
import { formatMoney } from '@/lib/format';
import { Building2, DollarSign, TrendingUp, Home } from 'lucide-react';

type Entity = {
  id: string;
  name: string;
  type: string;
  taxId: string | null;
  isActive: boolean;
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

type LeaseStatus = {
  leaseId: string;
  property: { id: string; name: string; address: string };
  tenant: { id: string; name: string };
  currency: string;
  baseAmount: string;
  managedBy: string;
  status: 'PAID' | 'PENDING' | 'NO_INVOICE';
  currentInvoice: { id: string; code: string; status: string; netAmount: string } | null;
};

export default function ViewerDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [ownerEntityId, setOwnerEntityId] = useState<string | null>(null);

  const { data: entities } = useQuery<Entity[]>('/entities');

  // Find the entity matching the logged-in user's name
  useEffect(() => {
    if (entities && user) {
      const match = entities.find(
        (e) => e.type === 'PERSON' && e.name.toLowerCase().includes(user.name.toLowerCase()),
      );
      if (match) setOwnerEntityId(match.id);
    }
  }, [entities, user]);

  const { data: weightedBalances, isLoading: loadingBalances } =
    useQuery<WeightedBalanceCurrency[]>(
      ownerEntityId ? `/reports/owner/${ownerEntityId}/weighted-balances` : null,
    );

  const { data: leaseStatuses, isLoading: loadingLeases } =
    useQuery<LeaseStatus[]>('/reports/leases/status');

  const paidCount = leaseStatuses?.filter((l) => l.status === 'PAID').length ?? 0;
  const pendingCount = leaseStatuses?.filter((l) => l.status === 'PENDING').length ?? 0;
  const noInvoiceCount = leaseStatuses?.filter((l) => l.status === 'NO_INVOICE').length ?? 0;
  const totalLeases = leaseStatuses?.length ?? 0;

  return (
    <>
      <PageHeader
        title={`Bienvenido, ${user?.name ?? ''}`}
        description="Resumen de su posicion financiera"
      />

      {/* Consolidated position by currency */}
      <div className="grid gap-4 md:grid-cols-2">
        {loadingBalances ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : weightedBalances && weightedBalances.length > 0 ? (
          weightedBalances.map((wb) => (
            <Card key={wb.currency}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Posicion {wb.currency}
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatMoney(wb.totalBalance, wb.currency)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Saldo ponderado por ownership en {wb.details.length} cuenta(s)
                </p>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="md:col-span-2">
            <CardContent className="py-8 text-center text-muted-foreground">
              No hay datos de saldos disponibles
            </CardContent>
          </Card>
        )}
      </div>

      {/* Lease summary KPI */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Alquileres
            </CardTitle>
            <Home className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loadingLeases ? '-' : totalLeases}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Al dia</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{loadingLeases ? '-' : paidCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
            <Building2 className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{loadingLeases ? '-' : pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sin factura</CardTitle>
            <Building2 className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{loadingLeases ? '-' : noInvoiceCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Weighted balances breakdown */}
      {weightedBalances && weightedBalances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Saldos por entidad (ponderados)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {weightedBalances.map((wb) => (
                <div key={wb.currency}>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">{wb.currency}</h4>
                  <div className="rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-4 py-2 text-left font-medium">Sociedad</th>
                          <th className="px-4 py-2 text-left font-medium">Cuenta</th>
                          <th className="px-4 py-2 text-right font-medium">%</th>
                          <th className="px-4 py-2 text-right font-medium">Saldo cuenta</th>
                          <th className="px-4 py-2 text-right font-medium">Su parte</th>
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
                            <td className="px-4 py-2">{d.entityName}</td>
                            <td className="px-4 py-2 text-muted-foreground">{d.accountName}</td>
                            <td className="px-4 py-2 text-right">{(d.percentage / 100).toFixed(0)}%</td>
                            <td className="px-4 py-2 text-right font-mono">
                              {formatMoney(d.accountBalance, wb.currency)}
                            </td>
                            <td className="px-4 py-2 text-right font-mono font-medium">
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
          </CardContent>
        </Card>
      )}
    </>
  );
}
