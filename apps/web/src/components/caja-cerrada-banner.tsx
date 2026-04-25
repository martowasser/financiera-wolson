'use client';

import { useState } from 'react';
import { AlertTriangle, Unlock } from 'lucide-react';
import { useQuery } from '@/lib/hooks';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatApiError } from '@/lib/api-errors';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type CajaToday = {
  id: string;
  fecha: string;
  status: 'OPEN' | 'CLOSED';
};

export function CajaCerradaBanner() {
  const { user } = useAuth();
  const { data: caja, refetch } = useQuery<CajaToday>('/caja/today');
  const [reopening, setReopening] = useState(false);

  if (!caja || caja.status !== 'CLOSED') return null;

  async function reabrir() {
    if (!caja) return;
    setReopening(true);
    try {
      await apiFetch(`/caja/${caja.id}/reabrir`, { method: 'POST' });
      toast.success('Caja reabierta');
      refetch();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setReopening(false);
    }
  }

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
    >
      <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
      <div className="flex-1 space-y-1">
        <p className="font-medium">Caja de hoy ({formatDate(caja.fecha)}) está cerrada.</p>
        <p className="text-xs opacity-90">
          {isAdmin
            ? 'Reabrila para seguir cargando movimientos de hoy, o cargá con otra fecha.'
            : 'No vas a poder cargar movimientos con fecha de hoy hasta que un admin la reabra. Igual podés usar otra fecha.'}
        </p>
      </div>
      {isAdmin && (
        <Button
          size="sm"
          variant="outline"
          onClick={reabrir}
          disabled={reopening}
          className="shrink-0"
        >
          <Unlock className="h-4 w-4" />
          {reopening ? 'Reabriendo…' : 'Reabrir caja'}
        </Button>
      )}
    </div>
  );
}
