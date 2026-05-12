'use client';

import { useQuery } from '@/lib/hooks';
import { formatMoney } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Banknote } from 'lucide-react';

type Socio = {
  cuentaId: string;
  name: string;
  percentBps: number;
  correspondeArs: string;
  correspondeUsd: string;
};

type Sociedad = {
  id: string;
  name: string;
  banco: { id: string; nombre: string; numero: string; saldoArs: string; saldoUsd: string } | null;
  socios: Socio[];
};

type Posicion = {
  sociedades: Sociedad[];
  caja: { saldoArs: string; saldoUsd: string };
  owner: { cuentaIds: string[]; names: string[]; totalArs: string; totalUsd: string } | null;
  financieraTotal: { saldoArs: string; saldoUsd: string };
};

function TotalCard({
  title, ars, usd, footnote,
}: {
  title: string; ars: string; usd: string; footnote?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="text-muted-foreground">{title}</div>
        <div>
          <div className="text-muted-foreground">En pesos</div>
          <div className="viewer-amount">{formatMoney(ars, 'ARS')}</div>
        </div>
        <div>
          <div className="text-muted-foreground">En dólares</div>
          <div className="viewer-amount">{formatMoney(usd, 'USD')}</div>
        </div>
        {footnote && <div className="text-sm text-muted-foreground pt-1">{footnote}</div>}
      </CardContent>
    </Card>
  );
}

export default function ViewerPosicionPage() {
  const { data, isLoading, error } = useQuery<Posicion>('/reports/posicion');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1>Su posición</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48 w-full rounded-4xl" />
          <Skeleton className="h-48 w-full rounded-4xl" />
        </div>
        <Skeleton className="h-48 w-full rounded-4xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <h1>Su posición</h1>
        <Card>
          <CardContent>
            <p className="text-destructive">No pudimos cargar su posición. Intente recargar la página.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { sociedades, caja, owner, financieraTotal } = data;

  return (
    <div className="space-y-6">
      <h1>Su posición</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {owner ? (
          <TotalCard
            title="Su parte"
            ars={owner.totalArs}
            usd={owner.totalUsd}
            footnote={
              owner.names.length > 1
                ? `Suma de ${owner.names.length} cuentas suyas: ${owner.names.join(', ')}`
                : undefined
            }
          />
        ) : (
          <Card>
            <CardContent className="space-y-2">
              <div className="text-muted-foreground">Su parte</div>
              <p className="text-muted-foreground">
                Su cuenta todavía no está marcada como propietaria en el sistema.
                Pídale a Mariana que la configure para ver sus totales.
              </p>
            </CardContent>
          </Card>
        )}
        <TotalCard
          title="Total de la financiera"
          ars={financieraTotal.saldoArs}
          usd={financieraTotal.saldoUsd}
        />
      </div>

      <Card>
        <CardContent className="space-y-5">
          <h2>Por sociedad</h2>
          {sociedades.length === 0 && (
            <p className="text-muted-foreground">Aún no hay sociedades cargadas.</p>
          )}
          <ul className="space-y-5">
            {sociedades.map((s) => {
              const ownerSocios = owner
                ? s.socios.filter((m) => owner.cuentaIds.includes(m.cuentaId))
                : [];
              const correspondeArs = ownerSocios.reduce((sum, m) => sum + Number(m.correspondeArs), 0).toString();
              const correspondeUsd = ownerSocios.reduce((sum, m) => sum + Number(m.correspondeUsd), 0).toString();
              const saldoArs = s.banco?.saldoArs ?? '0';
              const saldoUsd = s.banco?.saldoUsd ?? '0';
              return (
                <li key={s.id} className="border-t pt-4 first:border-t-0 first:pt-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <h3 className="!mb-0">{s.name}</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 ml-7">
                    <div>
                      <div className="text-muted-foreground">En el banco hay</div>
                      <div className="font-semibold">{formatMoney(saldoArs, 'ARS')}</div>
                      <div className="font-semibold">{formatMoney(saldoUsd, 'USD')}</div>
                    </div>
                    {ownerSocios.length > 0 && (
                      <div>
                        <div className="text-muted-foreground">A usted le corresponde</div>
                        <div className="font-semibold">{formatMoney(correspondeArs, 'ARS')}</div>
                        <div className="font-semibold">{formatMoney(correspondeUsd, 'USD')}</div>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Banknote className="h-5 w-5" />
            <span>Efectivo en caja hoy</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="viewer-amount-md">{formatMoney(caja.saldoArs, 'ARS')}</div>
            <div className="viewer-amount-md">{formatMoney(caja.saldoUsd, 'USD')}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
