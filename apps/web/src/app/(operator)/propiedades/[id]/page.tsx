'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@/lib/hooks';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import { label, alquilerStatusLabels } from '@/lib/labels';
import { MovimientosPanel } from '@/components/movimientos-panel';
import { EntityEditDialog } from '@/components/entity-edit-dialog';

type Propiedad = {
  id: string;
  nombre: string;
  direccion: string;
  descripcion: string | null;
  notes: string | null;
  isActive: boolean;
  sociedad: { id: string; name: string };
  alquileres: Array<{
    id: string;
    numero: number;
    status: 'ACTIVO' | 'FINALIZADO';
    fechaInicio: string;
    fechaFin: string | null;
    finalizadoEn: string | null;
    inquilino: { id: string; name: string };
  }>;
};

export default function PropiedadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: p, refetch } = useQuery<Propiedad>(`/propiedades/${id}`);
  const [editOpen, setEditOpen] = useState(false);

  if (!p) return <div className="text-muted-foreground">Cargando…</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={p.nombre}
        description={p.direccion}
        actions={
          <div className="flex items-center gap-2">
            {p.isActive ? <Badge variant="outline">Activa</Badge> : <Badge variant="secondary">Inactiva</Badge>}
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Editar
            </Button>
          </div>
        }
      />

      <EntityEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        endpoint={`/propiedades/${id}`}
        current={{ nombre: p.nombre, notes: p.notes }}
        entityLabel="propiedad"
        config={{ nameKey: 'nombre' }}
        onSaved={refetch}
        archiveRedirectTo="/propiedades"
      />

      <Card>
        <CardHeader><CardTitle className="text-sm">Datos</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="text-muted-foreground">Sociedad:</span> <Link href={`/sociedades/${p.sociedad.id}`} className="hover:underline">{p.sociedad.name}</Link></div>
          {p.descripcion && <div><span className="text-muted-foreground">Descripción:</span> {p.descripcion}</div>}
          {p.notes && <div className="whitespace-pre-wrap text-muted-foreground">{p.notes}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Alquileres ({p.alquileres.length})</CardTitle></CardHeader>
        <CardContent>
          {p.alquileres.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin alquileres.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left font-normal py-1">#</th>
                  <th className="text-left font-normal py-1">Inquilino</th>
                  <th className="text-left font-normal py-1">Estado</th>
                  <th className="text-left font-normal py-1">Inicio</th>
                  <th className="text-left font-normal py-1">Fin</th>
                </tr>
              </thead>
              <tbody>
                {p.alquileres.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-muted/30">
                    <td className="py-2">
                      <Link href={`/alquileres/${c.id}`} className="font-mono text-xs hover:underline">#{c.numero}</Link>
                    </td>
                    <td className="py-2">{c.inquilino.name}</td>
                    <td className="py-2">
                      {c.status === 'ACTIVO'
                        ? <Badge variant="outline">{label(alquilerStatusLabels, c.status)}</Badge>
                        : <Badge variant="secondary">{label(alquilerStatusLabels, c.status)}</Badge>}
                    </td>
                    <td className="py-2">{formatDate(c.fechaInicio)}</td>
                    <td className="py-2">
                      {c.finalizadoEn
                        ? <span className="text-muted-foreground">Finalizado {formatDate(c.finalizadoEn)}</span>
                        : c.fechaFin ? formatDate(c.fechaFin) : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <MovimientosPanel
        scope={{ propiedadId: id }}
        filenameHint={`propiedad-${p.nombre}`}
      />
    </div>
  );
}
