'use client';

import { PageHeader } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { ViewerSection } from '@/components/viewer/viewer-section';
import { ViewerDisclosure } from '@/components/viewer/viewer-disclosure';
import { LeaseStatusBadge } from '@/components/viewer/status-badge';
import { useQuery } from '@/lib/hooks';
import { formatMoney } from '@/lib/format';

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

export default function LeaseStatusPage() {
  const { data: leases, isLoading } = useQuery<LeaseStatus[]>('/reports/leases/status');

  const paidCount = leases?.filter((l) => l.status === 'PAID').length ?? 0;
  const pendingCount = leases?.filter((l) => l.status === 'PENDING').length ?? 0;
  const noInvoiceCount = leases?.filter((l) => l.status === 'NO_INVOICE').length ?? 0;

  return (
    <>
      <PageHeader title="Estado de Alquileres" description="Cómo está el cobro de cada propiedad" />

      {/* Semáforo */}
      <ViewerSection>
        {isLoading ? (
          <Skeleton className="h-32" />
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            <StatusStat status="PAID" count={paidCount} />
            <StatusStat status="PENDING" count={pendingCount} />
            <StatusStat status="NO_INVOICE" count={noInvoiceCount} />
          </div>
        )}
      </ViewerSection>

      {/* Property list */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : leases && leases.length > 0 ? (
        <div className="space-y-4">
          {leases.map((lease) => (
            <PropertyCard key={lease.leaseId} lease={lease} />
          ))}
        </div>
      ) : (
        <ViewerSection>
          <p className="text-lg text-muted-foreground py-8 text-center">
            Todavía no hay contratos de alquiler.
          </p>
        </ViewerSection>
      )}
    </>
  );
}

function StatusStat({
  status,
  count,
}: {
  status: 'PAID' | 'PENDING' | 'NO_INVOICE';
  count: number;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <LeaseStatusBadge status={status} size="xl" />
      <span className="text-5xl font-bold font-mono">{count}</span>
    </div>
  );
}

function PropertyCard({ lease }: { lease: LeaseStatus }) {
  return (
    <article className="rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col gap-6 px-6 py-6 md:flex-row md:items-center">
        <div className="md:w-48 shrink-0">
          <LeaseStatusBadge status={lease.status} size="lg" />
        </div>
        <div className="flex-1 space-y-1">
          <h3 className="text-xl font-bold">{lease.property.name}</h3>
          <p className="text-[17px] text-muted-foreground">{lease.property.address}</p>
          <p className="text-[17px]">
            Inquilino: <span className="font-semibold">{lease.tenant.name}</span>
          </p>
          <p className="text-2xl font-mono font-bold pt-1">
            {formatMoney(lease.baseAmount, lease.currency)}
            <span className="text-lg font-normal text-muted-foreground ml-2">por mes</span>
          </p>
        </div>
      </div>
      <div className="px-6 pb-4">
        <ViewerDisclosure summary="Más detalles">
          <dl className="grid gap-2 text-[17px] md:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Gestión</dt>
              <dd>
                {lease.managedBy === 'DIRECT' ? 'Gestión directa' : 'Rendido por tercero'}
              </dd>
            </div>
            {lease.currentInvoice && (
              <div>
                <dt className="text-muted-foreground">Factura</dt>
                <dd className="font-mono">{lease.currentInvoice.code}</dd>
              </div>
            )}
          </dl>
        </ViewerDisclosure>
      </div>
    </article>
  );
}
