"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False during server render and hydration, true once React owns the page. */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
