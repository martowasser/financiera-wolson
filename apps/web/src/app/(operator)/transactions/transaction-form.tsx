'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

type Entity = {
  id: string;
  name: string;
  type: string;
};

type SociedadMember = {
  id: string;
  sociedadId: string;
  accountId: string;
  percentBps: number;
  account: Account;
};

type EntryRow = {
  key: number;
  accountId: string;
  type: 'DEBIT' | 'CREDIT';
  amount: string;
  description: string;
};

type Mode = 'quick' | 'free' | 'advanced';

type Props = {
  periodId: string;
  onSuccess: () => void;
  onCancel: () => void;
};

const LAST_SOCIEDAD_KEY = 'lastSociedadId';

export function TransactionForm({ periodId, onSuccess, onCancel }: Props) {
  const [mode, setMode] = useState<Mode>('quick');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Nuevo Movimiento</CardTitle>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={mode} onValueChange={(v) => setMode((v as Mode) ?? 'quick')}>
          <TabsList>
            <TabsTrigger value="quick">Modo rápido</TabsTrigger>
            <TabsTrigger value="free">Sin sociedad</TabsTrigger>
            <TabsTrigger value="advanced">Avanzado</TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === 'quick' && (
          <QuickModeForm periodId={periodId} onSuccess={onSuccess} onCancel={onCancel} />
        )}
        {mode === 'free' && (
          <FreeModeForm periodId={periodId} onSuccess={onSuccess} onCancel={onCancel} />
        )}
        {mode === 'advanced' && (
          <AdvancedModeForm periodId={periodId} onSuccess={onSuccess} onCancel={onCancel} />
        )}
      </CardContent>
    </Card>
  );
}

// ─── Quick mode (Modo Mariana) ──────────────────────────────────────────────

