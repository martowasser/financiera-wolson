'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import {
  LayoutDashboard,
  TrendingUpDown,
  Home,
  Building2,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

const navItems = [
  { href: '/viewer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/viewer/income-expenses', label: 'Ingresos y Gastos', icon: TrendingUpDown },
  { href: '/viewer/leases', label: 'Alquileres', icon: Home },
  { href: '/viewer/entities', label: 'Entidades', icon: Building2 },
];

export function ViewerSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="flex h-full w-56 flex-col border-r bg-card">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
          F
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">Financiera</span>
          <span className="text-xs text-muted-foreground">{user?.name}</span>
        </div>
      </div>
      <Separator />
      <ScrollArea className="flex-1 px-2 py-2">
        <nav className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground',
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
      <Separator />
      <div className="px-2 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesion
        </Button>
      </div>
    </aside>
  );
}
