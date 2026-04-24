'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ViewerDisclosure } from '@/components/viewer/viewer-disclosure';
import { useQuery } from '@/lib/hooks';
import { formatMoney, formatDate } from '@/lib/format';
import { ArrowLeft } from 'lucide-react';
import { accountTypeLabels, label } from '@/lib/labels';

type Entity = {
  id: string;
  name: string;
  type: string;
  taxId: string | null;
  notes: string | null;
  isActive: boolean;
};

type Ownership = {
  id: string;
  ownerId: string;
  entityId: string;
  percentage: number;
  validFrom: string;
  validUntil: string | null;
  owner: { id: string; name: string; type: string };
};

type AccountBalance = {
  id: string;
  name: string;
  path: string;
  type: string;
  currency: string;
  debitsPosted: string;
  creditsPosted: string;
  balance: string;
};

const typeLabels: Record<string, string> = {
  COMPANY: 'Sociedad',
  PERSON: 'Persona',
  FIRM: 'Empresa',
  THIRD_PARTY: 'Tercero',
};

export default function ViewerEntityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const { data: entity, isLoading: loadingEntity } = useQuery<Entity>(`/entities/${id}`);
  const { data: balances, isLoading: loadingBalances } = useQuery<AccountBalance[]>(
    `/reports/entity/${id}/balances`,
  );
  const { data: ownerships, isLoading: loadingOwnerships } = useQuery<Ownership[]>(
    `/ownerships/entity/${id}`,
  );

  const balancesByCurrency: Record<string, AccountBalance[]> = {};
  if (balances) {
    for (const b of balances) {
      if (!balancesByCurrency[b.currency]) balancesByCurrency[b.currency] = [];
      balancesByCurrency[b.currency].push(b);
    }
  }

  return (
    <>
      <PageHeader
        title={loadingEntity ? 'Cargando...' : entity?.name ?? 'Sociedad'}
        description={
          entity
            ? `${typeLabels[entity.type] ?? entity.type}${entity.taxId ? ` — CUIT: ${entity.taxId}` : ''}`
            : undefined
        }
        actions={
          <Button
            variant="outline"
            size="lg"
            className="min-h-12 text-lg"
            onClick={() => router.push('/viewer/entities')}
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Volver
          </Button>
        }
      />

      {entity?.notes && (
        <Card>
          <CardContent className="py-4 text-[17px] text-muted-foreground">
            {entity.notes}
          </CardContent>
        </Card>
      )}

      {/* Ownerships */}
      {loadingOwnerships ? (
        <Skeleton className="h-32" />
      ) : ownerships && ownerships.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Socios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-[17px]">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="px-4 py-3 font-medium">Socio</th>
                    <th className="px-4 py-3 text-right font-medium">Participación</th>
                    <th className="px-4 py-3 font-medium">Desde</th>
                  </tr>
                </thead>
                <tbody>
                  {ownerships
                    .filter((o) => !o.validUntil)
                    .map((o) => (
                      <tr
                        key={o.id}
                        className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                        onClick={() => router.push(`/viewer/entities/${o.ownerId}`)}
                      >
                        <td className="px-4 py-3">{o.owner.name}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          {(o.percentage / 100).toFixed(0)}%
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(o.validFrom)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Account balances by currency */}
      {loadingBalances ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : balances && balances.length > 0 ? (
        Object.entries(balancesByCurrency).map(([currency, accounts]) => {
          const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
          return (
            <Card key={currency}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-xl">Cuentas {currency}</CardTitle>
                <div className="text-xl font-bold font-mono">
                  {formatMoney(totalBalance, currency)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-[17px]">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left">
                        <th className="px-4 py-3 font-medium">Cuenta</th>
                        <th className="px-4 py-3 font-medium">Tipo</th>
                        <th className="px-4 py-3 text-right font-medium">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((a) => (
                        <tr key={a.id} className="border-b last:border-0">
                          <td className="px-4 py-3">
                            <div>{a.name}</div>
                            <div className="text-sm text-muted-foreground">{a.path}</div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-sm">
                              {label(accountTypeLabels, a.type)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-medium">
                            {formatMoney(a.balance, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ViewerDisclosure summary="Ver débitos y créditos">
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-[17px]">
                      <thead>
                        <tr className="border-b bg-muted/50 text-left">
                          <th className="px-4 py-3 font-medium">Cuenta</th>
                          <th className="px-4 py-3 text-right font-medium">Débitos</th>
                          <th className="px-4 py-3 text-right font-medium">Créditos</th>
                          <th className="px-4 py-3 text-right font-medium">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accounts.map((a) => (
                          <tr key={a.id} className="border-b last:border-0">
                            <td className="px-4 py-3">{a.name}</td>
                            <td className="px-4 py-3 text-right font-mono">
                              {formatMoney(a.debitsPosted, currency)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono">
                              {formatMoney(a.creditsPosted, currency)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-medium">
                              {formatMoney(a.balance, currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ViewerDisclosure>
              </CardContent>
            </Card>
          );
        })
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-lg text-muted-foreground">
            Esta sociedad no tiene cuentas registradas.
          </CardContent>
        </Card>
      )}
    </>
  );
}
