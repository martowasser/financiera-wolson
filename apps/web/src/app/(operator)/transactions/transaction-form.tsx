'use client';

import { useState, useRef, useCallback, type FormEvent, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { useQuery } from '@/lib/hooks';
import { apiFetch } from '@/lib/api';
import { inputToCentavos } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Combobox, type ComboboxOption } from '@/components/combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Check, AlertTriangle } from 'lucide-react';

type Account = {
  id: string;
  name: string;
  path: string;
  currency: string;
  type: string;
  entityId: string;
  entity?: { name: string };
};

type EntryRow = {
  key: number;
  accountId: string;
  type: 'DEBIT' | 'CREDIT';
  amount: string;
  description: string;
};

type Props = {
  periodId: string;
  onSuccess: () => void;
  onCancel: () => void;
};

export function TransactionForm({ periodId, onSuccess, onCancel }: Props) {
  const [description, setDescription] = useState('');
  const [type, setType] = useState<string>('EXPENSE');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [checkNumber, setCheckNumber] = useState('');
  const [bankReference, setBankReference] = useState('');
  const [notes, setNotes] = useState('');
  const [entries, setEntries] = useState<EntryRow[]>([
    { key: 1, accountId: '', type: 'DEBIT', amount: '', description: '' },
    { key: 2, accountId: '', type: 'CREDIT', amount: '', description: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const nextKey = useRef(3);

  const { data: accounts } = useQuery<Account[]>('/accounts');

  const accountOptions: ComboboxOption[] = (accounts || []).map((a) => ({
    value: a.id,
    label: a.name,
    sublabel: `${a.path} (${a.currency})`,
  }));

  const totalDebits = entries
    .filter((e) => e.type === 'DEBIT')
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const totalCredits = entries
    .filter((e) => e.type === 'CREDIT')
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.005 && totalDebits > 0;

  const updateEntry = (index: number, field: keyof EntryRow, value: string) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)),
    );
  };

  const addEntry = () => {
    setEntries((prev) => [
      ...prev,
      { key: nextKey.current++, accountId: '', type: 'DEBIT' as const, amount: '', description: '' },
    ]);
  };

  const removeEntry = (index: number) => {
    if (entries.length <= 2) return;
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  };

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!isBalanced) {
      toast.error('El asiento no balancea. Debitos deben ser iguales a creditos.');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/transactions', {
        method: 'POST',
        body: {
          periodId,
          description,
          type,
          paymentMethod: paymentMethod || null,
          checkNumber: checkNumber || null,
          bankReference: bankReference || null,
          notes: notes || null,
          idempotencyKey: crypto.randomUUID(),
          entries: entries.map((e) => ({
            accountId: e.accountId,
            type: e.type,
            amount: inputToCentavos(e.amount),
            description: e.description || null,
          })),
        },
      });
      toast.success('Movimiento creado exitosamente');
      onSuccess();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al crear movimiento');
    } finally {
      setSubmitting(false);
    }
  }, [periodId, description, type, paymentMethod, checkNumber, bankReference, notes, entries, isBalanced, onSuccess]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Nuevo Movimiento</CardTitle>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Descripcion *</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej: ABL Edificio Centro"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v ?? "")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCOME">Ingreso</SelectItem>
                  <SelectItem value="EXPENSE">Gasto</SelectItem>
                  <SelectItem value="TRANSFER">Transferencia</SelectItem>
                  <SelectItem value="BANK_FEE">Gasto Bancario</SelectItem>
                  <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Medio de Pago</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v ?? "")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Efectivo</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Transferencia</SelectItem>
                  <SelectItem value="CHECK">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {paymentMethod === 'CHECK' && (
            <div className="space-y-1">
              <Label>Numero de Cheque</Label>
              <Input value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} />
            </div>
          )}
          {paymentMethod === 'BANK_TRANSFER' && (
            <div className="space-y-1">
              <Label>Referencia Bancaria</Label>
              <Input value={bankReference} onChange={(e) => setBankReference(e.target.value)} />
            </div>
          )}

          {/* Entries */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Lineas del Movimiento</Label>
              <div className="flex items-center gap-2">
                {isBalanced ? (
                  <Badge variant="default" className="gap-1 bg-green-600">
                    <Check className="h-3 w-3" /> Balanceado
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" /> Desbalanceado
                  </Badge>
                )}
                <Button type="button" variant="outline" size="sm" onClick={addEntry}>
                  <Plus className="h-3 w-3 mr-1" /> Linea
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {entries.map((entry, idx) => (
                <div key={entry.key} className="flex gap-2 items-start">
                  <div className="w-48">
                    <Select
                      value={entry.type}
                      onValueChange={(v) => updateEntry(idx, 'type', v ?? 'DEBIT')}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DEBIT">Debito</SelectItem>
                        <SelectItem value="CREDIT">Credito</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Combobox
                      options={accountOptions}
                      value={entry.accountId}
                      onChange={(v) => updateEntry(idx, 'accountId', v)}
                      placeholder="Cuenta..."
                      searchPlaceholder="Buscar cuenta..."
                    />
                  </div>
                  <div className="w-36">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Monto"
                      value={entry.amount}
                      onChange={(e) => updateEntry(idx, 'amount', e.target.value)}
                      className="h-9"
                    />
                  </div>
                  {entries.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeEntry(idx)}
                      className="h-9 px-2"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-sm text-muted-foreground px-1">
              <span>Debitos: {totalDebits.toFixed(2)}</span>
              <span>Creditos: {totalCredits.toFixed(2)}</span>
              <span>Diferencia: {Math.abs(totalDebits - totalCredits).toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notas (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !isBalanced}>
              {submitting ? 'Guardando...' : 'Guardar (Ctrl+Enter)'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
