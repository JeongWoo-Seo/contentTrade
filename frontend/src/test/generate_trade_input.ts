import fs from 'node:fs';
import { createPurchaseOrder, buildGenerateTradeInput } from '../features/novel/services/purchaseOrder';
import { computeAccountBalanceUpdate, type Ena } from '../utils/crypto/balance';
import { SymmetricKeyEncryption } from '../utils/crypto/encryption';
import { scalarMulBase } from '../utils/crypto/ecc';
import { randomFieldElement, bigintToHex64 } from '../utils/crypto/util';
import { SUBGROUP_ORDER } from '../utils/crypto/constants';

// BabyJubjub point [x, y] → 128-hex (x‖y, 각 64 hex)
function pointToHex128(point: [bigint, bigint]): string {
  return bigintToHex64(point[0]) + bigintToHex64(point[1]);
}

/**
 * handlePurchase 흐름 기반으로 generate_trade 회로의 circuitInput을 생성한다.
 * proof를 테스트하기 위한 샘플 입력을 만들어 input.json으로 저장한다.
 */
async function main(): Promise<void> {
  const price = 100n;

  // ----------------------------------------------------------
  // 1. mock 키 생성 (유효한 BabyJubjub point)
  //    circuit의 EscalarMulAny(Edwards2Montgomery)와 일치해야 한다.
  // ----------------------------------------------------------
  const sk_enc_cons = randomFieldElement() % SUBGROUP_ORDER;
  const sk_enc_svr = randomFieldElement() % SUBGROUP_ORDER;
  const sk_enc_auth = randomFieldElement() % SUBGROUP_ORDER;

  const pk_enc_cons = await scalarMulBase(sk_enc_cons);
  const pk_enc_svr = await scalarMulBase(sk_enc_svr);
  const pk_enc_auth = await scalarMulBase(sk_enc_auth);

  const pkEnc = pointToHex128(pk_enc_cons);
  const serverPkEnc = pointToHex128(pk_enc_svr);
  const authorPkEnc = pointToHex128(pk_enc_auth);

  // pk_own (스칼라, Poseidon 입력용)
  const serverPkOwn = bigintToHex64(randomFieldElement());
  const authorPkOwn = bigintToHex64(randomFieldElement());

  // 콘텐츠 키 해시 (dec string)
  const hK = randomFieldElement().toString();

  // 대칭키 kENA (hex, 0x 없음)
  const kENABigInt = randomFieldElement();
  const kENA = kENABigInt.toString(16);

  // ----------------------------------------------------------
  // 2. mock ENA (암호화 잔액)
  // ----------------------------------------------------------
  const encryption = await SymmetricKeyEncryption.create(kENABigInt, 1);
  const balance = 1000000n;
  const ena: Ena = encryption.Enc(balance);

  // ----------------------------------------------------------
  // 3. 잔액 차감 (oldEna → newEna)
  // ----------------------------------------------------------
  const balanceUpdate = await computeAccountBalanceUpdate(kENA, ena, price);

  // ----------------------------------------------------------
  // 4. 주문 암호화 (Cm + C0/C1/C2)
  // ----------------------------------------------------------
  const purchaseOrder = await createPurchaseOrder({
    pk_enc_cons: [bigintToHex64(pk_enc_cons[0]), bigintToHex64(pk_enc_cons[1])],
    pk_enc_svr: [bigintToHex64(pk_enc_svr[0]), bigintToHex64(pk_enc_svr[1])],
    pk_enc_auth: [bigintToHex64(pk_enc_auth[0]), bigintToHex64(pk_enc_auth[1])],
    pk_own_svr: serverPkOwn,
    pk_own_auth: authorPkOwn,
    h_k: hK,
    price,
  });

  // ----------------------------------------------------------
  // 5. generate_trade 회로 입력 조립
  // ----------------------------------------------------------
  const input = buildGenerateTradeInput({
    purchaseOrder,
    balanceUpdate,
    hK,
    serverPkOwn,
    authorPkOwn,
    pkEnc,
    serverPkEnc,
    authorPkEnc,
    kENA,
  });

  fs.writeFileSync(
    './src/test/generate_trade_input.json',
    JSON.stringify(input, null, 2),
  );
  console.log('generate_trade input written to ./src/test/generate_trade_input.json');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
