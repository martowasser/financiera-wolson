'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@/lib/hooks';

type Entity = {
  id: string;
  name: string;
  type: string;
  taxId: string | null;
  isActive: boolean;
};

type TabValue = 'sociedades' | 'personas';

const typeLabels: Record<string, string> = {
  COMPANY: 'Sociedad',
  PERSON: 'Persona',
  FIRM: 'Empresa',
  THIRD_PARTY: 'Tercero',
};

const tabDescription: Record<TabValue, string> = {
  sociedades: 'Empresas y sociedades',
  personas: 'Personas físicas, financieras y terceros',
};

const columns: Column<Entity>[] = [
  { header: 'Nombre', accessor: 'name' },
  {
    header: 'Tipo',
    accessor: (row) => (
      <Badge variant="outline">{typeLabels[row.type] ?? row.type}</Badge>
    ),
  },
  { header: 'CUIT', accessor: (row) => row.taxId ?? '-' },
];

export default function ViewerEntitiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: TabValue = tabParam === 'personas' ? 'personas' : 'sociedades';

  const handleTabChange = useCallback(
    (v: string | null) => {
      const next: TabValue = v === 'personas' ? 'personas' : 'sociedades';
      if (next !== activeTab) router.push(`/viewer/entities?tab=${next}`);
    },
    [router, activeTab],
  );

  return (
    <>
      <PageHeader
        title="Sociedades y Personas"
        description={tabDescription[activeTab]}
      />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="sociedades">Sociedades</TabsTrigger>
          <TabsTrigger value="personas">Personas</TabsTrigger>
        </TabsList>
      </Tabs>

      <ViewerEntityList key={activeTab} activeTab={activeTab} />
    </>
  );
}

function ViewerEntityList({ activeTab }: { activeTab: TabValue }) {
  const router = useRouter();

  const queryParams = activeTab === 'sociedades'
    ? { type: 'COMPANY' }
    : { onlyPersonas: true };

  const { data: entities, isLoading } = useQuery<Entity[]>('/entities', queryParams);

  return (
    <DataTable
      columns={columns}
      data={entities}
      isLoading={isLoading}
      emptyMessage={activeTab === 'sociedades' ? 'No hay sociedades.' : 'No hay personas.'}
      rowKey={(row) => row.id}
      onRowClick={(row) => router.push(`/viewer/entities/${row.id}`)}
    />
  );
}
