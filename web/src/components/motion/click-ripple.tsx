"use client";

import { useEffect } from "react";

// What gets a ripple when pressed: buttons (and links styled as buttons), clickable cards, navigation links, tabs and
// menu items. Anything can opt in with data-ripple, or out with data-no-ripple.
const TARGETS = [
  "[data-slot=button]", ".group\\/button", "[data-ripple]", ".card-lift", "nav a",
  "[role=tab]", "[role=menuitem]", "[role=menuitemradio]", "[role=menuitemcheckbox]", "[role=option]",
].join(",");

/**
 * Material-style click feedback: a soft circle grows from the point you pressed. One listener for the whole page,
 * nothing in each component. The ripple sits in its own clipped layer, so it never changes layout or blocks clicks.
 */
export function ClickRipple() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || reduce.matches) return;
      const el = (e.target as Element | null)?.closest?.<HTMLElement>(TARGETS);
      if (!el || el.closest("[data-no-ripple]") || el.matches(":disabled, [aria-disabled=true]")) return;

      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      if (getComputedStyle(el).position === "static") el.style.position = "relative";

      const layer = document.createElement("span");
      layer.className = "ripple-layer";
      layer.setAttribute("aria-hidden", "true");
      const dot = document.createElement("span");
      dot.className = "ripple";
      const size = Math.hypot(Math.max(e.clientX - rect.left, rect.right - e.clientX), Math.max(e.clientY - rect.top, rect.bottom - e.clientY)) * 2;
      dot.style.width = dot.style.height = `${size}px`;
      dot.style.left = `${e.clientX - rect.left - size / 2}px`;
      dot.style.top = `${e.clientY - rect.top - size / 2}px`;
      layer.appendChild(dot);
      el.appendChild(layer);

      // Grow while held, fade once released (or after the animation if the press was a quick tap).
      let released = false;
      let grown = false;
      const fade = () => {
        if (!released || !grown) return;
        dot.classList.add("ripple-out");
        window.setTimeout(() => layer.remove(), 300);
      };
      dot.addEventListener("animationend", () => { grown = true; fade(); }, { once: true });
      const up = () => { released = true; fade(); };
      window.addEventListener("pointerup", up, { once: true });
      window.addEventListener("pointercancel", up, { once: true });
      window.setTimeout(() => { released = grown = true; fade(); }, 1500); // never leave one behind
    };

    document.addEventListener("pointerdown", onDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);
  return null;
}
