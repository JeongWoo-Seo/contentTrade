import "./helpers/env.js";
import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { Wallet } from "ethers";
import { randomBytes } from "node:crypto";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const SECRET = process.env.JWT_SECRET!;
const ISSUER = process.env.JWT_ISSUER!;
const AUDIENCE = process.env.JWT_AUDIENCE!;

const PASSWORD = "password123";
const USERNAME = "tester";

// ---- helpers ----

function decode(token: string): jwt.JwtPayload {
  const payload = jwt.decode(token);
  assert.ok(payload && typeof payload !== "string", "expected a JWT object");
  return payload;
}

function signCustom(type: string, overrides: jwt.SignOptions = {}): string {
  return jwt.sign({ type }, SECRET, {
    subject: "1",
    issuer: ISSUER,
    audience: AUDIENCE,
    jwtid: "test-jti",
    ...overrides,
  });
}

// Extract the refresh token from a Set-Cookie header (HttpOnly cookie).
function refreshTokenFrom(res: request.Response): string | undefined {
  const cookies = res.headers["set-cookie"] ?? [];
  const cookie = cookies.find((c) => c.startsWith("refresh_token="));
  return cookie ? cookie.split(";")[0].split("=")[1] : undefined;
}

function randomEoa(): string {
  return Wallet.createRandom().address;
}

function randomAddr(): string {
  return randomBytes(32).toString("hex");
}

function signup(username = USERNAME, password = PASSWORD, overrides: Record<string, unknown> = {}) {
  return request(app).post("/auth/signup").send({
    username,
    password,
    addr: randomAddr(),
    pkOwn: "a".repeat(64),
    pkEnc: "b".repeat(128),
    eoa: randomEoa(),
    ...overrides,
  });
}

function login(username = USERNAME, password = PASSWORD) {
  return request(app).post("/auth/login").send({ username, password });
}

// ---- lifecycle ----

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "refresh_tokens", "user" RESTART IDENTITY CASCADE');
});

after(async () => {
  await prisma.$disconnect();
});

// ============================================================
// Signup
// ============================================================

describe("POST /auth/signup", () => {
  it("creates a user and returns only basic info", async () => {
    const res = await signup();
    assert.equal(res.status, 201);
    assert.equal(res.body.username, USERNAME);
    assert.ok(typeof res.body.id === "number");
    assert.ok(res.body.eoa && res.body.eoa.startsWith("0x"));
    assert.equal(res.body.passwordHash, undefined);
    assert.equal(res.body.password_hash, undefined);
    assert.equal(res.body.password, undefined);
    assert.equal(res.body.privateKey, undefined);
  });

  it("rejects a duplicate username", async () => {
    await signup();
    const res = await signup();
    assert.equal(res.status, 409);
    assert.equal(res.body.error, "USERNAME_ALREADY_EXISTS");
  });

  it("rejects an invalid username", async () => {
    const res = await signup("ab", PASSWORD);
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "VALIDATION_ERROR");
  });

  it("rejects a too-short password", async () => {
    const res = await signup(USERNAME, "short");
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "VALIDATION_ERROR");
  });

  it("stores the password as an Argon2id hash (not plaintext)", async () => {
    await signup();
    const user = await prisma.user.findUnique({ where: { username: USERNAME } });
    assert.ok(user);
    assert.notEqual(user.passwordHash, PASSWORD);
    assert.ok(user.passwordHash.startsWith("$argon2id$"));
  });

  it("rejects an invalid eoa", async () => {
    const res = await signup(USERNAME, PASSWORD, { eoa: "invalid" });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "VALIDATION_ERROR");
  });

  it("rejects a duplicate addr", async () => {
    const addr = randomAddr();
    await signup("user1", PASSWORD, { addr });
    const res = await signup("user2", PASSWORD, { addr });
    assert.equal(res.status, 409);
    assert.equal(res.body.error, "WALLET_ALREADY_EXISTS");
  });

  it("stores and returns pk_own / pk_enc / eoa", async () => {
    const eoa = randomEoa();
    const addr = randomAddr();
    const pkOwn = "a".repeat(64);
    const pkEnc = "b".repeat(128);
    const res = await request(app)
      .post("/auth/signup")
      .send({ username: USERNAME, password: PASSWORD, addr, pkOwn, pkEnc, eoa });
    assert.equal(res.status, 201);
    assert.equal(res.body.pkOwn, pkOwn);
    assert.equal(res.body.pkEnc, pkEnc);
    assert.equal(res.body.eoa, eoa);

    const user = await prisma.user.findUnique({ where: { username: USERNAME } });
    assert.equal(user!.pkOwn, pkOwn);
    assert.equal(user!.pkEnc, pkEnc);
    assert.equal(user!.eoa, eoa);
  });
});

// ============================================================
// Login
// ============================================================

