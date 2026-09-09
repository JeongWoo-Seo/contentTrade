import "./helpers/env.js";
import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { signAccessToken } from "../src/utils/jwt.js";

// ---- helpers ----

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

async function createContentList(authorId: number, overrides: Partial<Record<string, unknown>> = {}) {
  return prisma.contentList.create({
    data: {
      title: (overrides.title as string) ?? "소설",
      authorId,
      price: (overrides.price as number) ?? 1000,
      description: (overrides.description as string) ?? "설명",
      encryptedData: "dummy",
      iv: "dummy-iv",
      authTag: "dummy-tag",
      encryptedDataKey: "dummy-key",
      status: (overrides.status as never) ?? "ACTIVE",
    },
  });
}

async function createRegistration(authorId: number, overrides: Partial<Record<string, unknown>> = {}) {
  return prisma.contentRegistration.create({
    data: {
      title: (overrides.title as string) ?? "등록 소설",
      description: (overrides.description as string) ?? "설명",
      authorId,
      price: (overrides.price as number) ?? 1000,
      content: (overrides.content as string) ?? "본문",
      status: (overrides.status as never) ?? "PENDING",
      rejectionReason: overrides.rejectionReason as string | null | undefined,
      contentId: overrides.contentId as number | null | undefined,
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
    'TRUNCATE "content_registrations", "buy_history", "content_list", "refresh_tokens", "user" RESTART IDENTITY CASCADE',
  );
});

after(async () => {
  await prisma.$disconnect();
});

// ============================================================
// 소설 등록 요청
// ============================================================

describe("POST /api/novels", () => {
  let user: { id: number };

  beforeEach(async () => {
    user = await createUser("author1");
  });

  it("registers a novel with PENDING status", async () => {
    const res = await request(app).post("/api/novels").set(authHeader(user.id)).send(registerBody());
    assert.equal(res.status, 201);
    assert.equal(res.body.status, "PENDING");
    assert.equal(res.body.contentId, null);
    assert.equal(res.body.rejectionReason, null);
    assert.equal(res.body.title, "테스트 소설");

    const stored = await prisma.contentRegistration.findUnique({ where: { id: res.body.id } });
    assert.equal(stored!.authorId, user.id);
  });

  it("rejects when JWT is missing", async () => {
    const res = await request(app).post("/api/novels").send(registerBody());
    assert.equal(res.status, 401);
  });

  it("rejects an invalid JWT", async () => {
    const res = await request(app).post("/api/novels").set("Authorization", "Bearer bad-token").send(registerBody());
    assert.equal(res.status, 401);
  });

  it("rejects missing title", async () => {
    const res = await request(app).post("/api/novels").set(authHeader(user.id)).send(registerBody({ title: "   " }));
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "VALIDATION_ERROR");
  });

  it("rejects title over 50 chars", async () => {
    const res = await request(app).post("/api/novels").set(authHeader(user.id)).send(registerBody({ title: "a".repeat(51) }));
    assert.equal(res.status, 400);
  });

  it("rejects missing content", async () => {
    const res = await request(app).post("/api/novels").set(authHeader(user.id)).send(registerBody({ content: "  " }));
    assert.equal(res.status, 400);
  });

  it("rejects content over 5000 chars", async () => {
    const res = await request(app).post("/api/novels").set(authHeader(user.id)).send(registerBody({ content: "a".repeat(5001) }));
    assert.equal(res.status, 400);
  });

  it("accepts Korean content at exactly 5000 chars and rejects 5001", async () => {
    const ok = await request(app).post("/api/novels").set(authHeader(user.id)).send(registerBody({ content: "가".repeat(5000) }));
    assert.equal(ok.status, 201);

    const over = await request(app).post("/api/novels").set(authHeader(user.id)).send(registerBody({ content: "가".repeat(5001) }));
    assert.equal(over.status, 400);
  });

  it("rejects missing price", async () => {
    const res = await request(app).post("/api/novels").set(authHeader(user.id)).send(registerBody({ price: undefined }));
    assert.equal(res.status, 400);
  });

  it("rejects negative price", async () => {
    const res = await request(app).post("/api/novels").set(authHeader(user.id)).send(registerBody({ price: -1 }));
    assert.equal(res.status, 400);
  });

  it("rejects non-integer price", async () => {
    const res = await request(app).post("/api/novels").set(authHeader(user.id)).send(registerBody({ price: 1000.5 }));
    assert.equal(res.status, 400);
  });

  it("ignores authorId in body and uses JWT user id", async () => {
    const other = await createUser("author2");
    const res = await request(app).post("/api/novels").set(authHeader(user.id)).send(registerBody({ authorId: other.id }));
    assert.equal(res.status, 201);
    const stored = await prisma.contentRegistration.findUnique({ where: { id: res.body.id } });
    assert.equal(stored!.authorId, user.id);
  });
});