function QuickModeForm({ periodId, onSuccess, onCancel }: Props) {
  const [action, setAction] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [sociedadId, setSociedadId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [originAccountId, setOriginAccountId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'CHECK' | ''>('');
  const [checkNumber, setCheckNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const descriptionRef = useRef<HTMLInputElement>(null);

  const { data: entities } = useQuery<Entity[]>('/entities', { onlySociedades: true });
  const { data: accounts } = useQuery<Account[]>('/accounts');
  const { data: members } = useQuery<SociedadMember[]>(
    sociedadId ? `/sociedad-members/sociedad/${sociedadId}` : null,
  );

  // Restore last sociedad from localStorage on first mount (if still valid).
  useEffect(() => {
    if (!entities || sociedadId) return;
    const last = typeof window !== 'undefined' ? window.localStorage.getItem(LAST_SOCIEDAD_KEY) : null;
    if (last && entities.some((e) => e.id === last && e.type === 'COMPANY')) {
      setSociedadId(last);
    }
  }, [entities, sociedadId]);

  useEffect(() => {
    if (sociedadId && typeof window !== 'undefined') {
      window.localStorage.setItem(LAST_SOCIEDAD_KEY, sociedadId);
    }
  }, [sociedadId]);

  const sociedadOptions: ComboboxOption[] = useMemo(
    () => (entities || []).filter((e) => e.type === 'COMPANY').map((e) => ({
      value: e.id,
      label: e.name,
    })),
    [entities],
  );

  // Origen list: banks of this sociedad (percentBps = 0, type BANK) + global CASH accounts.
  const originOptions: ComboboxOption[] = useMemo(() => {
    const banks = (members || [])
      .filter((m) => m.account.type === 'BANK')
      .map((m) => ({
        value: m.account.id,
        label: m.account.name,
        sublabel: `Banco · ${m.account.currency}`,
      }));
    const cashes = (accounts || [])
      .filter((a) => a.type === 'CASH')
      .map((a) => ({
        value: a.id,
        label: a.name,
        sublabel: `Efectivo · ${a.currency}`,
      }));
    return [...banks, ...cashes];
  }, [members, accounts]);

  const selectedOrigin = useMemo(
    () => (accounts || []).find((a) => a.id === originAccountId) ?? null,
    [accounts, originAccountId],
  );
  const originIsBank = selectedOrigin?.type === 'BANK';

  useEffect(() => {
    // Reset payment method when origin changes
    if (!selectedOrigin) return;
    if (selectedOrigin.type === 'CASH') setPaymentMethod('CASH');
    else if (selectedOrigin.type === 'BANK' && paymentMethod === 'CASH') setPaymentMethod('BANK_TRANSFER');
  }, [selectedOrigin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Focus description shortly after sociedad is picked
    if (sociedadId) descriptionRef.current?.focus();
  }, [sociedadId]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  };

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!sociedadId) return toast.error('Elegí una sociedad');
    if (!originAccountId) return toast.error('Elegí de dónde sale/entra la plata');
    if (!description.trim()) return toast.error('Escribí un concepto');
    const centavos = inputToCentavos(amount);
    if (centavos === '0') return toast.error('Monto inválido');

    // Origin entry: expense → CREDIT origin (sale plata); income → DEBIT origin (entra plata).
    const originEntry = {
      accountId: originAccountId,
      type: (action === 'EXPENSE' ? 'CREDIT' : 'DEBIT') as 'DEBIT' | 'CREDIT',
      amount: centavos,
      description: description.trim(),
    };

    setSubmitting(true);
    try {
      await apiFetch('/transactions', {
        method: 'POST',
        body: {
          periodId,
          description: description.trim(),
          type: action,
          paymentMethod: paymentMethod || null,
          checkNumber: paymentMethod === 'CHECK' ? (checkNumber || null) : null,
          sociedadId,
          notes: notes || null,
          idempotencyKey: crypto.randomUUID(),
          entries: [originEntry],
        },
      });
      toast.success('Movimiento registrado y distribuido a los socios');
      onSuccess();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al crear movimiento');
    } finally {
      setSubmitting(false);
    }
  }, [periodId, sociedadId, description, amount, originAccountId, action, paymentMethod, checkNumber, notes, onSuccess]);

  const membersWithPercent = (members || []).filter((m) => m.percentBps > 0);
  const totalPct = membersWithPercent.reduce((s, m) => s + m.percentBps, 0) / 100;
  const sociedadValid = sociedadId ? totalPct === 100 : true;

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>¿Qué hiciste?</Label>
          <Select value={action} onValueChange={(v) => setAction((v as 'EXPENSE' | 'INCOME') ?? 'EXPENSE')}>
            <SelectTrigger><SelectValue labels={{ EXPENSE: 'Gasto', INCOME: 'Ingreso' }} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="EXPENSE">Gasto</SelectItem>
              <SelectItem value="INCOME">Ingreso</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Sociedad *</Label>
          <Combobox
            options={sociedadOptions}
            value={sociedadId}
            onChange={setSociedadId}
            placeholder="Seleccionar sociedad..."
            searchPlaceholder="Buscar sociedad..."
          />
        </div>
      </div>

      {sociedadId && !sociedadValid && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          Los % de los socios no suman 100% (actual: {totalPct.toFixed(2)}%). Ajustá la sociedad antes de cargar.
        </div>
      )}

      <div className="space-y-1">
        <Label>Concepto *</Label>
        <Input
          ref={descriptionRef}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ej: ABL, expensas, alquiler mayo"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Monto *</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
        <div className="space-y-1">
          <Label>{action === 'EXPENSE' ? 'Pagué con' : 'Cobré por'} *</Label>
          <Combobox
            options={originOptions}
            value={originAccountId}
            onChange={setOriginAccountId}
            placeholder={sociedadId ? 'Banco o efectivo...' : 'Elegí sociedad primero'}
            searchPlaceholder="Buscar cuenta..."
            disabled={!sociedadId}
          />
        </div>
      </div>

      {originIsBank && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Medio</Label>
            <Select value={paymentMethod || 'BANK_TRANSFER'} onValueChange={(v) => setPaymentMethod((v as 'BANK_TRANSFER' | 'CHECK') ?? 'BANK_TRANSFER')}>
              <SelectTrigger><SelectValue labels={{ BANK_TRANSFER: 'Transferencia', CHECK: 'Cheque' }} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BANK_TRANSFER">Transferencia</SelectItem>
                <SelectItem value="CHECK">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {paymentMethod === 'CHECK' && (
            <div className="space-y-1">
              <Label>Nro. de cheque</Label>
              <Input
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                placeholder="Ej: 00123456"
              />
            </div>
          )}
        </div>
      )}

      <div className="space-y-1">
        <Label>Notas (opcional)</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting || !sociedadId || !originAccountId || !description || !amount || !sociedadValid}>
          {submitting ? 'Guardando...' : 'Guardar (Ctrl+Enter)'}
        </Button>
      </div>

      {sociedadId && membersWithPercent.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Se distribuirá entre {membersWithPercent.length} socios: {membersWithPercent.map((m) => `${m.account.name} (${(m.percentBps / 100).toFixed(2)}%)`).join(' · ')}
        </p>
      )}
    </form>
  );
}

// ─── Free mode (no sociedad, origen + destino) ──────────────────────────────

