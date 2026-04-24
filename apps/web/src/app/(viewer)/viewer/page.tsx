'use client';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';

export default function ViewerPlaceholder() {
  const { logout } = useAuth();
  return (
    <>
      <h1 className="text-2xl font-semibold">Vista temporalmente no disponible</h1>
      <p className="text-muted-foreground">
        Estamos rediseñando esta sección para que sea más clara. Volverá a estar disponible pronto.
      </p>
      <div className="pt-2">
        <Button variant="outline" onClick={logout}>Cerrar sesión</Button>
      </div>
    </>
  );
}
