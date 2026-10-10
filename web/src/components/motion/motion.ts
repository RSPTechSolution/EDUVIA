"use client";

// The animation library, for the few interactions that need it (expanding rows, list reordering, success ticks).
// Import it from here rather than "motion/react": this respects "reduce motion" without a provider around the whole
// app, which would put the library in every page's JavaScript.
import { MotionGlobalConfig } from "motion/react";

if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
  MotionGlobalConfig.skipAnimations = true;
}

export * from "motion/react";
