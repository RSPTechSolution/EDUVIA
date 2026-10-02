'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { analytics } from '@/lib/analytics';

export function RouteAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname) {
      const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
      analytics.pageView(url, document.title);
    }
  }, [pathname, searchParams]);

  return null;
}
