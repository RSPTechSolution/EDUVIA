import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, clearAuthCookies } from "@/lib/auth/cookies";
import { API_URL } from "@/lib/auth/refresh";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  if (token) {
    // Revoke the server-side session; ignore failures (cookie is cleared regardless).
    await fetch(`${API_URL}/api/v1/auth/logout`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
    }).catch(() => undefined);
  }
  const res = NextResponse.json({ success: true, data: { message: "Logged out" } });
  clearAuthCookies(res);
  return res;
}

/** Used by server components when the session is no longer valid: clear cookies, go to login. */
export async function GET(req: NextRequest) {
  const next = req.nextUrl.searchParams.get("next");
  const target = new URL("/login", req.url);
  if (next && next.startsWith("/") && !next.startsWith("//")) target.searchParams.set("next", next);
  const res = NextResponse.redirect(target);
  clearAuthCookies(res);
  return res;
}
