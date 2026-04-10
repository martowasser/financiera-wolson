'use client';

import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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

function statusBadge(status: 'PAID' | 'PENDING' | 'NO_INVOICE') {
  switch (status) {
    case 'PAID':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Al dia</Badge>;
    case 'PENDING':
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pendiente</Badge>;
    case 'NO_INVOICE':
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Sin factura</Badge>;
  }
}

export default function LeaseStatusPage() {
  const { data: leases, isLoading } = useQuery<LeaseStatus[]>('/reports/leases/status');

  const paidCount = leases?.filter((l) => l.status === 'PAID').length ?? 0;
  const pendingCount = leases?.filter((l) => l.status === 'PENDING').length ?? 0;
  const noInvoiceCount = leases?.filter((l) => l.status === 'NO_INVOICE').length ?? 0;

  return (
    <>
      <PageHeader
        title="Estado de Alquileres"
        description="Situacion actual de cobro por propiedad"
      />

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Al dia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{isLoading ? '-' : paidCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{isLoading ? '-' : pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sin factura</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{isLoading ? '-' : noInvoiceCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Property detail list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : leases && leases.length > 0 ? (
        <div className="space-y-3">
          {leases.map((lease) => (
            <Card key={lease.leaseId}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{lease.property.name}</span>
                      {statusBadge(lease.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">{lease.property.address}</p>
                    <p className="text-sm">
                      Inquilino: <span className="font-medium">{lease.tenant.name}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {lease.managedBy === 'DIRECT' ? 'Gestion directa' : 'Rendido por tercero'}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-lg font-semibold font-mono">
                      {formatMoney(lease.baseAmount, lease.currency)}
                    </div>
                    <p className="text-xs text-muted-foreground">Monto base</p>
                    {lease.currentInvoice && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Factura: </span>
                        <span className="font-mono">{lease.currentInvoice.code}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No hay contratos de alquiler activos
          </CardContent>
        </Card>
      )}
    </>
  );
}
