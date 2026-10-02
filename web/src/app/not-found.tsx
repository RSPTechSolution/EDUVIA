import { Compass } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-muted">
        <Compass className="size-7 text-muted-foreground" aria-hidden />
      </div>
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <Link href="/dashboard" className={buttonVariants({ className: "mt-6" })}>Back to dashboard</Link>
    </main>
  );
}
