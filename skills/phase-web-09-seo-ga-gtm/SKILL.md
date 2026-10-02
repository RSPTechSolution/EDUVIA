---
name: schoolerp-web-phase-09-seo-ga-gtm
description: >
  Web Phase 9 — SEO, performance, Google Analytics 4, Google Tag Manager,
  Core Web Vitals, accessibility audit, PWA setup, error monitoring (Sentry),
  and production build optimisation. Use when setting up analytics tracking,
  SEO metadata, GTM events, or performance improvements.
---

# Web Phase 9 — SEO, GA4, GTM & Performance
## Next.js 15 · Google Analytics 4 · Google Tag Manager

---

## SEO Architecture

### Why Dashboard Pages Are noindex

The school ERP dashboard is private (login required). Public SEO applies only to:
- The login page
- The school website builder output (public-facing school site)
- Any marketing/landing pages

```typescript
// Rule: dashboard pages = noindex, nofollow
// Rule: public school site pages = full SEO

// web/src/app/(dashboard)/layout.tsx
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// web/src/app/(auth)/login/page.tsx
export const metadata: Metadata = {
  title: 'Sign In — SchoolERP',
  description: 'Sign in to your SchoolERP dashboard to manage students, fees, attendance and more.',
  robots: { index: true, follow: false },
  openGraph: {
    title: 'SchoolERP — School Management System',
    description: 'Professional school management for modern schools.',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
};
```

### Structured Data for School Website Builder

When a school uses the website builder feature, those public pages get full SEO:

```tsx
// web/src/app/school/[slug]/page.tsx
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const school = await getSchoolPublicInfo(params.slug);
  return {
    title: `${school.name} — ${school.tagline}`,
    description: school.description,
    keywords: [school.name, school.city, 'school', 'education'],
    openGraph: {
      title: school.name,
      description: school.description,
      images: [{ url: school.logo, width: 400, height: 400 }],
      type: 'website',
    },
    alternates: {
      canonical: `https://${school.domain ?? `${school.slug}.schoolerp.com`}`,
    },
  };
}

// JSON-LD structured data for school
function SchoolStructuredData({ school }: { school: PublicSchool }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: school.name,
    description: school.description,
    url: school.website,
    logo: school.logo,
    address: {
      '@type': 'PostalAddress',
      streetAddress: school.address,
      addressLocality: school.city,
      addressRegion: school.state,
      addressCountry: 'IN',
    },
    telephone: school.phone,
    email: school.email,
    sameAs: [school.facebook, school.twitter].filter(Boolean),
  };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
  );
}
```

---

## Google Tag Manager Setup

### Step 1: GTM Container in Layout

```tsx
// web/src/components/analytics/GTM.tsx
// Using Next.js Script component for performance

import Script from 'next/script';

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID; // e.g. GTM-XXXXXXX

export function GTMScript() {
  if (!GTM_ID) return null;
  return (
    <Script id="gtm-script" strategy="afterInteractive">
      {`
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','${GTM_ID}');
      `}
    </Script>
  );
}

export function GTMNoScript() {
  if (!GTM_ID) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0" width="0"
        style={{ display: 'none', visibility: 'hidden' }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}
```

```tsx
// web/src/app/layout.tsx — add GTM to root layout
import { GTMScript, GTMNoScript } from '@/components/analytics/GTM';

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <GTMScript />
      </head>
      <body>
        <GTMNoScript />
        {/* ... rest of layout ... */}
      </body>
    </html>
  );
}
```

### Step 2: DataLayer Push Utility

```typescript
// web/src/lib/analytics.ts

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
    gtag?: (...args: unknown[]) => void;
  }
}

// Safe dataLayer push — works even if GTM hasn't loaded yet
export function pushDataLayer(event: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(event);
}

