import "./helpers/env.js";
import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { signAccessToken } from "../src/utils/jwt.js";
import { contentListRepository } from "../src/repositories/content-list.repository.js";

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
      eoa: `0x${randomBytes(20).toString("hex")}`,
    },
  });
}

async function createContentList(authorId: number, overrides: Record<string, unknown> = {}) {
  return prisma.contentList.create({
    data: {
      title: "소설",
      authorId,
      price: 1000,
      description: "설명",
      encryptedData: new Uint8Array(256),
      encryptedDataKey: new Uint8Array(60),
      ctR: "0".repeat(64),
      encryptionVersion: 1,
      hK: "1".repeat(64),
      hData: "2".repeat(64),
      hCt: "3".repeat(64),
      txHash: `0x${"0".repeat(64)}`,
      status: "ACTIVE",
      ...overrides,
    },
  });
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "content_registration_sources", "outbox", "content_registrations", "buy_history", "content_list", "refresh_tokens", "user" RESTART IDENTITY CASCADE',
  );
});

after(async () => {
  await prisma.$disconnect();
});

describe("GET /api/novels/:id/trade", () => {
  let user: { id: number };
  let author: { id: number; pkOwn: string };

  beforeEach(async () => {
    user = await createUser("buyer1");
    author = await createUser("author1");
  });

  it("거래 가능(ACTIVE) 소설의 거래 정보를 반환한다", async () => {
    const content = await createContentList(author.id);
    const res = await request(app).get(`/api/novels/${content.id}/trade`).set(authHeader(user.id));

    assert.equal(res.status, 200);
    assert.equal(res.body.hCt, "3".repeat(64));
    assert.equal(res.body.hK, "1".repeat(64));
    assert.equal(res.body.authorPkOwn, author.pkOwn);
    assert.equal(res.body.price, 1000);
    assert.ok(res.body.ctData && res.body.ctData.length > 0, "ctData(hex)가 반환되어야 한다");
    assert.equal(typeof res.body.serverPkEnc, "string");
    assert.equal(typeof res.body.serverPkOwn, "string");
  });

  it("절판(DISCONTINUED) 소설은 거래 불가 응답을 반환한다", async () => {
    const content = await createContentList(author.id, { status: "DISCONTINUED" });
    const res = await request(app).get(`/api/novels/${content.id}/trade`).set(authHeader(user.id));

    assert.equal(res.status, 409);
    assert.equal(res.body.error, "CONTENT_NOT_AVAILABLE");
  });

  it("판매 금지(BANNED) 소설은 거래 불가 응답을 반환한다", async () => {
    const content = await createContentList(author.id, { status: "BANNED" });
    const res = await request(app).get(`/api/novels/${content.id}/trade`).set(authHeader(user.id));

    assert.equal(res.status, 409);
    assert.equal(res.body.error, "CONTENT_NOT_AVAILABLE");
  });

  it("존재하지 않는 소설은 404를 반환한다", async () => {
    const res = await request(app).get("/api/novels/999999/trade").set(authHeader(user.id));

    assert.equal(res.status, 404);
    assert.equal(res.body.error, "NOT_FOUND");
  });

  it("인증 없이 요청하면 401을 반환한다", async () => {
    const content = await createContentList(author.id);
    const res = await request(app).get(`/api/novels/${content.id}/trade`);

    assert.equal(res.status, 401);
  });

  it("DB 조회 오류 시 500을 반환한다", async (t) => {
    t.mock.method(contentListRepository, "findByIdWithAuthor", async () => {
      throw new Error("simulated DB failure");
    });

    const res = await request(app).get("/api/novels/1/trade").set(authHeader(user.id));

    assert.equal(res.status, 500);
    assert.equal(res.body.error, "INTERNAL_SERVER_ERROR");
  });
});
