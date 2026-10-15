"use client";

import { useEffect } from "react";

/**
 * Smooth, eased wheel scrolling for the public website (Lenis). Loaded after the page is idle so it never delays the
 * first paint, skipped for people who ask for less motion, and left to the browser on touch screens, where scrolling is
 * already smooth. Pauses while a dialog or menu has locked the page, and never takes over scrolling inside dialogs.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let destroyed = false;
    let cleanup = () => {};

    const start = async () => {
      const { default: Lenis } = await import("lenis");
      if (destroyed) return;
      const lenis = new Lenis({
        autoRaf: true,
        lerp: 0.1,
        anchors: { offset: -80 },
        allowNestedScroll: true,
        prevent: (node) => Boolean(node.closest?.("[role=dialog], [role=menu], [role=listbox], [data-lenis-prevent]")),
      });
      // Dialogs and menus lock the page by setting overflow: hidden inline; pause while they do.
      const locked = () => [document.documentElement, document.body].some((el) => el.style.overflow === "hidden");
      const sync = () => (locked() ? lenis.stop() : lenis.start());
      const mo = new MutationObserver(sync);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
      mo.observe(document.body, { attributes: true, attributeFilter: ["style"] });
      cleanup = () => {
        mo.disconnect();
        lenis.destroy();
      };
    };

    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
    const handle = idle(() => void start());
    return () => {
      destroyed = true;
      (window.cancelIdleCallback ?? window.clearTimeout)(handle as number);
      cleanup();
    };
  }, []);
  return null;
}
