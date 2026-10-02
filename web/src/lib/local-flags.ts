/** Small per-device flags. Storage can be unavailable (private mode), so every access is guarded. */
function flag(key: string) {
  return {
    get(): boolean {
      try {
        return localStorage.getItem(key) === "1";
      } catch {
        return false;
      }
    },
    set() {
      try {
        localStorage.setItem(key, "1");
      } catch {
        /* ignore */
      }
    },
  };
}

export const modulesReviewed = flag("eduvia.modulesReviewed");
