/**
 * A short burst of confetti for big moments (a fee received, results published, setup finished). Drawn on a throwaway
 * canvas above the page that ignores the pointer and removes itself, in the theme's own colours. Nothing happens for
 * people who ask their system for less motion.
 */
export function celebrate({ x = 0.5, y = 0.35, count = 90 }: { x?: number; y?: number; count?: number } = {}) {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: "100" });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.remove();
  ctx.scale(dpr, dpr);

  const css = getComputedStyle(document.documentElement);
  const colours = ["--primary", "--chart-2", "--chart-3", "--success", "--chart-4"].map((v) => css.getPropertyValue(v).trim() || "#2f4a86");
  const ox = window.innerWidth * x;
  const oy = window.innerHeight * y;
  const bits = Array.from({ length: count }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
    const speed = 6 + Math.random() * 7;
    return {
      x: ox, y: oy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      w: 5 + Math.random() * 5, h: 8 + Math.random() * 6, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      colour: colours[Math.floor(Math.random() * colours.length)],
    };
  });

  const start = performance.now();
  const frame = (now: number) => {
    const t = now - start;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 1100) / 600);
    for (const b of bits) {
      b.vy += 0.25; // gravity
      b.vx *= 0.985;
      b.vy *= 0.985;
      b.x += b.vx;
      b.y += b.vy;
      b.r += b.vr;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.r);
      ctx.fillStyle = b.colour;
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.abs(Math.cos(b.r * 2)));
      ctx.restore();
    }
    if (t < 1700) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
