import type { Response } from "express";

export const REFRESH_COOKIE_NAME = "refresh_token";

// Refresh token cookie: HttpOnly + Secure + SameSite=Strict, scoped to /auth.
// `secure` defaults to true (production); set COOKIE_SECURE=false for local http dev.
function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== "false",
    sameSite: "strict" as const,
    path: "/auth",
    maxAge: maxAgeSeconds * 1000,
  };
}

export function setRefreshCookie(res: Response, token: string, maxAgeSeconds: number): void {
  res.cookie(REFRESH_COOKIE_NAME, token, cookieOptions(maxAgeSeconds));
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: "/auth" });
}
