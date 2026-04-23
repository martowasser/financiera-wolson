'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@/lib/hooks';
import type { PaletteCommand } from './types';

type EntitySummary = {
  id: string;
  name: string;
  type: string;
  taxId: string | null;
};

type TransactionSummary = {
  id: string;
  code: string;
  description: string;
  type: string;
  status: string;
  createdAt: string;
};

const TRANSACTION_LIMIT = 200;

const ENTITY_TYPE_LABEL: Record<string, string> = {
  COMPANY: 'Sociedad',
  PERSON: 'Persona',
  FIRM: 'Financiera',
  THIRD_PARTY: 'Tercero',
};

export function usePaletteData(isOpen: boolean): PaletteCommand[] {
  const router = useRouter();
  const { data: entities, refetch: refetchEntities } = useQuery<EntitySummary[]>('/entities');
  const { data: transactions, refetch: refetchTransactions } = useQuery<TransactionSummary[]>('/transactions');

  useEffect(() => {
    if (isOpen) {
      refetchEntities();
      refetchTransactions();
    }
  }, [isOpen, refetchEntities, refetchTransactions]);

  return useMemo(() => {
    const items: PaletteCommand[] = [];

    for (const e of entities ?? []) {
      items.push({
        id: `entity-${e.id}`,
        label: e.name,
        group: 'Sociedades',
        keywords: [ENTITY_TYPE_LABEL[e.type] ?? e.type, e.taxId ?? ''].filter(Boolean),
        run: () => router.push(`/entities?id=${e.id}`),
      });
    }

    const recentTxns = (transactions ?? []).slice(0, TRANSACTION_LIMIT);
    for (const t of recentTxns) {
      items.push({
        id: `txn-${t.id}`,
        label: `${t.code} · ${t.description}`,
        group: 'Movimientos',
        keywords: [t.type, t.status],
        run: () => router.push(`/transactions?id=${t.id}`),
      });
    }

    return items;
  }, [entities, transactions, router]);
}
