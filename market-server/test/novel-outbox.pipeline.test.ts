import "./helpers/env.js";
import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { signAccessToken } from "../src/utils/jwt.js";

// 소설 등록 → Outbox 파이프라인 검증 (정적 분석으로 확인하기 어려운
// "소설 데이터 + Outbox 이벤트가 같은 트랜잭션으로 저장되는가"를 검증).

function authHeader(userId: number) {
  return { Authorization: `Bearer ${signAccessToken(userId).token}` };
}

async function createUser(username: string) {
  return prisma.user.create({
    data: {
      username,
      passwordHash: "$argon2id$test$placeholder",
      addr: randomBytes(32).toString("hex"),
      pkOwn: "a".repeat(64),
      pkEnc: "b".repeat(128),
      eoa: `0x${"0".repeat(40)}`,
    },
  });
}

function registerBody(overrides: Record<string, unknown> = {}) {
  return {
    title: "테스트 소설",
    description: "테스트 설명",
    content: "테스트 본문",
    price: 1000,
    ...overrides,
  };
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "content_registration_sources", "outbox", "content_registrations", "buy_history", "content_list", "refresh_tokens", "user" RESTART IDENTITY CASCADE',
  );
});

after(async () => {
  await prisma.$disconnect();
});

describe("소설 등록 → Outbox 파이프라인", () => {
  let user: { id: number };

  beforeEach(async () => {
    user = await createUser("author1");
  });

  it("소설 데이터와 Outbox 이벤트가 같은 트랜잭션으로 생성된다", async () => {
    const res = await request(app)
      .post("/api/novels")
      .set(authHeader(user.id))
      .send(registerBody());
    assert.equal(res.status, 201);
    const registrationId = res.body.id as number;

    // 1. ContentRegistration 생성 확인
    const registration = await prisma.contentRegistration.findUnique({
      where: { id: registrationId },
    });
    assert.ok(registration);
    assert.equal(registration.status, "PENDING");
    assert.equal(registration.authorId, user.id);

    // 2. 원문은 ContentRegistrationSource에 저장 (proof-worker가 암호화에 사용)
    const source = await prisma.contentRegistrationSource.findUnique({
      where: { registrationId },
    });
    assert.ok(source);
    assert.equal(source.originalText, "테스트 본문");

    // 3. Outbox 이벤트가 PENDING 상태로 생성 (Kafka 발행 대기)
    const outbox = await prisma.outbox.findFirst({
      where: { jobType: "CONTENT_REGISTRATION", referenceId: registrationId },
    });
    assert.ok(outbox, "Outbox 이벤트가 생성되어야 한다");
    assert.equal(outbox.status, "PENDING");
    assert.equal(outbox.retryCount, 0);
    assert.equal(outbox.publishedAt, null);
    assert.ok(outbox.jobId, "jobId가 설정되어야 한다 (UUID)");
    assert.equal(outbox.jobType, "CONTENT_REGISTRATION");
  });
});
