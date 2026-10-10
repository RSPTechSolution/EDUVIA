import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import type { Platform } from "@/components/shell/platform-banner";
import { BANNER_COOKIE, SIDEBAR_COOKIE } from "@/components/shell/shell-cookies";
import { getSession, serverApi } from "@/lib/api/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Everything that decides the shell's layout is known on the server, so the first paint is already the final one:
  // no sidebar snapping shut, banner pushing the page down, or colour changing once JavaScript runs.
  const [me, platform, jar] = await Promise.all([
    getSession(),
    serverApi<Platform>("/public/platform").then((r) => (r.success ? r.data : null)).catch(() => null),
    cookies(),
  ]);
  // Cookie present but the server-side session is gone (revoked, expired): clear and sign in again.
  if (!me) redirect("/api/auth/logout");
  return (
    <AppShell me={me} collapsed={jar.get(SIDEBAR_COOKIE)?.value === "1"} platform={platform} bannerHidden={jar.get(BANNER_COOKIE)?.value ?? null}>
      {children}
    </AppShell>
  );
}
