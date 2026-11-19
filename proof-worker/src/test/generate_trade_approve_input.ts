import { PublicKeyEncryption, scalarMulBase } from "../crypto/encryption.js";
import { buildTradeApproveCircuitInput } from "../proof/proof.service.js";
import { poseidonHash, poseidon2, randomFieldElement } from "../crypto/poseidon.js";
import fs from "node:fs";

/**
 * handleTradeApproval 흐름 기반으로 approve_trade 회로의 circuitInput을 생성한다.
 * proof를 테스트하기 위한 샘플 입력을 만들어 input.json으로 저장한다.
 */
async function main(): Promise<void> {
  const pubEnc = await PublicKeyEncryption.create();

  // ----------------------------------------------------------
  // 샘플 주문 데이터 (handleTradeApproval의 decrypted order)
  // ----------------------------------------------------------
  const pk_own_auth = randomFieldElement();
  const data_enc_key = randomFieldElement();
  const r_cm = randomFieldElement();
  const fee_svr = 1n;
  const fee_auth = 99n;
  const pk_own_svr = randomFieldElement();
  // 유효한 BabyJubjub point여야 circuit의 EscalarMulAny(Edwards2Montgomery)와 일치한다.
  const pk_enc_cons = await scalarMulBase(randomFieldElement());
  const h_k = poseidon2(pk_own_auth, data_enc_key);

  // cm 계산 (Poseidon 6)
  const cm_auth = poseidonHash([
    pk_own_auth,
    r_cm,
    fee_auth,
    h_k,
    pk_enc_cons[0],
    pk_enc_cons[1],
  ]);
  const cm_svr = poseidonHash([
    pk_own_svr,
    r_cm,
    fee_svr,
    h_k,
    pk_enc_cons[0],
    pk_enc_cons[1],
  ]);

  // dataEncKey 암호화 (approve_trade cipher: c0/c1/c2)
  const cipher = pubEnc.Enc(pk_enc_cons, data_enc_key);

  // circuitInput 조립
  const circuitInput = buildTradeApproveCircuitInput({
    cmAuth: cm_auth.toString(),
    cmSvr: cm_svr.toString(),
    pkOwnSvr: pk_own_svr,
    order: {
      pk_own_auth,
      r_cm,
      fee_svr,
      fee_auth,
      h_k,
      pk_enc_cons,
    },
    cipher,
    dataEncKey: data_enc_key,
  });

  fs.writeFileSync(
    "./src/test/trade_approve_input.json",
    JSON.stringify(circuitInput, null, 2),
  );
  console.log("circuitInput written to ./src/test/trade_approve_input.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
