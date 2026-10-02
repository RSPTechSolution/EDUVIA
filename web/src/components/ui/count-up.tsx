'use client';
import { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';

export function CountUp({ end, duration = 1000, decimals = 0 }: { end: number; duration?: number; decimals?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start = Math.min(start + increment, end);
      setCount(start);
      if (start >= end) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, end, duration]);

  return <span ref={ref}>{count.toLocaleString('en-IN', { maximumFractionDigits: decimals })}</span>;
}
