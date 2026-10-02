import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getSession } from "@/lib/api/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getSession();
  // Cookie present but the server-side session is gone (revoked, expired): clear and sign in again.
  if (!me) redirect("/api/auth/logout");
  return <AppShell me={me}>{children}</AppShell>;
}