// ============================================================
// 등록 완료된 소설 목록
// ============================================================

describe("GET /api/novels", () => {
  let author: { id: number; username: string };

  beforeEach(async () => {
    author = await createUser("author1");
  });

  it("returns novels with author, price, status (no content/encrypted data)", async () => {
    await createContentList(author.id, { title: "소설 A", price: 1000, status: "ACTIVE", description: "설명 A" });

    const res = await request(app).get("/api/novels").set(authHeader(author.id));
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
    assert.equal(res.body.items.length, 1);

    const item = res.body.items[0];
    assert.equal(item.title, "소설 A");
    assert.equal(item.author, author.username);
    assert.equal(item.price, 1000);
    assert.equal(item.status, "ACTIVE");
    assert.equal(item.content, undefined);
    assert.equal(item.encryptedData, undefined);
    assert.equal(item.encrypted_data, undefined);
  });

  it("applies page/size and returns total", async () => {
    for (let i = 1; i <= 5; i++) await createContentList(author.id, { title: `소설 ${i}` });

    const page1 = await request(app).get("/api/novels?page=1&size=2").set(authHeader(author.id));
    assert.equal(page1.body.total, 5);
    assert.equal(page1.body.items.length, 2);

    const page3 = await request(app).get("/api/novels?page=3&size=2").set(authHeader(author.id));
    assert.equal(page3.body.items.length, 1);
  });

  it("returns empty list when no novels", async () => {
    const res = await request(app).get("/api/novels").set(authHeader(author.id));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.items, []);
    assert.equal(res.body.total, 0);
  });

  it("returns ACTIVE / DISCONTINUED / BANNED statuses", async () => {
    await createContentList(author.id, { title: "A", status: "ACTIVE" });
    await createContentList(author.id, { title: "B", status: "DISCONTINUED" });
    await createContentList(author.id, { title: "C", status: "BANNED" });

    const res = await request(app).get("/api/novels").set(authHeader(author.id));
    const statuses = res.body.items.map((i: { status: string }) => i.status).sort();
    assert.deepEqual(statuses, ["ACTIVE", "BANNED", "DISCONTINUED"]);
  });
});

// ============================================================
// 내 등록 요청 목록
// ============================================================

describe("GET /api/novels/mine", () => {
  let author: { id: number };
  let other: { id: number };

  beforeEach(async () => {
    author = await createUser("author1");
    other = await createUser("author2");
  });

  it("rejects when JWT is missing", async () => {
    const res = await request(app).get("/api/novels/mine");
    assert.equal(res.status, 401);
  });

  it("returns only my registrations", async () => {
    await createRegistration(author.id, { title: "내 소설" });
    await createRegistration(other.id, { title: "남의 소설" });

    const res = await request(app).get("/api/novels/mine").set(authHeader(author.id));
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
    assert.equal(res.body.items[0].title, "내 소설");
  });

  it("returns statuses: PENDING / PROCESSING / APPROVED / REJECTED", async () => {
    await createRegistration(author.id, { title: "P", status: "PENDING" });
    await createRegistration(author.id, { title: "R", status: "PROCESSING" });
    const content = await createContentList(author.id, { title: "승인된 소설" });
    await createRegistration(author.id, { title: "A", status: "APPROVED", contentId: content.id });
    await createRegistration(author.id, { title: "J", status: "REJECTED", rejectionReason: "검증 실패" });

    const res = await request(app).get("/api/novels/mine").set(authHeader(author.id));
    assert.equal(res.body.total, 4);

    const rejected = res.body.items.find((i: { title: string }) => i.title === "J");
    assert.equal(rejected.status, "REJECTED");
    assert.equal(rejected.rejectionReason, "검증 실패");
    assert.equal(rejected.contentId, null);

    const approved = res.body.items.find((i: { title: string }) => i.title === "A");
    assert.equal(approved.status, "APPROVED");
    assert.equal(approved.contentId, content.id);
    assert.equal(approved.rejectionReason, null);
  });

  it("supports pagination", async () => {
    for (let i = 1; i <= 5; i++) await createRegistration(author.id, { title: `등록 ${i}` });

    const page1 = await request(app).get("/api/novels/mine?page=1&size=2").set(authHeader(author.id));
    assert.equal(page1.body.total, 5);
    assert.equal(page1.body.items.length, 2);
  });
});