// Typed event helpers — use these everywhere instead of raw pushDataLayer
export const analytics = {
  // Page view (GTM fires GA4 pageview via trigger)
  pageView: (path: string, title: string) => pushDataLayer({
    event: 'page_view',
    page_path: path,
    page_title: title,
  }),

  // User events
  login: (method: string, role: string) => pushDataLayer({
    event: 'login',
    method,
    user_role: role,
  }),

  // Student events
  studentCreated: (classId: string) => pushDataLayer({
    event: 'student_created',
    class_id: classId,
  }),

  studentImported: (count: number) => pushDataLayer({
    event: 'student_imported',
    student_count: count,
  }),

  // Fee events
  feeCollected: (amount: number, method: string) => pushDataLayer({
    event: 'fee_collected',
    fee_amount: amount,
    payment_method: method,
    currency: 'INR',
  }),

  // Attendance events
  attendanceMarked: (sectionId: string, count: number, method: string) => pushDataLayer({
    event: 'attendance_marked',
    section_id: sectionId,
    student_count: count,
    marking_method: method,   // manual | qr_scan | biometric
  }),

  // Exam events
  examPublished: (examId: string, mode: string) => pushDataLayer({
    event: 'exam_published',
    exam_id: examId,
    exam_mode: mode,   // exam | quiz | practice
  }),

  // Feature usage
  featureUsed: (featureName: string, context?: string) => pushDataLayer({
    event: 'feature_used',
    feature_name: featureName,
    context,
  }),

  // AI Assistant
  aiQuery: (intent: string) => pushDataLayer({
    event: 'ai_query',
    intent_name: intent,
  }),

  // Error tracking
  error: (errorCode: string, errorMessage: string, page: string) => pushDataLayer({
    event: 'app_error',
    error_code: errorCode,
    error_message: errorMessage,
    page_path: page,
  }),
};
```

### Step 3: Route Change Tracking

```tsx
// web/src/components/analytics/RouteAnalytics.tsx
'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { analytics } from '@/lib/analytics';

export function RouteAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const url = pathname + (searchParams.toString() ? `?${searchParams}` : '');
    analytics.pageView(url, document.title);
  }, [pathname, searchParams]);

  return null;
}

// Add to root layout inside <Suspense>
// web/src/app/layout.tsx
<Suspense fallback={null}>
  <RouteAnalytics />
</Suspense>
```

---

## Google Analytics 4 — Via GTM

Configure in GTM (no code changes needed):

```
GTM Configuration:
1. Create GA4 Configuration Tag
   - Tag Type: Google Analytics: GA4 Configuration
   - Measurement ID: G-XXXXXXXXXX (from GA4 property)
   - Trigger: All Pages

2. Create Custom Event Tags (one per analytics event above):
   - Tag: "GA4 - Fee Collected"
     - Tag Type: GA4 Event
     - Event Name: {{DLV - event}}
     - Parameters: fee_amount={{DLV - fee_amount}}, payment_method={{DLV - payment_method}}
     - Trigger: Custom Event = fee_collected

3. Data Layer Variables (create for each DLV used):
   - DLV - fee_amount      → dataLayer variable "fee_amount"
   - DLV - payment_method  → dataLayer variable "payment_method"
   - DLV - user_role       → dataLayer variable "user_role"
   - (etc. for all parameters)

4. User Properties Tag (fires on login event):
   - Set user_role, school_id as GA4 user properties

5. Enhanced Measurement: enable in GA4 property settings
   - Page views: ✓ (handled by GTM)
   - Scrolls: ✓
   - Outbound clicks: ✓
   - Site search: custom event
   - Video: only if using embedded videos
   - File downloads: ✓ (for PDF/Excel exports)
```

---

## GA4 Event Map — What to Track

```typescript
// Complete event tracking matrix for SchoolERP

