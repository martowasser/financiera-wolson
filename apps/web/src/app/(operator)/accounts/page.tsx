'use client';

import { useState, useCallback, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useQuery } from '@/lib/hooks';
import { apiFetch } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox, type ComboboxOption } from '@/components/combobox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil } from 'lucide-react';

type Account = {
  id: string;
  name: string;
  path: string;
  type: string;
  currency: string;
  normalBalance: string;
  bankName: string | null;
  bankAccountNum: string | null;
  debitsPosted: number;
  creditsPosted: number;
  isActive: boolean;
  entityId: string;
  entity?: { id: string; name: string };
};

type Entity = { id: string; name: string; type: string };

function getBalance(a: Account): number {
  if (a.normalBalance === 'DEBIT') return Number(a.debitsPosted) - Number(a.creditsPosted);
  return Number(a.creditsPosted) - Number(a.debitsPosted);
}

const typeLabels: Record<string, string> = {
  CASH: 'Efectivo',
  BANK: 'Banco',
  RECEIVABLE: 'Cobrar',
  PAYABLE: 'Pagar',
  EQUITY: 'Patrimonio',
  REVENUE: 'Ingreso',
  EXPENSE: 'Gasto',
};

export default function AccountsPage() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [tab, setTab] = useState('list');

  const { data: accounts, isLoading, refetch } = useQuery<Account[]>('/accounts', {
    search: search || undefined,
    type: filterType || undefined,
  });

  const { data: entities } = useQuery<Entity[]>('/entities');

  const entityOptions: ComboboxOption[] = (entities || []).map((e) => ({
    value: e.id,
    label: e.name,
    sublabel: e.type,
  }));

  const handleSaved = useCallback(() => {
    setShowForm(false);
    setEditing(null);
    refetch();
  }, [refetch]);

  // Build hierarchy tree
  const hierarchy = buildHierarchy(accounts || []);

  const columns: Column<Account>[] = [
    { header: 'Nombre', accessor: (row) => (
      <div>
        <span className="font-medium">{row.name}</span>
        <span className="text-xs text-muted-foreground ml-2">{row.entity?.name}</span>
      </div>
    ) },
    { header: 'Path', accessor: (row) => (
      <span className="font-mono text-xs text-muted-foreground">{row.path}</span>
    ) },
    { header: 'Tipo', accessor: (row) => (
      <Badge variant="outline" className="text-xs">{typeLabels[row.type] || row.type}</Badge>
    ), className: 'w-24' },
    { header: 'Moneda', accessor: 'currency', className: 'w-16' },
    { header: 'Saldo', accessor: (row) => (
      <span className="font-mono">{formatMoney(getBalance(row), row.currency)}</span>
    ), className: 'w-36 text-right' },
    { header: '', accessor: (row) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => { e.stopPropagation(); setEditing(row); setShowForm(true); }}
      >
        <Pencil className="h-3 w-3" />
      </Button>
    ), className: 'w-12' },
  ];

  return (
    <>
      <PageHeader
        title="Cuentas"
        description="Plan de cuentas con jerarquia"
        actions={
          <Button onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Nueva Cuenta
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v ?? "list")}>
        <TabsList>
          <TabsTrigger value="list">Lista</TabsTrigger>
          <TabsTrigger value="hierarchy">Jerarquia</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
            <Select value={filterType} onValueChange={(v) => setFilterType(v ?? "")}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="CASH">Efectivo</SelectItem>
                <SelectItem value="BANK">Banco</SelectItem>
                <SelectItem value="RECEIVABLE">Cobrar</SelectItem>
                <SelectItem value="PAYABLE">Pagar</SelectItem>
                <SelectItem value="EQUITY">Patrimonio</SelectItem>
                <SelectItem value="REVENUE">Ingreso</SelectItem>
                <SelectItem value="EXPENSE">Gasto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DataTable
            columns={columns}
            data={accounts}
            isLoading={isLoading}
            rowKey={(r) => r.id}
            emptyMessage="No hay cuentas."
          />
        </TabsContent>

        <TabsContent value="hierarchy">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Arbol de Cuentas</CardTitle>
            </CardHeader>
            <CardContent>
              {hierarchy.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay cuentas.</p>
              ) : (
                <HierarchyTree nodes={hierarchy} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AccountFormDialog
        open={showForm}
        account={editing}
        entityOptions={entityOptions}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSaved={handleSaved}
      />
    </>
  );
}

