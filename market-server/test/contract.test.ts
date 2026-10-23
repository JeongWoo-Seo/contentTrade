import "./helpers/env.js";
import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../src/app.js";
import { contractService } from "../src/services/contract.service.js";

after(async () => {
  // 이 테스트는 DB를 사용하지 않으므로 prisma disconnect 불필요.
});
describe("GET /api/contracts/address", () => {
  beforeEach(async () => {
    await contractService.load();
  });

  it("배포 JSON에서 컨트랙트 주소를 반환한다", async () => {
    const res = await request(app).get("/api/contracts/address");

    assert.equal(res.status, 200);
    assert.equal(res.body.chainId, 31337);
    assert.ok(res.body.contentTrade && res.body.contentTrade.startsWith("0x"));
    assert.ok(res.body.registContentVerifier && res.body.registContentVerifier.startsWith("0x"));
  });
});