function FreeModeForm({ periodId, onSuccess, onCancel }: Props) {
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'INCOME' | 'EXPENSE' | 'TRANSFER' | 'ADJUSTMENT'>('EXPENSE');
  const [originAccountId, setOriginAccountId] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: accounts } = useQuery<Account[]>('/accounts');

  const accountOptions: ComboboxOption[] = (accounts || []).map((a) => ({
    value: a.id,
    label: a.name,
    sublabel: `${a.path} · ${a.currency}`,
  }));

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  };

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!originAccountId || !destinationAccountId) return toast.error('Origen y destino son obligatorios');
    if (originAccountId === destinationAccountId) return toast.error('Origen y destino deben ser distintos');
    const centavos = inputToCentavos(amount);
    if (centavos === '0') return toast.error('Monto inválido');

    // Free mode: type determines which is debit/credit. EXPENSE: origin CREDIT, destination DEBIT.
    const originType: 'DEBIT' | 'CREDIT' = type === 'INCOME' ? 'DEBIT' : 'CREDIT';
    const destType: 'DEBIT' | 'CREDIT' = type === 'INCOME' ? 'CREDIT' : 'DEBIT';

    setSubmitting(true);
    try {
      await apiFetch('/transactions', {
        method: 'POST',
        body: {
          periodId,
          description: description.trim() || 'Movimiento sin sociedad',
          type,
          notes: notes || null,
          idempotencyKey: crypto.randomUUID(),
          entries: [
            { accountId: originAccountId, type: originType, amount: centavos, description: description.trim() || null },
            { accountId: destinationAccountId, type: destType, amount: centavos, description: description.trim() || null },
          ],
        },
      });
      toast.success('Movimiento creado');
      onSuccess();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al crear movimiento');
    } finally {
      setSubmitting(false);
    }
  }, [periodId, description, type, originAccountId, destinationAccountId, amount, notes, onSuccess]);

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Tipo</Label>
          <Select value={type} onValueChange={(v) => setType((v as typeof type) ?? 'EXPENSE')}>
            <SelectTrigger><SelectValue labels={{ EXPENSE: 'Gasto', INCOME: 'Ingreso', TRANSFER: 'Transferencia', ADJUSTMENT: 'Ajuste' }} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="EXPENSE">Gasto</SelectItem>
              <SelectItem value="INCOME">Ingreso</SelectItem>
              <SelectItem value="TRANSFER">Transferencia</SelectItem>
              <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Descripción</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Concepto"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>{type === 'INCOME' ? 'Entra en' : 'Sale de'} *</Label>
          <Combobox
            options={accountOptions}
            value={originAccountId}
            onChange={setOriginAccountId}
            placeholder="Cuenta origen..."
            searchPlaceholder="Buscar cuenta..."
          />
        </div>
        <div className="space-y-1">
          <Label>{type === 'INCOME' ? 'Origen' : 'Destino'} *</Label>
          <Combobox
            options={accountOptions}
            value={destinationAccountId}
            onChange={setDestinationAccountId}
            placeholder="Cuenta destino..."
            searchPlaceholder="Buscar cuenta..."
          />
        </div>
        <div className="space-y-1">
          <Label>Monto *</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Notas (opcional)</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={submitting || !originAccountId || !destinationAccountId || !amount}>
          {submitting ? 'Guardando...' : 'Guardar (Ctrl+Enter)'}
        </Button>
      </div>
    </form>
  );
}

// ─── Advanced mode (raw DEBIT/CREDIT entries) ───────────────────────────────

function AdvancedModeForm({ periodId, onSuccess, onCancel }: Props) {
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
      toast.error('El asiento no balancea.');
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
      toast.success('Movimiento creado');
      onSuccess();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al crear movimiento');
    } finally {
      setSubmitting(false);
    }
  }, [periodId, description, type, paymentMethod, checkNumber, bankReference, notes, entries, isBalanced, onSuccess]);

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>Descripción *</Label>
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
          <Select value={type} onValueChange={(v) => setType(v ?? '')}>
            <SelectTrigger><SelectValue labels={{ INCOME: 'Ingreso', EXPENSE: 'Gasto', TRANSFER: 'Transferencia', BANK_FEE: 'Gasto Bancario', ADJUSTMENT: 'Ajuste' }} /></SelectTrigger>
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
          <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v ?? '')}>
            <SelectTrigger><SelectValue labels={{ CASH: 'Efectivo', BANK_TRANSFER: 'Transferencia', CHECK: 'Cheque' }} /></SelectTrigger>
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
          <Label>Número de Cheque</Label>
          <Input value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} />
        </div>
      )}
      {paymentMethod === 'BANK_TRANSFER' && (
        <div className="space-y-1">
          <Label>Referencia Bancaria</Label>
          <Input value={bankReference} onChange={(e) => setBankReference(e.target.value)} />
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Líneas del Movimiento</Label>
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
              <Plus className="h-3 w-3 mr-1" /> Línea
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
                    <SelectValue labels={{ DEBIT: 'Débito', CREDIT: 'Crédito' }} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEBIT">Débito</SelectItem>
                    <SelectItem value="CREDIT">Crédito</SelectItem>
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
          <span>Débitos: {totalDebits.toFixed(2)}</span>
          <span>Créditos: {totalCredits.toFixed(2)}</span>
          <span>Diferencia: {Math.abs(totalDebits - totalCredits).toFixed(2)}</span>
        </div>
      </div>

      <div className="space-y-1">
        <Label>Notas (opcional)</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={submitting || !isBalanced}>
          {submitting ? 'Guardando...' : 'Guardar (Ctrl+Enter)'}
        </Button>
      </div>
    </form>
  );
}
