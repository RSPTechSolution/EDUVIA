import { WifiOff } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "You're offline" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <WifiOff className="size-12 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-bold">You&apos;re offline</h1>
      <p className="max-w-sm text-muted-foreground">Vidyanexa needs an internet connection. Check your Wi-Fi or mobile data, then try again.</p>
      <a href="/dashboard" className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground">Try again</a>
    </main>
  );
}
