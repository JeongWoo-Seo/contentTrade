import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { parseDurationSeconds } from "./duration.js";
import { ApiError } from "./errors.js";

export interface TokenConfig {
  secret: string;
  issuer: string;
  audience: string;
  accessTtl: string;
  refreshTtl: string;
}

export function getTokenConfig(): TokenConfig {
  return {
    secret: process.env.JWT_SECRET ?? "",
    issuer: process.env.JWT_ISSUER ?? "market-server",
    audience: process.env.JWT_AUDIENCE ?? "market-client",
    accessTtl: process.env.JWT_ACCESS_TOKEN_TTL ?? "15m",
    refreshTtl: process.env.JWT_REFRESH_TOKEN_TTL ?? "168h",
  };
}

export interface IssuedToken {
  token: string;
  jti: string;
  expiresIn: number; // seconds
  expiresAt: Date;
}

// A `type` claim distinguishes access vs refresh tokens, preventing an
// attacker from submitting a refresh token as an access token (or vice versa).
function sign(userId: number, type: "access" | "refresh", ttl: string): IssuedToken {
  const cfg = getTokenConfig();
  const jti = randomUUID();
  const options: jwt.SignOptions = {
    subject: String(userId),
    issuer: cfg.issuer,
    audience: cfg.audience,
    jwtid: jti,
    expiresIn: ttl as jwt.SignOptions["expiresIn"],
  };
  const token = jwt.sign({ type }, cfg.secret, options);
  const expiresIn = parseDurationSeconds(ttl);
  return { token, jti, expiresIn, expiresAt: new Date(Date.now() + expiresIn * 1000) };
}

export function signAccessToken(userId: number): IssuedToken {
  const cfg = getTokenConfig();
  return sign(userId, "access", cfg.accessTtl);
}

export function signRefreshToken(userId: number): IssuedToken {
  const cfg = getTokenConfig();
  return sign(userId, "refresh", cfg.refreshTtl);
}

export interface DecodedToken {
  sub: string; // user id as string
  jti: string;
  type: string;
}

// Verify signature + issuer + audience + expiration + token type.
// Any failure maps to a generic 401 (no internal detail leaks).
function verify(token: string, expectedType: "access" | "refresh"): DecodedToken {
  const cfg = getTokenConfig();
  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, cfg.secret, { issuer: cfg.issuer, audience: cfg.audience });
  } catch {
    throw new ApiError(401, "UNAUTHORIZED");
  }
  if (typeof payload === "string" || !payload.sub || !payload.jti) {
    throw new ApiError(401, "UNAUTHORIZED");
  }
  if (payload.type !== expectedType) {
    throw new ApiError(401, "UNAUTHORIZED");
  }
  return { sub: payload.sub, jti: payload.jti, type: String(payload.type) };
}

export function verifyAccessToken(token: string): DecodedToken {
  return verify(token, "access");
}

export function verifyRefreshToken(token: string): DecodedToken {
  return verify(token, "refresh");
}