describe("POST /auth/login", () => {
  beforeEach(async () => {
    await signup();
  });

  it("issues access token + refresh cookie", async () => {
    const res = await login();
    assert.equal(res.status, 200);
    assert.ok(res.body.accessToken);
    assert.equal(res.body.tokenType, "Bearer");
    assert.equal(res.body.expiresIn, 900);
    assert.equal(res.body.refreshExpiresIn, 604800);
    assert.equal(res.body.user.username, USERNAME);
    assert.ok(res.body.user.eoa && res.body.user.eoa.startsWith("0x"));

    const refresh = refreshTokenFrom(res);
    assert.ok(refresh, "refresh token cookie must be set");
  });

  it("returns 401 for unknown username and wrong password (indistinguishable)", async () => {
    const unknown = await login("nobody", PASSWORD);
    const wrong = await login(USERNAME, "wrong-password");
    assert.equal(unknown.status, 401);
    assert.equal(wrong.status, 401);
    assert.deepEqual(unknown.body, { error: "UNAUTHORIZED" });
    assert.deepEqual(wrong.body, { error: "UNAUTHORIZED" });
  });

  it("issues access and refresh tokens with different jti", async () => {
    const res = await login();
    const accessPayload = decode(res.body.accessToken);
    const refreshPayload = decode(refreshTokenFrom(res)!);
    assert.notEqual(accessPayload.jti, refreshPayload.jti);
    assert.equal(accessPayload.type, "access");
    assert.equal(refreshPayload.type, "refresh");
  });
});

// ============================================================
// Access token middleware (via /auth/me)
// ============================================================

describe("GET /auth/me (access token middleware)", () => {
  beforeEach(async () => {
    await signup();
  });

  it("returns the user for a valid token", async () => {
    const loginRes = await login();
    const res = await request(app).get("/auth/me").set("Authorization", `Bearer ${loginRes.body.accessToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.username, USERNAME);
    assert.ok(res.body.eoa && res.body.eoa.startsWith("0x"));
  });

  it("rejects missing token", async () => {
    const res = await request(app).get("/auth/me");
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: "UNAUTHORIZED" });
  });

  it("rejects malformed token", async () => {
    const res = await request(app).get("/auth/me").set("Authorization", "Bearer");
    assert.equal(res.status, 401);
  });

  it("rejects invalid token", async () => {
    const res = await request(app).get("/auth/me").set("Authorization", "Bearer not-a-jwt");
    assert.equal(res.status, 401);
  });

  it("rejects expired token", async () => {
    const expired = signCustom("access", { expiresIn: "-1s" });
    const res = await request(app).get("/auth/me").set("Authorization", `Bearer ${expired}`);
    assert.equal(res.status, 401);
  });

  it("rejects tampered (wrong signature) token", async () => {
    const loginRes = await login();
    const token = loginRes.body.accessToken.slice(0, -2) + "xx";
    const res = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 401);
  });

  it("rejects wrong issuer", async () => {
    const token = signCustom("access", { issuer: "wrong-issuer" });
    const res = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 401);
  });

  it("rejects wrong audience", async () => {
    const token = signCustom("access", { audience: "wrong-audience" });
    const res = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 401);
  });

  it("rejects a refresh token used as an access token", async () => {
    const loginRes = await login();
    const refresh = refreshTokenFrom(loginRes)!;
    const res = await request(app).get("/auth/me").set("Authorization", `Bearer ${refresh}`);
    assert.equal(res.status, 401);
  });

  it("returns 404 for a valid token whose user no longer exists", async () => {
    const loginRes = await login();
    await prisma.user.delete({ where: { username: USERNAME } });
    const res = await request(app).get("/auth/me").set("Authorization", `Bearer ${loginRes.body.accessToken}`);
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: "NOT_FOUND" });
  });
});

// ============================================================
// Refresh
// ============================================================

describe("POST /auth/refresh", () => {
  beforeEach(async () => {
    await signup();
  });

  it("rotates: returns new tokens and revokes the old one", async () => {
    const loginRes = await login();
    const oldRefresh = refreshTokenFrom(loginRes)!;

    const res = await request(app).post("/auth/refresh").set("Cookie", `refresh_token=${oldRefresh}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.accessToken);
    const newRefresh = refreshTokenFrom(res);
    assert.ok(newRefresh);
    assert.notEqual(newRefresh, oldRefresh);

    const reuse = await request(app).post("/auth/refresh").set("Cookie", `refresh_token=${oldRefresh}`);
    assert.equal(reuse.status, 401);
  });

  it("rejects a missing refresh token", async () => {
    const res = await request(app).post("/auth/refresh");
    assert.equal(res.status, 401);
  });

  it("rejects an invalid refresh token", async () => {
    const res = await request(app).post("/auth/refresh").send({ refreshToken: "not-a-jwt" });
    assert.equal(res.status, 401);
  });

  it("rejects an expired refresh token", async () => {
    const expired = signCustom("refresh", { expiresIn: "-1s" });
    const res = await request(app).post("/auth/refresh").send({ refreshToken: expired });
    assert.equal(res.status, 401);
  });

  it("rejects wrong signature", async () => {
    const loginRes = await login();
    const refresh = refreshTokenFrom(loginRes)!;
    const tampered = refresh.slice(0, -2) + "xx";
    const res = await request(app).post("/auth/refresh").send({ refreshToken: tampered });
    assert.equal(res.status, 401);
  });

  it("rejects wrong issuer", async () => {
    const token = signCustom("refresh", { issuer: "wrong-issuer" });
    const res = await request(app).post("/auth/refresh").send({ refreshToken: token });
    assert.equal(res.status, 401);
  });

  it("rejects wrong audience", async () => {
    const token = signCustom("refresh", { audience: "wrong-audience" });
    const res = await request(app).post("/auth/refresh").send({ refreshToken: token });
    assert.equal(res.status, 401);
  });

  it("rejects an access token used as a refresh token", async () => {
    const loginRes = await login();
    const res = await request(app).post("/auth/refresh").send({ refreshToken: loginRes.body.accessToken });
    assert.equal(res.status, 401);
  });

  it("rejects a token whose jti is not stored in the DB", async () => {
    const token = signCustom("refresh", { subject: "1" });
    const res = await request(app).post("/auth/refresh").send({ refreshToken: token });
    assert.equal(res.status, 401);
  });

  it("deleting the user invalidates their refresh tokens (cascade)", async () => {
    const loginRes = await login();
    const refresh = refreshTokenFrom(loginRes)!;
    await prisma.user.delete({ where: { username: USERNAME } });
    const res = await request(app).post("/auth/refresh").send({ refreshToken: refresh });
    assert.equal(res.status, 401);
  });
});