// Hierarchy tree types and rendering
type TreeNode = {
  segment: string;
  path: string;
  account: Account | null;
  children: TreeNode[];
};

function buildHierarchy(accounts: Account[]): TreeNode[] {
  const root: TreeNode[] = [];
  const sorted = [...accounts].sort((a, b) => a.path.localeCompare(b.path));

  for (const acc of sorted) {
    const parts = acc.path.split(':');
    let current = root;
    let currentPath = '';
    for (let i = 0; i < parts.length; i++) {
      currentPath = currentPath ? `${currentPath}:${parts[i]}` : parts[i];
      let node = current.find((n) => n.segment === parts[i]);
      if (!node) {
        node = {
          segment: parts[i],
          path: currentPath,
          account: i === parts.length - 1 ? acc : null,
          children: [],
        };
        current.push(node);
      } else if (i === parts.length - 1) {
        node.account = acc;
      }
      current = node.children;
    }
  }
  return root;
}

function HierarchyTree({ nodes, depth = 0 }: { nodes: TreeNode[]; depth?: number }) {
  return (
    <div className={depth > 0 ? 'ml-4 border-l pl-3' : ''}>
      {nodes.map((node) => (
        <div key={node.path} className="py-0.5">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className={node.account ? 'font-medium' : 'text-muted-foreground'}>
                {node.segment}
              </span>
              {node.account && (
                <Badge variant="outline" className="text-xs">
                  {node.account.currency}
                </Badge>
              )}
            </div>
            {node.account && (
              <span className="font-mono text-xs">
                {formatMoney(getBalance(node.account), node.account.currency)}
              </span>
            )}
          </div>
          {node.children.length > 0 && <HierarchyTree nodes={node.children} depth={depth + 1} />}
        </div>
      ))}
    </div>
  );
}

function AccountFormDialog({
  open,
  account,
  entityOptions,
  onClose,
  onSaved,
}: {
  open: boolean;
  account: Account | null;
  entityOptions: ComboboxOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!account;
  const [name, setName] = useState(account?.name || '');
  const [path, setPath] = useState(account?.path || '');
  const [type, setType] = useState(account?.type || 'CASH');
  const [currency, setCurrency] = useState(account?.currency || 'ARS');
  const [normalBalance, setNormalBalance] = useState(account?.normalBalance || 'DEBIT');
  const [entityId, setEntityId] = useState(account?.entityId || '');
  const [bankName, setBankName] = useState(account?.bankName || '');
  const [bankAccountNum, setBankAccountNum] = useState(account?.bankAccountNum || '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        name,
        path,
        type,
        currency,
        normalBalance,
        entityId,
        bankName: bankName || null,
        bankAccountNum: bankAccountNum || null,
      };
      if (isEdit) {
        await apiFetch(`/accounts/${account.id}`, { method: 'PUT', body });
        toast.success('Cuenta actualizada');
      } else {
        await apiFetch('/accounts', { method: 'POST', body });
        toast.success('Cuenta creada');
      }
      onSaved();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Editar Cuenta' : 'Nueva Cuenta'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-1">
              <Label>Sociedad *</Label>
              <Combobox
                options={entityOptions}
                value={entityId}
                onChange={setEntityId}
                placeholder="Seleccionar sociedad..."
              />
            </div>
            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-1">
              <Label>Path (jerarquia con ":")</Label>
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="Assets:Cash:ARS"
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={(v) => setType(v ?? "")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Efectivo</SelectItem>
                    <SelectItem value="BANK">Banco</SelectItem>
                    <SelectItem value="RECEIVABLE">Cobrar</SelectItem>
                    <SelectItem value="PAYABLE">Pagar</SelectItem>
                    <SelectItem value="EQUITY">Patrimonio</SelectItem>
                    <SelectItem value="REVENUE">Ingreso</SelectItem>
                    <SelectItem value="EXPENSE">Gasto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Moneda</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v ?? "")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">ARS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Saldo Normal</Label>
                <Select value={normalBalance} onValueChange={(v) => setNormalBalance(v ?? "")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEBIT">Debito</SelectItem>
                    <SelectItem value="CREDIT">Credito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {type === 'BANK' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Banco</Label>
                  <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Nro. Cuenta</Label>
                  <Input value={bankAccountNum} onChange={(e) => setBankAccountNum(e.target.value)} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving || !entityId}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
