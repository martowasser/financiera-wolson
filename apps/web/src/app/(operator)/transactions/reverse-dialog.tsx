'use client';

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
  transaction: { id: string; code: string; description: string };
  onSuccess: () => void;
  onClose: () => void;
};

export function ReverseDialog({ transaction, onSuccess, onClose }: Props) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch(`/transactions/${transaction.id}/reverse`, {
        method: 'POST',
        body: { reason },
      });
      toast.success(`Transaccion ${transaction.code} revertida`);
      onSuccess();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al revertir');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog open onOpenChange={onClose}>
      <AlertDialogContent>
        <form onSubmit={handleSubmit}>
          <AlertDialogHeader>
            <AlertDialogTitle>Revertir Transaccion {transaction.code}</AlertDialogTitle>
            <AlertDialogDescription>
              Se creara un asiento inverso que anula &ldquo;{transaction.description}&rdquo;.
              Esta accion no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="reason">Motivo de reversion *</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Monto incorrecto"
              required
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={loading || !reason}>
              {loading ? 'Revirtiendo...' : 'Confirmar Reversion'}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