// ============================================================
// Rotation + reuse detection
// ============================================================

describe("refresh token rotation & reuse detection", () => {
  beforeEach(async () => {
    await signup();
  });

  it("rotates A -> B -> C (each refresh issues a fresh token)", async () => {
    const loginRes = await login();
    const A = refreshTokenFrom(loginRes)!;

    const r1 = await request(app).post("/auth/refresh").set("Cookie", `refresh_token=${A}`);
    assert.equal(r1.status, 200);
    const B = refreshTokenFrom(r1)!;
    assert.notEqual(B, A);

    const r2 = await request(app).post("/auth/refresh").set("Cookie", `refresh_token=${B}`);
    assert.equal(r2.status, 200);
    const C = refreshTokenFrom(r2)!;
    assert.notEqual(C, B);

    // Replaying A now is reuse -> the whole family (A, B, C) is revoked.
    const replayA = await request(app).post("/auth/refresh").set("Cookie", `refresh_token=${A}`);
    assert.equal(replayA.status, 401);
  });

  it("reuse detection revokes the whole family", async () => {
    const loginRes = await login();
    const userId = loginRes.body.user.id;
    const A = refreshTokenFrom(loginRes)!;

    const rot = await request(app).post("/auth/refresh").set("Cookie", `refresh_token=${A}`);
    const B = refreshTokenFrom(rot)!;

    // replay A (revoked) -> reuse detection -> family revoked
    const replay = await request(app).post("/auth/refresh").set("Cookie", `refresh_token=${A}`);
    assert.equal(replay.status, 401);

    // B (same family) must also be revoked now
    const useB = await request(app).post("/auth/refresh").set("Cookie", `refresh_token=${B}`);
    assert.equal(useB.status, 401);

    // family is fully revoked in DB
    const stored = await prisma.refreshToken.findMany({ where: { userId } });
    assert.ok(stored.length > 0);
    assert.ok(stored.every((t) => t.revokedAt !== null));
  });

  it("rotation preserves the family_id and sets replaced_by", async () => {
    const loginRes = await login();
    const A = refreshTokenFrom(loginRes)!;
    const aPayload = decode(A);

    const rot = await request(app).post("/auth/refresh").set("Cookie", `refresh_token=${A}`);
    const B = refreshTokenFrom(rot)!;
    const bPayload = decode(B);

    const aRow = await prisma.refreshToken.findUnique({ where: { jti: aPayload.jti! } });
    const bRow = await prisma.refreshToken.findUnique({ where: { jti: bPayload.jti! } });
    assert.equal(aRow!.familyId, bRow!.familyId);
    assert.equal(aRow!.replacedBy, bRow!.jti);
  });
});

// ============================================================
// Logout
// ============================================================

describe("POST /auth/logout", () => {
  beforeEach(async () => {
    await signup();
  });

  it("logs out and revokes the refresh token", async () => {
    const loginRes = await login();
    const access = loginRes.body.accessToken;
    const refresh = refreshTokenFrom(loginRes)!;

    const logoutRes = await request(app)
      .post("/auth/logout")
      .set("Authorization", `Bearer ${access}`)
      .set("Cookie", `refresh_token=${refresh}`);
    assert.equal(logoutRes.status, 200);
    assert.deepEqual(logoutRes.body, { message: "Logged out successfully" });

    const refreshRes = await request(app).post("/auth/refresh").set("Cookie", `refresh_token=${refresh}`);
    assert.equal(refreshRes.status, 401);
  });

  it("rejects logout with a missing access token", async () => {
    const res = await request(app).post("/auth/logout");
    assert.equal(res.status, 401);
  });

  it("rejects logout with an invalid access token", async () => {
    const res = await request(app).post("/auth/logout").set("Authorization", "Bearer bad-token");
    assert.equal(res.status, 401);
  });
});
