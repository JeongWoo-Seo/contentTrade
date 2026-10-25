import "./helpers/env.js";
import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Wallet } from "ethers";
import { randomBytes } from "node:crypto";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { userRepository } from "../src/repositories/user.repository.js";
const PASSWORD = "password123";

function randomEoa(): string {
  return Wallet.createRandom().address;
}

function randomAddr(): string {
  return randomBytes(32).toString("hex");
}

function randomTxHash(): string {
  return `0x${randomBytes(32).toString("hex")}`;
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    username: "newuser",
    password: PASSWORD,
    addr: randomAddr(),
    pkOwn: "a".repeat(64),
    pkEnc: "b".repeat(128),
    eoa: randomEoa(),
    txHash: randomTxHash(),
    ...overrides,
  };
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "outbox", "refresh_tokens", "user" RESTART IDENTITY CASCADE');
});

after(async () => {
  await prisma.$disconnect();
});

// ============================================================
// 필수 입력값 누락 검증
// SignupInput의 addr / pkOwn / pkEnc 는 서비스 계층에서 검증되지 않는다.
// ============================================================

describe("POST /api/auth/signup — missing required fields", () => {
  it("rejects missing addr", async () => {
    const res = await request(app).post("/api/auth/signup").send(validBody({ addr: undefined }));
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "VALIDATION_ERROR");
  });

  it("rejects missing pkOwn", async () => {
    const res = await request(app).post("/api/auth/signup").send(validBody({ pkOwn: undefined }));
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "VALIDATION_ERROR");
  });

  it("rejects missing pkEnc", async () => {
    const res = await request(app).post("/api/auth/signup").send(validBody({ pkEnc: undefined }));
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "VALIDATION_ERROR");
  });

  it("rejects missing txHash", async () => {
    const res = await request(app).post("/api/auth/signup").send(validBody({ txHash: undefined }));
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "VALIDATION_ERROR");
  });

  it("rejects invalid txHash", async () => {
    const res = await request(app).post("/api/auth/signup").send(validBody({ txHash: "not-a-txhash" }));
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "VALIDATION_ERROR");
  });
});

// ============================================================
// DB 오류와 중복 결과의 구분
// ============================================================

describe("GET /api/auth/check-username — DB error vs duplicate", () => {
  it("returns 500 (not available) when the DB query fails", async (t) => {
    t.mock.method(userRepository, "findByUsername", async () => {
      throw new Error("simulated DB failure");
    });

    const res = await request(app).get("/api/auth/check-username?username=freeuser");
    assert.equal(res.status, 500);
    assert.equal(res.body.error, "INTERNAL_SERVER_ERROR");
    // DB 오류가 "사용 가능"으로 오인되지 않아야 한다.
    assert.equal(res.body.available, undefined);
  });
});

describe("POST /api/auth/signup — DB error handling", () => {
  it("returns 500 (not 409/201) when the username lookup fails", async (t) => {
    t.mock.method(userRepository, "findByUsername", async () => {
      throw new Error("simulated DB failure");
    });

    const res = await request(app).post("/api/auth/signup").send(validBody());
    assert.equal(res.status, 500);
    assert.equal(res.body.error, "INTERNAL_SERVER_ERROR");
  });
});