const GA4_EVENTS = {
  // Acquisition
  'login':                 { params: ['method', 'user_role'] },
  'logout':                { params: ['session_duration_minutes'] },

  // Student Module
  'student_created':       { params: ['class_id'] },
  'student_imported':      { params: ['student_count', 'error_count'] },
  'student_exported':      { params: ['format', 'student_count'] },
  'student_promoted':      { params: ['count', 'from_class', 'to_class'] },

  // Attendance Module
  'attendance_marked':     { params: ['method', 'student_count', 'present_count'] },
  'qr_scan_completed':     { params: ['mode', 'status'] },    // status: success|already_scanned

  // Finance Module
  'fee_collected':         { params: ['amount', 'payment_method', 'currency'] },
  'fee_reminder_sent':     { params: ['channel', 'recipient_count'] },
  'invoice_generated':     { params: ['student_count', 'academic_year'] },
  'tally_exported':        { params: ['record_count', 'date_range_days'] },

  // Exam Module
  'exam_published':        { params: ['mode', 'question_count', 'duration_minutes'] },
  'exam_submitted':        { params: ['mode', 'completion_pct', 'time_taken_minutes'] },
  'report_card_generated': { params: ['student_count', 'exam_id'] },

  // Communication
  'message_sent':          { params: ['channel', 'audience', 'recipient_count'] },
  'survey_published':      { params: ['question_count', 'audience'] },

  // AI Assistant
  'ai_query':              { params: ['intent', 'response_time_ms'] },
  'ai_query_failed':       { params: ['intent', 'reason'] },

  // Feature Usage
  'feature_used':          { params: ['feature_name', 'context'] },
  'export_downloaded':     { params: ['format', 'module', 'record_count'] },
  'pdf_generated':         { params: ['document_type'] },

  // Transport
  'trip_started':          { params: ['route_id', 'student_count'] },
  'sos_sent':              { params: ['trip_id'] },

  // Errors
  'app_error':             { params: ['error_code', 'module', 'page_path'] },
};
```

---

## Core Web Vitals & Performance

### Next.js Performance Config

```typescript
// web/next.config.ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  // Enable React strict mode
  reactStrictMode: true,

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    remotePatterns: [
      { protocol: 'https', hostname: '*.minio.schoolerp.com' },
      { protocol: 'https', hostname: 'covers.openlibrary.org' },
    ],
  },

  // Bundle analysis
  ...(process.env.ANALYZE === 'true' && {
    webpack(config: any) {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(new BundleAnalyzerPlugin({ analyzerMode: 'static' }));
      return config;
    },
  }),

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://www.google-analytics.com https://*.minio.schoolerp.com",
              "frame-src 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default config;
```

### Lazy Loading & Code Splitting

```tsx
// Heavy components — lazy load with next/dynamic
import dynamic from 'next/dynamic';

// Leaflet map (heavy — ~140KB)
const LiveTransportMap = dynamic(
  () => import('@/components/transport/LiveTransportMap'),
  {
    ssr: false,  // Leaflet requires browser DOM
    loading: () => <div className="h-full w-full animate-pulse bg-muted rounded-xl" aria-label="Loading map..." />,
  }
);

// Chart components (recharts — ~80KB)
const AnalyticsCharts = dynamic(
  () => import('@/components/analytics/AnalyticsCharts'),
  { loading: () => <ChartSkeleton /> }
);

// PDF viewer (heavy)
const PdfViewer = dynamic(
  () => import('@/components/ui/pdf-viewer'),
  { loading: () => <div className="h-96 animate-pulse bg-muted rounded" /> }
);
```

---

## PWA Setup

```typescript
// web/next.config.ts — add PWA
import withPWA from 'next-pwa';

