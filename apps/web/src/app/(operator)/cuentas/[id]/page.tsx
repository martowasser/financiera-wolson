'use client';

import { use } from 'react';
import { useQuery, useMutation } from '@/lib/hooks';
import { formatMoney } from '@/lib/format';
import { formatApiError } from '@/lib/api-errors';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MovimientosPanel } from '@/components/movimientos-panel';
import { toast } from 'sonner';

type Cuenta = {
  id: string;
  name: string;
  identifier: string | null;
  notes: string | null;
  saldoArs: string;
  saldoUsd: string;
  isActive: boolean;
  isOwner: boolean;
  createdAt: string;
};

export default function CuentaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: cuenta, refetch } = useQuery<Cuenta>(`/cuentas/${id}`);
  const { mutate: updateCuenta, isLoading: savingOwner } = useMutation<{ isOwner: boolean }, Cuenta>(`/cuentas/${id}`, 'PUT');

  async function toggleOwner(next: boolean) {
    try {
      await updateCuenta({ isOwner: next });
      toast.success(next ? 'Marcada como cuenta de Alberto' : 'Ya no es cuenta de Alberto');
      refetch();
    } catch (e) {
      toast.error(formatApiError(e, 'No se pudo actualizar'));
    }
  }

  if (!cuenta) return <div className="text-muted-foreground">Cargando…</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={cuenta.name}
        description={cuenta.identifier ? `Identificador: ${cuenta.identifier}` : 'Sin identificador'}
        actions={
          <div className="flex items-center gap-2">
            {cuenta.isOwner && <Badge>Cuenta de Alberto</Badge>}
            {cuenta.isActive
              ? <Badge variant="outline">Activa</Badge>
              : <Badge variant="secondary">Inactiva</Badge>}
          </div>
        }
      />

      <Card>
        <CardContent className="flex items-start justify-between gap-4 py-4">
          <div className="space-y-1">
            <Label htmlFor="isOwner-switch" className="text-base">Es cuenta de Alberto?</Label>
            <p className="text-sm text-muted-foreground">
              Marcar si esta cuenta pertenece a Alberto. Se usa para calcular &ldquo;lo que le corresponde&rdquo; en su viewer.
              Puede tener varias cuentas (por ejemplo una personal y otra de su SRL).
            </p>
          </div>
          <Switch
            id="isOwner-switch"
            checked={cuenta.isOwner}
            onCheckedChange={(v) => toggleOwner(v)}
            disabled={savingOwner}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Saldo ARS</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-semibold ${Number(cuenta.saldoArs) < 0 ? 'text-red-600' : ''}`}>
              {formatMoney(cuenta.saldoArs, 'ARS')}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Saldo USD</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-semibold ${Number(cuenta.saldoUsd) < 0 ? 'text-red-600' : ''}`}>
              {formatMoney(cuenta.saldoUsd, 'USD')}
            </div>
          </CardContent>
        </Card>
      </div>

      {cuenta.notes && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Notas</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{cuenta.notes}</p></CardContent>
        </Card>
      )}

      <MovimientosPanel
        scope={{ cuentaId: id }}
        filenameHint={`cuenta-${cuenta.identifier ?? cuenta.name}`}
        extracto={{ kind: 'cuenta', entityId: id, label: cuenta.name }}
      />
    </div>
  );
}
