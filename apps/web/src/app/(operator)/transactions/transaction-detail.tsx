'use client';

import { useQuery } from '@/lib/hooks';
import { formatMoney, formatDateTime } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, RotateCcw } from 'lucide-react';

type Entry = {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  account: { id: string; name: string; path: string; currency: string };
};

type Transaction = {
  id: string;
  code: string;
  description: string;
  type: string;
  status: string;
  paymentMethod: string | null;
  checkNumber: string | null;
  bankReference: string | null;
  notes: string | null;
  createdAt: string;
  entries: Entry[];
  reverses?: { code: string } | null;
  reversedByTx?: { code: string } | null;
};

type Props = {
  id: string;
  onBack: () => void;
  onReverse: (txn: { id: string; code: string; description: string }) => void;
};

export function TransactionDetail({ id, onBack, onReverse }: Props) {
  const { data: txn, isLoading } = useQuery<Transaction>(`/transactions/${id}`);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!txn) {
    return <p className="text-muted-foreground">Movimiento no encontrado.</p>;
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
      </div>

      <PageHeader
        title={`${txn.code} — ${txn.description}`}
        actions={
          txn.status === 'CONFIRMED' ? (
            <Button variant="destructive" size="sm" onClick={() => onReverse(txn)}>
              <RotateCcw className="h-4 w-4 mr-1" /> Anular
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Detalles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tipo</span>
              <Badge variant="outline">{txn.type}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estado</span>
              <Badge variant={txn.status === 'REVERSED' ? 'destructive' : 'default'}>
                {txn.status}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Medio de Pago</span>
              <span>{txn.paymentMethod || 'N/A'}</span>
            </div>
            {txn.checkNumber && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cheque</span>
                <span>{txn.checkNumber}</span>
              </div>
            )}
            {txn.bankReference && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ref. Bancaria</span>
                <span>{txn.bankReference}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fecha</span>
              <span>{formatDateTime(txn.createdAt)}</span>
            </div>
            {txn.notes && (
              <div className="pt-2 border-t">
                <span className="text-muted-foreground">Notas: </span>
                <span>{txn.notes}</span>
              </div>
            )}
            {txn.reverses && (
              <div className="pt-2 border-t text-orange-600">
                Anula: {txn.reverses.code}
              </div>
            )}
            {txn.reversedByTx && (
              <div className="pt-2 border-t text-red-600">
                Anulado por: {txn.reversedByTx.code}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Lineas del Movimiento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {txn.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={entry.type === 'DEBIT' ? 'default' : 'secondary'}
                      className="text-xs w-16 justify-center"
                    >
                      {entry.type === 'DEBIT' ? 'Debito' : 'Credito'}
                    </Badge>
                    <div>
                      <span className="font-medium">{entry.account.name}</span>
                      <span className="text-muted-foreground text-xs ml-2">{entry.account.path}</span>
                    </div>
                  </div>
                  <span className="font-mono">{formatMoney(entry.amount, entry.account.currency)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
