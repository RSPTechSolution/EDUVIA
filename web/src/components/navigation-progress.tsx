"use client";

import { useIsMutating } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

const START_EVENT = "eduvia:navigation-start";
const HOLD_EVENT = "eduvia:progress-hold";
const RELEASE_EVENT = "eduvia:progress-release";

/** Call before navigating programmatically (router.push) so the bar appears at once. */
export function startNavigationProgress() {
  window.dispatchEvent(new Event(START_EVENT));
}

/** Rendered inside loading screens: keeps the bar going until the real page replaces them. */
export function ProgressHold() {
  useEffect(() => {
    window.dispatchEvent(new Event(HOLD_EVENT));
    return () => {
      window.dispatchEvent(new Event(RELEASE_EVENT));
    };
  }, []);
  return null;
}

function isInternalNavigation(e: MouseEvent): boolean {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const a = (e.target as Element | null)?.closest?.("a");
  if (!a || !a.href || a.target === "_blank" || a.hasAttribute("download")) return false;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return true; // e.g. sign-out redirects
  // Same page (or only the #hash changes): nothing to load.
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

function Bar() {
  const pathname = usePathname();
  const search = useSearchParams();
  const mutating = useIsMutating() > 0;
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const navigating = useRef(false);
  const holds = useRef(0);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(() => {
    if (hide.current) clearTimeout(hide.current);
    if (trickle.current) clearInterval(trickle.current);
    setVisible(true);
    setProgress(12);
    // Move quickly at first, then slow down, never quite reaching the end.
    trickle.current = setInterval(() => setProgress((p) => (p >= 90 ? p : p + (90 - p) * 0.12)), 180);
  }, []);

  const finish = useCallback(() => {
    if (trickle.current) clearInterval(trickle.current);
    trickle.current = null;
    setProgress(100);
    hide.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 320);
  }, []);

  // Link clicks, back/forward, and programmatic navigation.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (isInternalNavigation(e)) {
        navigating.current = true;
        start();
      }
    };
    const onStart = () => {
      navigating.current = true;
      start();
    };
    const onHold = () => {
      holds.current += 1;
      if (!trickle.current) start();
    };
    const onRelease = () => {
      holds.current = Math.max(0, holds.current - 1);
      if (holds.current === 0) {
        navigating.current = false;
        finish();
      }
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onStart);
    window.addEventListener(START_EVENT, onStart);
    window.addEventListener(HOLD_EVENT, onHold);
    window.addEventListener(RELEASE_EVENT, onRelease);
    return () => {
      window.removeEventListener(HOLD_EVENT, onHold);
      window.removeEventListener(RELEASE_EVENT, onRelease);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onStart);
      window.removeEventListener(START_EVENT, onStart);
    };
  }, [start, finish]);

  // The new page has rendered.
  useEffect(() => {
    // While a loading screen holds the bar, its release finishes it instead.
    if (navigating.current && holds.current === 0) {
      navigating.current = false;
      finish();
    }
  }, [pathname, search, finish]);

  // Saving something (any mutation) also shows the bar.
  useEffect(() => {
    if (navigating.current) return;
    if (mutating) start();
    else if (visible) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutating]);

  useEffect(() => () => {
    if (trickle.current) clearInterval(trickle.current);
    if (hide.current) clearTimeout(hide.current);
  }, []);

  return (
    <div
      aria-hidden
      // Base UI marks elements outside an open menu or dialog as inert; that attribute isn't ours.
      suppressHydrationWarning
      data-testid="nav-progress"
      data-state={visible ? "loading" : "idle"}
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 300ms ease" }}
    >
      <div
        className="h-full rounded-r-full bg-primary"
        style={{ width: `${progress}%`, transition: progress === 0 ? "none" : "width 200ms ease-out" }}
      />
    </div>
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
