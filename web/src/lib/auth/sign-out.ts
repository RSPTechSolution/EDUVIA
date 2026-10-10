/** Ends the session on the server, then goes to the sign-in page. */
export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  window.location.assign("/login");
}
