"use client";

import { createContext, useContext } from "react";
import type { Me } from "@/lib/api/types";

const SessionContext = createContext<Me | null>(null);

export function SessionProvider({ me, children }: { me: Me; children: React.ReactNode }) {
  return <SessionContext.Provider value={me}>{children}</SessionContext.Provider>;
}

export function useSession(): Me {
  const me = useContext(SessionContext);
  if (!me) throw new Error("useSession must be used inside the signed-in app");
  return me;
}

export function useCan() {
  const me = useSession();
  return (permission: string) => me.role === "super_admin" || me.permissions.includes(permission);
}
