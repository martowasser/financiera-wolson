'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useQuery } from '@/lib/hooks';
import { apiFetch } from '@/lib/api';
import { formatMoney, formatDate } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ChevronLeft, ChevronRight, Lock, CalendarCheck } from 'lucide-react';

type Period = {
  id: string;
  date: string;
  status: string;
  closedAt: string | null;
  closingNotes: string | null;
  closingBalances: Record<string, unknown> | null;
};

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
};

function getBalance(a: Account): number {
  if (a.normalBalance === 'DEBIT') return Number(a.debitsPosted) - Number(a.creditsPosted);
  return Number(a.creditsPosted) - Number(a.debitsPosted);
}

export default function PeriodPage() {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closingNotes, setClosingNotes] = useState('');
  const [closing, setClosing] = useState(false);

  const { data: periods, isLoading: loadingPeriods, refetch } = useQuery<Period[]>('/periods');
  const { data: todayPeriod } = useQuery<Period>('/periods/today');
  const { data: cashAccounts } = useQuery<Account[]>('/accounts', { type: 'CASH' });

  const current = selectedPeriodId
    ? periods?.find((p) => p.id === selectedPeriodId)
    : todayPeriod;

  const { data: periodTxns } = useQuery<Transaction[]>(
    current ? '/transactions' : null,
    current ? { periodId: current.id } : undefined,
  );

  const currentIndex = periods ? periods.findIndex((p) => p.id === current?.id) : -1;
  const canGoPrev = currentIndex < (periods?.length ?? 0) - 1;
  const canGoNext = currentIndex > 0;

  const goToPrev = () => {
    if (periods && canGoPrev) setSelectedPeriodId(periods[currentIndex + 1].id);
  };
  const goToNext = () => {
    if (periods && canGoNext) setSelectedPeriodId(periods[currentIndex - 1].id);
  };
  const goToToday = () => setSelectedPeriodId(null);

  const handleClose = useCallback(async () => {
    if (!current) return;
    setClosing(true);
    try {
      await apiFetch(`/periods/${current.id}/close`, {
        method: 'POST',
        body: { closingNotes: closingNotes || undefined },
      });
      toast.success('Periodo cerrado exitosamente');
      setShowCloseDialog(false);
      setClosingNotes('');
      refetch();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al cerrar periodo');
    } finally {
      setClosing(false);
    }
  }, [current, closingNotes, refetch]);

  const isClosed = current?.status === 'CLOSED';
  const txnCount = periodTxns?.length ?? 0;
  const confirmedTxns = periodTxns?.filter((t) => t.status === 'CONFIRMED').length ?? 0;
  const reversedTxns = periodTxns?.filter((t) => t.status === 'REVERSED').length ?? 0;

  return (
    <>
      <PageHeader
        title="Cierre de Periodo"
        description="Navegar entre dias y cerrar el periodo actual"
      />

      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={goToPrev} disabled={!canGoPrev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={goToToday}>
          Hoy
        </Button>
        <Button variant="outline" size="sm" onClick={goToNext} disabled={!canGoNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {current && (
          <div className="flex items-center gap-2 ml-2">
            <span className="text-lg font-semibold">
              {formatDate(current.date)}
            </span>
            <Badge variant={isClosed ? 'secondary' : 'default'}>
              {isClosed ? 'CERRADO' : 'ABIERTO'}
            </Badge>
          </div>
        )}
      </div>

      {loadingPeriods ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !current ? (
        <p className="text-muted-foreground">No se encontro el periodo.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Cash balances */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Saldos de Efectivo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cashAccounts?.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between">
                  <span className="text-sm">{acc.name}</span>
                  <span className="font-mono font-medium">
                    {formatMoney(getBalance(acc), acc.currency)}
                  </span>
                </div>
              ))}
              {(!cashAccounts || cashAccounts.length === 0) && (
                <p className="text-sm text-muted-foreground">No hay cuentas de efectivo.</p>
              )}
            </CardContent>
          </Card>

          {/* Period summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Resumen del Dia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Transacciones totales</span>
                <span className="font-medium">{txnCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Confirmadas</span>
                <span className="font-medium text-green-600">{confirmedTxns}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Revertidas</span>
                <span className="font-medium text-red-600">{reversedTxns}</span>
              </div>
              {current.closedAt && (
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="text-muted-foreground">Cerrado el</span>
                  <span>{new Date(current.closedAt).toLocaleString('es-AR')}</span>
                </div>
              )}
              {current.closingNotes && (
                <div className="text-sm pt-2 border-t">
                  <span className="text-muted-foreground">Notas: </span>
                  {current.closingNotes}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Close button */}
      {current && !isClosed && (
        <div className="flex justify-end">
          <Button onClick={() => setShowCloseDialog(true)}>
            <Lock className="mr-1 h-4 w-4" /> Cerrar Dia
          </Button>
        </div>
      )}

      {isClosed && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <CalendarCheck className="h-4 w-4" />
          Este periodo esta cerrado. No se pueden agregar mas transacciones.
        </div>
      )}

      {/* Close confirmation dialog */}
      <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cerrar Periodo</AlertDialogTitle>
            <AlertDialogDescription>
              El saldo de efectivo que queda en caja es el que se arrastra al dia siguiente.
              Confirme que coincide con el efectivo fisico.
              Una vez cerrado, no se podran agregar mas transacciones a este dia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            {cashAccounts?.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between font-medium">
                <span>{acc.name}</span>
                <span className="font-mono">{formatMoney(getBalance(acc), acc.currency)}</span>
              </div>
            ))}
            <div className="space-y-1 pt-2">
              <Label>Notas de cierre (opcional)</Label>
              <Textarea
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="Ej: Todo cuadra. / Diferencia de $500 por..."
                rows={2}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleClose} disabled={closing}>
              {closing ? 'Cerrando...' : 'Confirmar Cierre'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
