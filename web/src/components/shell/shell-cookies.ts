// Shell preferences kept in cookies (not local storage) so the server renders the page as it will look.

/** The collapsed sidebar, so the server renders it the right width on the next visit. */
export const SIDEBAR_COOKIE = "ev_sidebar";
/** Which platform announcement was hidden, so the server leaves it out of the page. */
export const BANNER_COOKIE = "ev_banner_hidden";

export function rememberSidebar(collapsed: boolean) {
  document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
}
