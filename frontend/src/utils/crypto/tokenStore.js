// Access token (JWT) holder — memory only.
//
// The refresh token lives in an HttpOnly + Secure cookie set by the server.
// The browser attaches it automatically to requests via `credentials: 'include'`,
// so it is never visible to (or readable by) JavaScript.
let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function clearAccessToken() {
  accessToken = null;
}
