"use client";

import { Lock } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { useCan, useSession } from "@/components/session-provider";

/** Renders children only for users who may see the page; otherwise a clear explanation. */
export function PermissionGate({
  permission, superAdmin, children,
}: { permission?: string; superAdmin?: boolean; children: React.ReactNode }) {
  const can = useCan();
  const me = useSession();
  const allowed = superAdmin ? me.role === "super_admin" : permission ? me.role !== "super_admin" && can(permission) : true;
  if (allowed) return <>{children}</>;
  return (
    <EmptyState
      icon={Lock}
      title="You don't have access to this page"
      description="Ask your school admin if you need it."
      className="rounded-xl border bg-card"
    />
  );
}
