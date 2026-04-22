'use client';

import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@/lib/hooks';

type Entity = {
  id: string;
  name: string;
  type: string;
  taxId: string | null;
  isActive: boolean;
};

const typeLabels: Record<string, string> = {
  COMPANY: 'Sociedad',
  PERSON: 'Persona',
  FIRM: 'Empresa',
  THIRD_PARTY: 'Tercero',
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
  const { data: entities, isLoading } = useQuery<Entity[]>('/entities');

  return (
    <>
      <PageHeader
        title="Sociedades"
        description="Sociedades, personas y terceros del sistema"
      />
      <DataTable
        columns={columns}
        data={entities}
        isLoading={isLoading}
        emptyMessage="No hay sociedades."
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(`/viewer/entities/${row.id}`)}
      />
    </>
  );
}
