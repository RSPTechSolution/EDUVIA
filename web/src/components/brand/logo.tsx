import Image from "next/image";
import { cn } from "@/lib/utils";

/** App icon tile: the leaf mark on white, readable on any background. */
export function BrandMark({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[22%] bg-white shadow-sm", className)}
      style={{ width: size, height: size }}
    >
      <Image src="/brand/icon-192.png" alt="" width={size} height={size} priority />
    </span>
  );
}

/** Wordmark set in type so it stays crisp and adapts to dark backgrounds. */
export function Wordmark({ className, tagline = false }: { className?: string; tagline?: boolean }) {
  return (
    <span className={cn("flex flex-col leading-none", className)}>
      <span className="font-heading text-lg font-extrabold tracking-tight">
        EDU<span className="brand-gradient-text">VIA</span>
      </span>
      {tagline && <span className="mt-1 text-[11px] font-medium tracking-wide opacity-70">Intelligent Education Management</span>}
    </span>
  );
}

/** Full-colour logo image, for light surfaces only. */
export function FullLogo({ className }: { className?: string }) {
  return <Image src="/brand/logo.png" alt="EDUVIA" width={1463} height={396} className={cn("h-auto w-48", className)} priority />;
}