const config = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/api\.schoolerp\.com\/api\/v1\/dashboard/,
      handler: 'NetworkFirst',
      options: { cacheName: 'dashboard-api', expiration: { maxAgeSeconds: 300 } },
    },
    {
      urlPattern: /\.(png|jpg|jpeg|svg|gif|webp|avif)$/,
      handler: 'CacheFirst',
      options: { cacheName: 'images', expiration: { maxEntries: 200, maxAgeSeconds: 86400 } },
    },
  ],
})({ ...nextConfig });
```

```json
// web/public/site.webmanifest
{
  "name": "SchoolERP",
  "short_name": "SchoolERP",
  "description": "School Management System",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#0E1117",
  "theme_color": "#1A6FE8",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

---

## Accessibility Audit Checklist

```bash
# Run after each web phase
pnpm add -D @axe-core/playwright

# web/e2e/accessibility.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('dashboard has no critical violations', async ({ page }) => {
    await loginAs(page, 'school_admin');
    await page.goto('/dashboard');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('students page has no critical violations', async ({ page }) => {
    await loginAs(page, 'school_admin');
    await page.goto('/students');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(v => v.impact === 'critical')).toHaveLength(0);
  });
});
```

### Manual Accessibility Checklist

```
Keyboard navigation:
  ☐ Tab through every interactive element on dashboard
  ☐ Sidebar can be collapsed/expanded with Enter key
  ☐ Command palette opens with Ctrl/Cmd+K
  ☐ All dropdown menus close with Escape
  ☐ DataTable rows can be selected with Space
  ☐ Date pickers navigable with arrow keys

Screen reader:
  ☐ Page title changes on navigation (document.title)
  ☐ Stat cards announce trend direction ("increased 12%")
  ☐ Chart data announced via aria-describedby fallback table
  ☐ Loading states announced via role="status"
  ☐ Success/error toasts via aria-live="polite"

Color & contrast:
  ☐ All text passes 4.5:1 contrast (use browser DevTools)
  ☐ Status badges pass 3:1 (check StatusBadge component)
  ☐ Charts have non-color differentiation (patterns/labels)
  ☐ Focus rings visible in both light and dark mode

Forms:
  ☐ Every input has a visible <label> or aria-label
  ☐ Required fields marked with aria-required="true"
  ☐ Error messages linked via aria-describedby
  ☐ Form submission feedback announced
```

---

## Error Monitoring (Sentry)

```bash
pnpm add @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

```typescript
// web/sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration()],
  // Don't send errors for these URLs (e.g. ad blockers blocking GA)
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection',
  ],
  beforeSend(event) {
    // Strip personal data before sending
    if (event.user) {
      event.user = { id: event.user.id, role: (event.user as any).role };
    }
    return event;
  },
});
```

---

## Production Checklist

```bash
# 1. Build check
pnpm build
pnpm lint
pnpm type-check   # tsc --noEmit

# 2. Bundle analysis
ANALYZE=true pnpm build
# Target: main bundle < 200KB gzipped

# 3. Lighthouse audit
npx lighthouse http://localhost:3000/login --output json
# Targets: Performance >90, Accessibility >95, Best Practices >95, SEO >90

# 4. Accessibility audit
pnpm playwright test e2e/accessibility.spec.ts

# 5. Core Web Vitals targets
# LCP (Largest Contentful Paint): < 2.5s
# FID / INP (Interaction to Next Paint): < 200ms
# CLS (Cumulative Layout Shift): < 0.1

# 6. Verify GTM/GA4
# Open Chrome DevTools → Network → filter "google-analytics" and "googletagmanager"
# Confirm events firing on: login, page_view, fee_collected
```

---

## Antigravity Prompt for Web Phase 9

```
@file skills/master-plan/SKILL.md
@file skills/phase-web-09-seo-ga-gtm/SKILL.md

Build Web Phase 9 — SEO, GA4, GTM & Performance:
1. Add GTMScript + GTMNoScript to root layout using next/script afterInteractive
2. Create analytics.ts utility with all typed event helpers (login, feeCollected,
   attendanceMarked, aiQuery, featureUsed, etc.)
3. Add RouteAnalytics component for SPA page_view tracking in Suspense boundary
4. Fire analytics events at all key user actions:
   - login/logout in AuthNotifier
   - feeCollected in CollectFeeDialog onSuccess
   - attendanceMarked in attendance save handler
   - studentCreated/studentImported in student forms
   - examPublished in exam builder
   - aiQuery in AI chat send handler
   - featureUsed in sidebar nav click handler
5. Add JSON-LD EducationalOrganization schema for school public pages
6. Set up next.config.ts with security headers (CSP, X-Frame-Options, etc.)
7. Lazy-load heavy components: Leaflet map (ssr:false), recharts, PDF viewer
8. Add next-pwa with runtime caching for dashboard API and images
9. Create site.webmanifest with correct theme colors and icons
10. Set up Sentry with beforeSend to strip PII, sampling config
11. Add Playwright accessibility test for dashboard + students page (axe-core)
12. Run: pnpm build (no errors) && pnpm lint && pnpm playwright test e2e/accessibility.spec.ts
```
