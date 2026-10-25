import "./helpers/env.js";
import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Wallet } from "ethers";
import { randomBytes } from "node:crypto";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { handleAccountResult } from "../src/kafka/consumer.js";

// 가입 확인 결과 Consumer 검증.
// jobId → outbox.referenceId(user.id) 매핑과 ACTIVE/REJECTED 전이,
// 중복 메시지 멱등성을 검증한다.

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
  await prisma.$executeRawUnsafe(
    'TRUNCATE "outbox", "refresh_tokens", "user" RESTART IDENTITY CASCADE',
  );
});

after(async () => {
  await prisma.$disconnect();
});

async function signupAndGetJobId(): Promise<{ userId: number; jobId: string }> {
  const res = await request(app).post("/api/auth/signup").send(validBody());
  assert.equal(res.status, 201);
  const userId = res.body.id as number;

  const outbox = await prisma.outbox.findFirst({
    where: { jobType: "ACCOUNT_REGISTRATION", referenceId: userId },
  });
  assert.ok(outbox, "가입 확인용 Outbox가 생성되어야 한다");

  return { userId, jobId: outbox.jobId };
}

describe("가입 확인 결과 처리", () => {
  it("ACTIVE 결과가 회원 상태를 ACTIVE로 전이한다", async () => {
    const { userId, jobId } = await signupAndGetJobId();

    await handleAccountResult({ jobId, result: "ACTIVE" });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    assert.equal(user!.status, "ACTIVE");
  });

  it("REJECTED 결과가 회원 상태를 REJECTED로 전이한다", async () => {
    const { userId, jobId } = await signupAndGetJobId();

    await handleAccountResult({ jobId, result: "REJECTED", reason: "transaction reverted" });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    assert.equal(user!.status, "REJECTED");
  });

  it("중복 메시지에도 멱등하다 (이미 전이된 상태는 변경하지 않음)", async () => {
    const { userId, jobId } = await signupAndGetJobId();

    await handleAccountResult({ jobId, result: "ACTIVE" });
    // 중복 ACTIVE + 이후 도착한 REJECTED 모두 no-op (이미 ACTIVE)
    await handleAccountResult({ jobId, result: "ACTIVE" });
    await handleAccountResult({ jobId, result: "REJECTED", reason: "late failure" });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    assert.equal(user!.status, "ACTIVE");
  });

  it("알 수 없는 jobId는 안전하게 무시한다", async () => {
    await handleAccountResult({ jobId: "unknown-job-id", result: "ACTIVE" });
    // 예외 없이 반환되어야 한다 (consumer가 offset을 commit).
  });
});
