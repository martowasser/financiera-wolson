import type { Metadata } from 'next';
import { Inter, Geist_Mono } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Financiera - Sistema de Gestion',
  description: 'Sistema de gestion de transacciones financieras',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProviderWrapper>
          {children}
        </AuthProviderWrapper>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
