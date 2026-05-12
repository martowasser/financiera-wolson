'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { ViewerNav } from '@/components/viewer/viewer-nav';

function ProtectedContent({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
    if (!isLoading && user && user.role !== 'VIEWER') router.push('/dashboard');
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }
  if (!user || user.role !== 'VIEWER') return null;

  return (
    <div className="viewer-theme min-h-screen bg-muted/20">
      <ViewerNav />
      <main className="container max-w-4xl mx-auto px-6 py-8 space-y-6">
        {children}
      </main>
    </div>
  );
}

export default function ViewerLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedContent>{children}</ProtectedContent>;
}
