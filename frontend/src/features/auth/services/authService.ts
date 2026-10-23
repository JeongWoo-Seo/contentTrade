// Auth API client.
import { getAccessToken, setAccessToken, clearAccessToken } from '../../../utils/crypto/tokenStore';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export interface ApiRequestError extends Error {
  status: number;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
}

async function request<T = unknown>(
  path: string,
  { method = 'POST', body, token }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include', // send + receive the HttpOnly refresh cookie
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = new Error(`auth request failed: ${res.status} ${res.statusText}`) as ApiRequestError;
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

// ---- refresh: single-flight; rotation handled by the server cookie ----
let refreshPromise: Promise<string> | null = null;
let onRefreshFailed: (() => void) | null = null;

// Refresh 실패 시(만료·무효) 호출할 콜백 등록. useAuth가 인증 상태 초기화에 사용한다.
export function setOnRefreshFailed(callback: (() => void) | null): void {
  onRefreshFailed = callback;
}

export async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    // No body: the server reads the HttpOnly refresh cookie and, on rotation,
    // sets a new one via Set-Cookie.
    refreshPromise = request<{ accessToken: string }>('/api/auth/refresh', { method: 'POST' })
      .then((res) => {
        setAccessToken(res.accessToken);
        return res.accessToken;
      })
      .catch((err: unknown) => {
        // 갱신 실패: 토큰 정리 + 인증 상태 초기화(로그인 화면 이동) 콜백 호출.
        clearAccessToken();
        if (onRefreshFailed) onRefreshFailed();
        throw err;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function buildBody(body: unknown): string | undefined {
  if (body === undefined || body === null) return undefined;
  if (typeof body === 'string') return body;
  return JSON.stringify(body);
}

export interface AuthFetchOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  [key: string]: unknown;
}

export async function authFetch(
  path: string,
  { method = 'GET', body, headers = {}, ...rest }: AuthFetchOptions = {},
): Promise<Response> {
  const token = getAccessToken();
  if (!token) throw new Error('인증 토큰이 없습니다. 로그인해주세요.');

  const bodyStr = buildBody(body);
  const reqHeaders: Record<string, string> = { ...headers };
  if (bodyStr !== undefined && !('Content-Type' in reqHeaders)) {
    reqHeaders['Content-Type'] = 'application/json';
  }

  const doFetch = (t: string) =>
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

export interface AuthUser {
  id: number;
  username: string;
  addr: string;
  pkOwn: string;
  pkEnc: string;
  eoa: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshExpiresIn: number;
  user: AuthUser;
}

export interface CheckUsernameResponse {
  available: boolean;
}

export const authService = {
  async signup(payload: Record<string, unknown>): Promise<AuthUser> {
    const res = await request<AuthUser & { accessToken?: string }>('/api/auth/signup', { body: payload });
    // Optional auto-login: server may return an access token on registration.
    if (res.accessToken) setAccessToken(res.accessToken);
    return res;
  },

  async checkUsername(username: string): Promise<CheckUsernameResponse> {
    return request<CheckUsernameResponse>(
      `/api/auth/check-username?username=${encodeURIComponent(username)}`,
      { method: 'GET' },
    );
  },

  async login(payload: Record<string, unknown>): Promise<LoginResponse> {
    const res = await request<LoginResponse>('/api/auth/login', { body: payload });
    if (res.accessToken) setAccessToken(res.accessToken);
    return res;
  },

  async logout(): Promise<void> {
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
