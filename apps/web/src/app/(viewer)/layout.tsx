'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { ViewerSidebar } from '@/components/viewer-sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';

function ProtectedContent({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
    if (!isLoading && user && user.role !== 'VIEWER') {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'VIEWER') return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <ViewerSidebar />
      <main className="flex-1 overflow-auto">
        <div className="container max-w-6xl mx-auto px-6 py-6 space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function ViewerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <TooltipProvider>
        <ProtectedContent>{children}</ProtectedContent>
      </TooltipProvider>
    </AuthProvider>
  );
}
