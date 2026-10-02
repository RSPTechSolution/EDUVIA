import type { Metadata, Viewport } from 'next';
import { inter, plusJakarta, jetbrainsMono } from '@/lib/fonts';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { Toaster } from 'sonner';
import { cn } from '@/lib/utils';
import { Suspense } from 'react';
import { GTMScript, GTMNoScript } from '@/components/analytics/GTM';
import { RouteAnalytics } from '@/components/analytics/RouteAnalytics';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'SchoolERP', template: '%s | SchoolERP' },
  description: 'Professional school management system',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)',  color: '#0E1117' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cn(inter.variable, plusJakarta.variable, jetbrainsMono.variable)}>
      <head>
        <GTMScript />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased" suppressHydrationWarning>
        <GTMNoScript />
        <Suspense fallback={null}>
          <RouteAnalytics />
        </Suspense>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <QueryProvider>
            {children}
            <Toaster richColors closeButton position="bottom-right" />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
