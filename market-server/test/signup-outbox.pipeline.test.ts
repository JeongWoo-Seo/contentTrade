import "./helpers/env.js";
import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Wallet } from "ethers";
import { randomBytes } from "node:crypto";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { outboxRepository } from "../src/repositories/outbox.repository.js";
import { buildAccountRegistrationMessage } from "../src/services/outbox.service.js";

// 회원가입 → Outbox 파이프라인 검증.
// "회원 정보 + 계좌 확인용 Outbox 이벤트가 같은 트랜잭션으로 저장되는가",
// "실패 시 전체 롤백되는가", "Kafka 메시지에 jobId + addr이 담기는가"를 검증한다.

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

describe("회원가입 → Outbox 파이프라인", () => {
  it("회원 정보와 계좌 확인 Outbox 이벤트가 같은 트랜잭션으로 생성된다", async () => {
    const res = await request(app).post("/api/auth/signup").send(validBody());
    assert.equal(res.status, 201);
    const userId = res.body.id as number;

    // 1. 회원 생성 확인 (PENDING 상태로 저장)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    assert.ok(user);
    assert.equal(user.username, "newuser");
    assert.equal(user.status, "PENDING");
    assert.ok(user.txHash && user.txHash.startsWith("0x"));

    // 2. 계좌 확인용 Outbox 이벤트가 PENDING 상태로 생성 (Kafka 발행 대기)
    const outbox = await prisma.outbox.findFirst({
      where: { jobType: "ACCOUNT_REGISTRATION", referenceId: userId },
    });
    assert.ok(outbox, "Outbox 이벤트가 생성되어야 한다");
    assert.equal(outbox.status, "PENDING");
    assert.equal(outbox.retryCount, 0);
    assert.equal(outbox.publishedAt, null);
    assert.ok(outbox.jobId, "jobId가 설정되어야 한다 (UUID)");
    assert.equal(outbox.jobType, "ACCOUNT_REGISTRATION");
  });

  it("Outbox 생성 실패 시 회원 저장까지 롤백된다", async (t) => {
    t.mock.method(outboxRepository, "create", async () => {
      throw new Error("simulated outbox failure");
    });

    const res = await request(app).post("/api/auth/signup").send(validBody());
    assert.equal(res.status, 500);

    // transaction이 롤백되어 회원이 저장되지 않아야 한다.
    const user = await prisma.user.findUnique({ where: { username: "newuser" } });
    assert.equal(user, null);
  });

  it("Kafka 메시지에 작업 ID/addr/txHash가 정확하게 포함된다", async () => {
    const addr = randomAddr();
    const txHash = randomTxHash();
    const res = await request(app)
      .post("/api/auth/signup")
      .send(validBody({ addr, txHash }));
    assert.equal(res.status, 201);
    const userId = res.body.id as number;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    assert.ok(user);

    const outbox = await prisma.outbox.findFirst({
      where: { jobType: "ACCOUNT_REGISTRATION", referenceId: userId },
    });
    assert.ok(outbox);

    const message = await buildAccountRegistrationMessage(outbox);
    assert.equal(message.jobId, outbox.jobId);
    assert.equal(message.addr, addr);
    assert.equal(message.txHash, txHash);
    assert.equal(message.proofType, "ACCOUNT_REGISTRATION");
    assert.equal(message.requestedAt, outbox.createdAt.toISOString());
  });
});
