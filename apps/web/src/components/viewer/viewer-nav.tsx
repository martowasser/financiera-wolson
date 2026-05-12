'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Home, Wallet, LogOut } from 'lucide-react';

const items = [
  { href: '/viewer/alquileres', label: 'Mis alquileres', icon: Home },
  { href: '/viewer/posicion',   label: 'Mi posición',   icon: Wallet },
];

export function ViewerNav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <header className="border-b bg-background">
      <div className="container max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  'flex items-center gap-2 px-4 py-3 rounded-md transition-colors ' +
                  (active
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-foreground')
                }
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          {user && <span className="text-muted-foreground hidden sm:inline">Hola, {user.name}</span>}
          <Button variant="outline" size="lg" onClick={logout}>
            <LogOut className="h-5 w-5" />
            <span>Cerrar sesión</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
