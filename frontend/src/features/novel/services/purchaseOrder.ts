import { poseidonHash } from '../../../utils/crypto/poseidon';
import { PublicKeyEncryption } from '../../../utils/crypto/encryption';
import { fromHex, fromDecimal, randomFieldElement, hexToDecimal, splitPointHex } from '../../../utils/crypto/util';
import { FIELD_PRIME } from '../../../utils/crypto/constants';
import type { AccountBalanceUpdate } from '../../../utils/crypto/balance';

// createPurchaseOrder의 반환값. generate_trade 회로 입력 조립의 재료가 된다.
export interface PurchaseOrder {
  fee_auth: bigint;
  fee_svr: bigint;
  r_cm: bigint;
  cm_svr: bigint;
  cm_auth: bigint;
  r_enc: bigint;
  k_enc: bigint;
  c0: [bigint, bigint];
  c1_auth: bigint;
  c1_svr: bigint;
  c2: bigint[];
}

export async function createPurchaseOrder(
  input: {
    pk_enc_cons: [string,string];
    pk_enc_svr: [string,string];
    pk_enc_auth: [string,string];
    pk_own_svr: string;
    pk_own_auth: string;
    h_k: string;
    price: bigint;
  }
): Promise<PurchaseOrder> {
  const {
    pk_enc_cons,
    pk_enc_svr,
    pk_enc_auth,
    pk_own_svr,
    pk_own_auth,
    h_k,
    price,
  } = input;

  if (price < 1n || price >= FIELD_PRIME) {
    throw new Error("Invalid price");
  }

  const fee_svr = 1n;
  const fee_auth = price - fee_svr;

  const r_cm = randomFieldElement();

  const cm_svr = await poseidonHash(
    [fromHex(pk_own_svr),
      r_cm,
      fee_svr,
      fromDecimal(h_k),
      fromHex(pk_enc_cons[0]),
      fromHex(pk_enc_cons[1])
    ]
  );

  const cm_auth = await poseidonHash(
    [fromHex(pk_own_auth),
      r_cm,
      fee_auth,
      fromDecimal(h_k),
      fromHex(pk_enc_cons[0]),
      fromHex(pk_enc_cons[1])
    ]
  );

  // pk_enc_svr로 암호화
  const pubEnc = await PublicKeyEncryption.create()
  const encrypted = pubEnc.Enc(
    [fromHex(pk_enc_auth[0]), fromHex(pk_enc_auth[1])],
    [fromHex(pk_enc_svr[0]), fromHex(pk_enc_svr[1])],
    fromHex(pk_own_auth),
    r_cm,
    fee_auth,
    fee_svr,
    fromDecimal(h_k),
    fromHex(pk_enc_cons[0]),
    fromHex(pk_enc_cons[1])
  );

  return {
    fee_auth,
    fee_svr,
    r_cm,

    cm_svr,
    cm_auth,

    r_enc: encrypted.r_enc,
    k_enc: encrypted.k_enc,
    c0: encrypted.ciphertext.c0,
    c1_auth: encrypted.ciphertext.c1_auth,
    c1_svr: encrypted.ciphertext.c1_svr,
    c2: encrypted.ciphertext.c2
  };
}

// handlePurchase [구매 절차 5/8] 결과(purchaseOrder + balanceUpdate)를
// generate_trade 회로 입력(circuitInput)으로 변환한다.
export interface GenerateTradeInputParams {
  purchaseOrder: PurchaseOrder;
  balanceUpdate: AccountBalanceUpdate;
  hK: string;
  serverPkOwn: string;
  authorPkOwn: string;
  pkEnc: string;
  serverPkEnc: string;
  authorPkEnc: string;
  kENA: string;
}

export function buildGenerateTradeInput(params: GenerateTradeInputParams) {
  const {
    purchaseOrder,
    balanceUpdate,
    hK,
    serverPkOwn,
    authorPkOwn,
    pkEnc,
    serverPkEnc,
    authorPkEnc,
    kENA,
  } = params;

  const pk_enc_cons = splitPointHex(pkEnc);
  const pk_enc_svr = splitPointHex(serverPkEnc);
  const pk_enc_auth = splitPointHex(authorPkEnc);

  return {
    // Public inputs
    cm_auth: purchaseOrder.cm_auth.toString(),
    cm_svr: purchaseOrder.cm_svr.toString(),
    c0: [purchaseOrder.c0[0].toString(), purchaseOrder.c0[1].toString()],
    c1_auth: purchaseOrder.c1_auth.toString(),
    c1_svr: purchaseOrder.c1_svr.toString(),
    c2: purchaseOrder.c2.map((v) => v.toString()),
    oldEna_r: balanceUpdate.oldEna.r.toString(),
    oldEna_ct: balanceUpdate.oldEna.ct.toString(),
    newEna_r: balanceUpdate.newEna.r.toString(),
    newEna_ct: balanceUpdate.newEna.ct.toString(),

    // Private inputs
    fee_svr: purchaseOrder.fee_svr.toString(),
    fee_auth: purchaseOrder.fee_auth.toString(),
    r_cm: purchaseOrder.r_cm.toString(),
    r_enc: purchaseOrder.r_enc.toString(),
    k_enc: purchaseOrder.k_enc.toString(),
    h_k: hK,
    pk_enc_cons: [hexToDecimal(pk_enc_cons[0]), hexToDecimal(pk_enc_cons[1])],
    pk_enc_svr: [hexToDecimal(pk_enc_svr[0]), hexToDecimal(pk_enc_svr[1])],
    pk_enc_auth: [hexToDecimal(pk_enc_auth[0]), hexToDecimal(pk_enc_auth[1])],
    pk_own_svr: hexToDecimal(serverPkOwn),
    pk_own_auth: hexToDecimal(authorPkOwn),
    k_ena: hexToDecimal(kENA),
  };
}
