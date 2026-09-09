// Auth API client.
import { getAccessToken, setAccessToken, clearAccessToken } from '../crypto/tokenStore.js';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

async function request(path, { method = 'POST', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include', // send + receive the HttpOnly refresh cookie
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = new Error(`auth request failed: ${res.status} ${res.statusText}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// ---- refresh: single-flight; rotation handled by the server cookie ----
let refreshPromise = null;

export async function refreshAccessToken() {
  if (!refreshPromise) {
    // No body: the server reads the HttpOnly refresh cookie and, on rotation,
    // sets a new one via Set-Cookie.
    refreshPromise = request('/api/auth/refresh', { method: 'POST' })
      .then((res) => {
        setAccessToken(res.accessToken);
        return res.accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function buildBody(body) {
  if (body === undefined || body === null) return undefined;
  if (typeof body === 'string') return body;
  return JSON.stringify(body);
}

export async function authFetch(path, { method = 'GET', body, headers = {}, ...rest } = {}) {
  const token = getAccessToken();
  if (!token) throw new Error('인증 토큰이 없습니다. 로그인해주세요.');

  const bodyStr = buildBody(body);
  const reqHeaders = { ...headers };
  if (bodyStr !== undefined && !('Content-Type' in reqHeaders)) {
    reqHeaders['Content-Type'] = 'application/json';
  }

  const doFetch = (t) =>
    fetch(`${BASE_URL}${path}`, {
      method,
      ...rest,
      headers: { ...reqHeaders, Authorization: `Bearer ${t}` },
      credentials: 'include',
      body: bodyStr,
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const newToken = await refreshAccessToken(); // throws on refresh failure
    res = await doFetch(newToken);
  }
  return res;
}

export const authService = {
  async signup(payload) {
    const res = await request('/api/auth/signup', { body: payload });
    // Optional auto-login: server may return an access token on registration.
    if (res.accessToken) setAccessToken(res.accessToken);
    return res;
  },

  async login(payload) {
    const res = await request('/api/auth/login', { body: payload });
    if (res.accessToken) setAccessToken(res.accessToken);
    return res;
  },

  async logout() {
    try {
      await request('/auth/logout', { method: 'POST', token: getAccessToken() });
    } finally {
      clearAccessToken();
    }
  },

  refresh: refreshAccessToken,
  authFetch,
  getAccessToken,
};
