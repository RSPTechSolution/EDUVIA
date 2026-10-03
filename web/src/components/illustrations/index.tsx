/**
 * Hand-drawn SVG illustrations in the brand palette. They animate with CSS
 * (`illo-*` classes in globals.css), which reduced-motion settings switch off.
 * Decorative only: always aria-hidden.
 */
import { cn } from "@/lib/utils";

const BLUE = "var(--primary)";
const TEAL = "var(--brand-teal)";
const GREEN = "var(--brand-green)";
const SUN = "var(--brand-sun)";
const NAVY = "var(--brand-navy)";

function Frame({ className, children, viewBox = "0 0 240 180" }: { className?: string; children: React.ReactNode; viewBox?: string }) {
  return (
    <svg viewBox={viewBox} className={cn("h-auto w-full", className)} aria-hidden fill="none">
      {children}
    </svg>
  );
}

/** Students: a graduation cap over an open book, with floating pencils and stars. */
export function StudentsIllustration({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <ellipse cx="120" cy="160" rx="78" ry="8" className="fill-foreground/[0.06]" />
      <circle cx="120" cy="84" r="62" className="fill-primary/[0.07]" />
      <g className="illo-float">
        <path d="M58 122c20-10 42-10 62 2 20-12 42-12 62-2v-50c-20-10-42-10-62 2-20-12-42-12-62-2z" fill="white" className="dark:fill-[oklch(0.3_0.03_264)]" stroke={NAVY} strokeWidth="3" strokeLinejoin="round" />
        <path d="M120 74v50" stroke={NAVY} strokeWidth="3" />
        <path d="M70 84c12-4 26-4 38 1M70 96c12-4 26-4 38 1M132 85c12-5 26-5 38-1M132 97c12-5 26-5 38-1" stroke={TEAL} strokeWidth="3" strokeLinecap="round" />
      </g>
      <g className="illo-bob">
        <path d="M120 22l46 18-46 18-46-18z" fill={NAVY} />
        <path d="M94 50v14c0 6 12 11 26 11s26-5 26-11V50" fill={NAVY} opacity="0.85" />
        <path d="M166 40v24" stroke={SUN} strokeWidth="3" strokeLinecap="round" />
        <circle cx="166" cy="67" r="4" fill={SUN} />
      </g>
      <g className="illo-twinkle"><path d="M38 52l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill={SUN} /></g>
      <g className="illo-twinkle [animation-delay:1.2s]"><path d="M200 108l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill={GREEN} /></g>
      <g className="illo-drift"><rect x="186" y="44" width="30" height="7" rx="3.5" transform="rotate(-30 186 44)" fill={BLUE} /><path d="M213 31l7-3-3 7z" fill={SUN} /></g>
    </Frame>
  );
}

/** Classes: a small school building with a flag and window lights. */
export function ClassesIllustration({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <ellipse cx="120" cy="160" rx="84" ry="8" className="fill-foreground/[0.06]" />
      <circle cx="120" cy="88" r="64" className="fill-[color-mix(in_oklch,var(--brand-teal)_12%,transparent)]" />
      <g className="illo-float">
        <path d="M52 154V88l68-38 68 38v66z" fill="white" className="dark:fill-[oklch(0.3_0.03_264)]" stroke={NAVY} strokeWidth="3" strokeLinejoin="round" />
        <path d="M44 92l76-44 76 44" stroke={BLUE} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="106" y="118" width="28" height="36" rx="3" fill={NAVY} />
        {[[66, 100], [150, 100], [66, 126], [150, 126]].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="24" height="18" rx="3" fill={SUN} className="illo-window" style={{ animationDelay: `${i * 0.5}s` }} />
        ))}
        <circle cx="120" cy="88" r="10" fill="white" stroke={NAVY} strokeWidth="3" />
        <path d="M120 82v6l4 3" stroke={NAVY} strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <path d="M120 50V20" stroke={NAVY} strokeWidth="3" strokeLinecap="round" />
      <path d="M120 21h26l-6 7 6 7h-26z" fill={GREEN} className="illo-flag" />
      <g className="illo-twinkle"><circle cx="40" cy="60" r="4" fill={TEAL} /></g>
      <g className="illo-twinkle [animation-delay:0.8s]"><circle cx="204" cy="56" r="3" fill={SUN} /></g>
    </Frame>
  );
}

/** Parents: two figures and a heart, for empty guardian lists. */
export function FamilyIllustration({ className }: { className?: string }) {
  return (
    <Frame className={className} viewBox="0 0 200 140">
      <ellipse cx="100" cy="128" rx="64" ry="6" className="fill-foreground/[0.06]" />
      <g className="illo-float">
        <circle cx="76" cy="48" r="16" fill={BLUE} />
        <path d="M50 120c0-24 12-40 26-40s26 16 26 40z" fill={BLUE} />
        <circle cx="124" cy="56" r="13" fill={TEAL} />
        <path d="M102 120c0-20 10-34 22-34s22 14 22 34z" fill={TEAL} />
      </g>
      <path d="M100 30c-4-8-16-6-16 3 0 7 16 15 16 15s16-8 16-15c0-9-12-11-16-3z" fill={SUN} className="illo-pulse" />
    </Frame>
  );
}

/** Marketing hero graphic: the EDUVIA mark orbited by module icons. */
export function OrbitGraphic({ className, icons }: { className?: string; icons: React.ReactNode[] }) {
  const n = icons.length;
  return (
    <div className={cn("relative aspect-square w-full", className)} aria-hidden>
      <div className="absolute inset-[8%] rounded-full border border-dashed border-primary/25" />
      <div className="absolute inset-[24%] rounded-full border border-primary/15" />
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--primary)_16%,transparent),transparent)]" />
      <div className="illo-spin absolute inset-[8%]">
        {icons.map((icon, i) => {
          const a = (i / n) * Math.PI * 2;
          return (
            <div
              key={i}
              className="absolute"
              style={{ left: `${50 + 50 * Math.cos(a)}%`, top: `${50 + 50 * Math.sin(a)}%`, transform: "translate(-50%, -50%)" }}
            >
              <div className="illo-counter-spin flex size-12 items-center justify-center rounded-2xl border bg-card text-primary shadow-lg">
                {icon}
              </div>
            </div>
          );
        })}
      </div>
      <div className="absolute inset-[34%] flex items-center justify-center">
        <div className="illo-pulse-soft flex size-full items-center justify-center rounded-[28%] bg-white shadow-2xl ring-1 ring-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/icon-192.png" alt="" className="size-[78%]" />
        </div>
      </div>
    </div>
  );
}
