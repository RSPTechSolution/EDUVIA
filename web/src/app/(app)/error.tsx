"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div role="alert" className="flex flex-col items-center justify-center rounded-xl border bg-card px-6 py-16 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive/10">
        <TriangleAlert className="size-7 text-destructive" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">This page couldn&apos;t load. Try again; if it keeps happening, contact support.</p>
      <Button className="mt-6" onClick={reset}>Try again</Button>
    </div>
  );
}
