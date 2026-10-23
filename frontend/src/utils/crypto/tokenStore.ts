// Access token (JWT) holder — memory only.
//
// The refresh token lives in an HttpOnly + Secure cookie set by the server.
// The browser attaches it automatically to requests via `credentials: 'include'`,
// so it is never visible to (or readable by) JavaScript.
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function clearAccessToken(): void {
  accessToken = null;
}
