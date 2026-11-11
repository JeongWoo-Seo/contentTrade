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
      txHash: `0x${randomBytes(32).toString("hex")}`,
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

async function createBuyHistory(buyerId: number, contentId: number, overrides: Record<string, unknown> = {}) {
  return prisma.buyHistory.create({
    data: {
      buyerId,
      contentId,
      status: "APPROVED",
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
  it("이미 구매 완료(APPROVED)한 소설은 alreadyPurchased=true를 반환한다", async () => {
    const content = await createContentList(author.id);
    await createBuyHistory(user.id, content.id, { status: "APPROVED" });
    const res = await request(app).get(`/api/novels/${content.id}/trade`).set(authHeader(user.id));

    assert.equal(res.status, 200);
    assert.equal(res.body.alreadyPurchased, true);
  });

  it("구매 요청(REVIEWING) 중인 소설도 alreadyPurchased=true를 반환한다", async () => {
    const content = await createContentList(author.id);
    await createBuyHistory(user.id, content.id, { status: "REVIEWING" });
    const res = await request(app).get(`/api/novels/${content.id}/trade`).set(authHeader(user.id));

    assert.equal(res.status, 200);
    assert.equal(res.body.alreadyPurchased, true);
  });

  it("구매 거절(REJECTED)된 소설은 alreadyPurchased=false다", async () => {
    const content = await createContentList(author.id);
    await createBuyHistory(user.id, content.id, { status: "REJECTED" });
    const res = await request(app).get(`/api/novels/${content.id}/trade`).set(authHeader(user.id));

    assert.equal(res.status, 200);
    assert.equal(res.body.alreadyPurchased, false);
  });

  it("구매 이력이 없으면 alreadyPurchased=false다", async () => {
    const content = await createContentList(author.id);
    const res = await request(app).get(`/api/novels/${content.id}/trade`).set(authHeader(user.id));

    assert.equal(res.status, 200);
    assert.equal(res.body.alreadyPurchased, false);
  });

  it("구매 완료한 사용자는 절판(DISCONTINUED) 소설도 열람할 수 있다", async () => {
    const content = await createContentList(author.id, { status: "DISCONTINUED" });
    await createBuyHistory(user.id, content.id, { status: "APPROVED" });
    const res = await request(app).get(`/api/novels/${content.id}/trade`).set(authHeader(user.id));

    assert.equal(res.status, 200);
    assert.equal(res.body.alreadyPurchased, true);
  });
});

describe("POST /api/novels/:id/purchase", () => {
  let user: { id: number };
  let author: { id: number };

  const TX_HASH = `0x${"a".repeat(64)}`;

  beforeEach(async () => {
    user = await createUser("buyer1");
    author = await createUser("author1");
  });

  it("판매 중(ACTIVE) 소설은 구매 승인 요청을 접수한다", async () => {
    const content = await createContentList(author.id);
    const res = await request(app)
      .post(`/api/novels/${content.id}/purchase`)
      .set(authHeader(user.id))
      .send({ txHash: TX_HASH });

    assert.equal(res.status, 200);
    assert.equal(res.body.contentId, content.id);
    assert.equal(res.body.txHash, TX_HASH);
  });

  it("구매 요청 시 BuyHistory와 PURCHASE_VERIFICATION Outbox를 함께 생성한다", async () => {
    const content = await createContentList(author.id);
    const res = await request(app)
      .post(`/api/novels/${content.id}/purchase`)
      .set(authHeader(user.id))
      .send({ txHash: TX_HASH });

    assert.equal(res.status, 200);

    // BuyHistory 생성 확인
    const buyHistory = await prisma.buyHistory.findFirst({
      where: { buyerId: user.id, contentId: content.id },
    });
    assert.ok(buyHistory, "BuyHistory가 생성되어야 한다");
    assert.equal(buyHistory.status, "REVIEWING");
    assert.equal(buyHistory.txHash, TX_HASH);

    // Outbox 생성 확인 (referenceId = BuyHistory.id, PENDING)
    const outbox = await prisma.outbox.findFirst({
      where: { jobType: "PURCHASE_VERIFICATION", referenceId: buyHistory.id },
    });
    assert.ok(outbox, "PURCHASE_VERIFICATION Outbox가 생성되어야 한다");
    assert.equal(outbox.status, "PENDING");
  });

  it("절판(DISCONTINUED) 소설은 거래 불가 응답을 반환한다", async () => {
    const content = await createContentList(author.id, { status: "DISCONTINUED" });
    const res = await request(app)
      .post(`/api/novels/${content.id}/purchase`)
      .set(authHeader(user.id))
      .send({ txHash: TX_HASH });

    assert.equal(res.status, 409);
    assert.equal(res.body.error, "CONTENT_NOT_AVAILABLE");
  });

  it("판매 금지(BANNED) 소설은 거래 불가 응답을 반환한다", async () => {
    const content = await createContentList(author.id, { status: "BANNED" });
    const res = await request(app)
      .post(`/api/novels/${content.id}/purchase`)
      .set(authHeader(user.id))
      .send({ txHash: TX_HASH });

    assert.equal(res.status, 409);
    assert.equal(res.body.error, "CONTENT_NOT_AVAILABLE");
  });

  it("존재하지 않는 소설은 404를 반환한다", async () => {
    const res = await request(app)
      .post("/api/novels/999999/purchase")
      .set(authHeader(user.id))
      .send({ txHash: TX_HASH });

    assert.equal(res.status, 404);
    assert.equal(res.body.error, "NOT_FOUND");
  });

  it("txHash 형식이 올바르지 않으면 400을 반환한다", async () => {
    const content = await createContentList(author.id);
    const res = await request(app)
      .post(`/api/novels/${content.id}/purchase`)
      .set(authHeader(user.id))
      .send({ txHash: "not-a-hash" });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, "VALIDATION_ERROR");
  });

  it("인증 없이 요청하면 401을 반환한다", async () => {
    const content = await createContentList(author.id);
    const res = await request(app)
      .post(`/api/novels/${content.id}/purchase`)
      .send({ txHash: TX_HASH });

    assert.equal(res.status, 401);
  });
});
