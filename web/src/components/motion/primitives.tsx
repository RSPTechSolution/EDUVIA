"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Entrances are CSS animations (see "enter" in globals.css): they need no animation library in every page's JavaScript,
// run off the main thread, and stop for people who ask their system for less motion.
//
// Content the server rendered is shown as it arrives: hiding it until JavaScript runs an entrance animation delays the
// first paint (LCP) and makes the page flash. Entrances only play for content that appears after the page has loaded,
// such as data arriving or moving to another page.
let pageLoaded = false;

/** True while the first page is hydrating, when entrance animations are skipped. */
function useFirstPaint() {
  const [first] = useState(() => !pageLoaded);
  useEffect(() => {
    pageLoaded = true;
  }, []);
  return first;
}

/** Fades and lifts content in when it first appears. */
export function FadeIn({ children, delay = 0, y = 12, className }: { children: React.ReactNode; delay?: number; y?: number; className?: string }) {
  const first = useFirstPaint();
  return (
    <div className={cn(!first && "enter", className)} style={first ? undefined : ({ animationDelay: `${delay}s`, "--enter-y": `${y}px` } as React.CSSProperties)}>
      {children}
    </div>
  );
}

/** Children wrapped in <StaggerItem> enter one after another. */
export function Stagger({ children, className, as: Comp = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "ul" | "ol" }) {
  const first = useFirstPaint();
  return <Comp className={cn(!first && "enter-stagger", className)}>{children}</Comp>;
}

export function StaggerItem({ children, className, as: Comp = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "li" }) {
  return <Comp className={className}>{children}</Comp>;
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const easeOut = (t: number) => 1 - (1 - t) ** 5; // soft "out-quint"

/** Counts up to `value` the first time it scrolls into view. */
export function AnimatedNumber({ value, format = (n) => Math.round(n).toLocaleString("en-IN") }: { value: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const first = useFirstPaint();
  const [shown, setShown] = useState(first ? value : 0);
  const from = useRef(first ? value : 0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const run = () => {
      const start = from.current;
      from.current = value;
      if (start === value || reducedMotion()) return setShown(value);
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / 900);
        setShown(start + (value - start) * easeOut(t));
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      run();
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return <span ref={ref} className="tabular">{format(shown)}</span>;
}

/** A short cross-fade between pages, keyed by the caller (e.g. pathname). No sliding, so nothing appears to move. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const first = useFirstPaint();
  return <div className={first ? undefined : "enter-fade"}>{children}</div>;
}
