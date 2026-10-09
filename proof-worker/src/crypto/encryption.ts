import {
  BN254_SCALAR_FIELD,
  DATA_BLOCK_BYTES,
  DATA_BLOCK_NUM,
  bytes31ToField,
  fieldToBytes31,
  fieldToBytes32,
  parseFieldElement,
  poseidon2,
  poseidonHash484,
  randomFieldElement,
} from "./poseidon.js";
import { env } from "../config/env.js";
import { wrapDataEncKey } from "./key-wrapping.js";

// ------------------------------------------------------------
// RegistContent 회로와 일치하는 콘텐츠 등록 암호화
//
//   data[i]   = 31-byte plaintext block → bigint
//   hash_i    = Poseidon(dataEncKey + i, CT_r)
//   CT_data[i] = (data[i] + hash_i) mod r
//   h_k       = Poseidon(pk_own, dataEncKey)
//   h_data    = Poseidon(data[0..N-1])
//   h_ct      = Poseidon(CT_data[0..N-1])
//
// 공개 신호 순서: [pk_own, h_k, h_ct, h_data]
// ------------------------------------------------------------

// 원문 byte 길이를 저장하기 위한 3 bytes
const PLAIN_TEXT_LENGTH_BYTES = 3;

// [4 bytes length][plaintext][0x80][0x00 ...] padding 후 총 byte 수
const PADDED_CONTENT_BYTES = DATA_BLOCK_NUM * DATA_BLOCK_BYTES;

// 실제 plaintext 최대 byte 수
const MAX_CONTENT_BYTES = PADDED_CONTENT_BYTES - PLAIN_TEXT_LENGTH_BYTES - 1;

// 암호화 포맷 버전 (현재 1)
export const ENCRYPTION_VERSION = 1;

interface ContentRegistrationWitness {
    dataEncKey: string;
    data: string[];
    CT_data: string[];
    CT_r: string;
}

export interface ContentEncryptionResult {
  pk_own: string;
  // CT_data 를 각각 32-byte big-endian 으로 연결 (DATA_BLOCK_NUM × 32 bytes)
  encryptedData: Uint8Array<ArrayBuffer>;

  // dataEncKey를 master key로 AES-256-GCM 암호화한 값 ([IV(12)][authTag(16)][ciphertext(32)])
  encryptedDataKey: Uint8Array<ArrayBuffer>;
  // Poseidon 암호화 랜덤값 CT_r (canonical 64-char hex string)
  ctR: string;

  // 암호화 포맷 버전
  encryptionVersion: number;

  // Poseidon 공개값 (canonical 64-char hex string)
  hK: string;
  hData: string;
  hCt: string;

  // 회로 witness (private ZK input, BigInt → decimal string)
  witness: ContentRegistrationWitness;
}

export type ContentEncryptionOutcome =
  | {
    success: true;
    result: ContentEncryptionResult;
  }
  | {
    success: false;
    reason: string;
  };

export function encryptContent(
  originalText: string,
  authorPkOwn: string,
): ContentEncryptionOutcome {
  if (!originalText) {
    return {
      success: false,
      reason: "originalText is required",
    };
  }

  if (!authorPkOwn) {
    return {
      success: false,
      reason: "authorPkOwn is required",
    };
  }

  const plaintext = Buffer.from(originalText, "utf8");

  if (plaintext.length > MAX_CONTENT_BYTES) {
    return {
      success: false,
      reason: `Content is too large: ${plaintext.length} bytes (maximum ${MAX_CONTENT_BYTES} bytes)`,
    };
  }

  // ==========================================================
  // 1. Padding → 31-byte block 분할
  // ==========================================================

  const paddedPlaintext = padPlaintext(plaintext);
  const blocks = splitInto31ByteBlocks(paddedPlaintext);

  const data = blocks.map((block) => bytes31ToField(block));

  // ==========================================================
  // 2. 암호화 키 + randomness
  // ==========================================================

  const dataEncKey = randomFieldElement();
  const CT_r = randomFieldElement();

  // ==========================================================
  // 3. h_k = Poseidon(pk_own, dataEncKey)
  // ==========================================================

  const pkOwnField = parseFieldElement(authorPkOwn);
  const h_k = poseidon2(pkOwnField, dataEncKey);

  // ==========================================================
  // 4. CT_data[i] = (data[i] + Poseidon(dataEncKey + i, CT_r)) mod r
  // ==========================================================

  const CT_data = data.map((d, i) => {
    const hash_i = poseidon2((dataEncKey + BigInt(i)) % BN254_SCALAR_FIELD, CT_r);

    return (d + hash_i) % BN254_SCALAR_FIELD;
  });

  // ==========================================================
  // 5. h_data = Poseidon(data[0..N-1])
  //    h_ct   = Poseidon(CT_data[0..N-1])
  // ==========================================================

  const h_data = poseidonHash484(data);
  const h_ct = poseidonHash484(CT_data);

  // ==========================================================
  // 6. dataEncKey 서버-side key wrapping (AES-256-GCM)
  // ==========================================================

  const masterKey = Buffer.from(env.masterKey, "base64");
  const encryptedDataKey = wrapDataEncKey(dataEncKey, masterKey);

  // ==========================================================
  // 7. 결과 (witness + public signals + DB 저장용)
  // ==========================================================

  const witness: ContentRegistrationWitness = {
    dataEncKey: dataEncKey.toString(),
    data: data.map((d) => d.toString()),
    CT_data: CT_data.map((c) => c.toString()),
    CT_r: CT_r.toString(),
  };

  const result: ContentEncryptionResult = {
    pk_own: pkOwnField.toString(),
    encryptedData: Uint8Array.from(
      Buffer.concat(CT_data.map((c) => Buffer.from(fieldToBytes32(c)))),
    ),
    encryptedDataKey,
    ctR: CT_r.toString(),
    encryptionVersion: ENCRYPTION_VERSION,
    hK: h_k.toString(),
    hData: h_data.toString(),
    hCt: h_ct.toString(),
    witness,
  };

  return {
    success: true,
    result,
  };
}

/**
 * 암호문(CT_data) + dataEncKey + CT_r 로 원문을 복원한다.
 * round-trip 검증용.
 */
export function decryptContent(
  encryptedData: Uint8Array,
  dataEncKey: bigint,
  CT_r: bigint,
): Buffer {
  if (encryptedData.length !== DATA_BLOCK_NUM * 32) {
    throw new Error(
      `Invalid encrypted data length: ${encryptedData.length}`,
    );
  }

  const CT_data: bigint[] = [];

  for (let i = 0; i < DATA_BLOCK_NUM; i++) {
    const slice = encryptedData.subarray(i * 32, (i + 1) * 32);

    let value = 0n;

    for (const byte of slice) {
      value = (value << 8n) | BigInt(byte);
    }

    CT_data.push(value);
  }

  const data = CT_data.map((c, i) => {
    const hash_i = poseidon2(
      (dataEncKey + BigInt(i)) % BN254_SCALAR_FIELD,
      CT_r,
    );

    return (c - hash_i + BN254_SCALAR_FIELD) % BN254_SCALAR_FIELD;
  });

  const padded = Buffer.concat(
    data.map((d) => Buffer.from(fieldToBytes31(d))),
  );

  return unpadPlaintext(padded);
}

/**
 * [4 bytes length][plaintext][0x80][0x00 ...] 로 padding.
 */
function padPlaintext(plaintext: Buffer): Buffer {
  const padded = Buffer.alloc(PADDED_CONTENT_BYTES, 0x00);

  padded.writeUInt32BE(plaintext.length, 0);

  plaintext.copy(padded, PLAIN_TEXT_LENGTH_BYTES);

  padded[PLAIN_TEXT_LENGTH_BYTES + plaintext.length] = 0x80;

  return padded;
}

/**
 * padding 제거.
 */
function unpadPlaintext(padded: Buffer): Buffer {
  if (padded.length !== PADDED_CONTENT_BYTES) {
    throw new Error("Invalid padded plaintext length");
  }

  const plaintextLength = padded.readUInt32BE(0);

  if (plaintextLength > MAX_CONTENT_BYTES) {
    throw new Error("Invalid plaintext length");
  }

  const markerIndex = PLAIN_TEXT_LENGTH_BYTES + plaintextLength;

  if (padded[markerIndex] !== 0x80) {
    throw new Error("Invalid padding marker");
  }

  for (let i = markerIndex + 1; i < padded.length; i++) {
    if (padded[i] !== 0x00) {
      throw new Error("Invalid padding");
    }
  }

  return padded.subarray(PLAIN_TEXT_LENGTH_BYTES, markerIndex);
}

/**
 * 31-byte 고정 크기 block 으로 분할.
 */
function splitInto31ByteBlocks(data: Buffer): Uint8Array[] {
  if (data.length !== PADDED_CONTENT_BYTES) {
    throw new Error(`Data length must be ${PADDED_CONTENT_BYTES} bytes`);
  }

  const blocks: Uint8Array[] = [];

  for (let offset = 0; offset < data.length; offset += DATA_BLOCK_BYTES) {
    blocks.push(
      Uint8Array.from(
        data.subarray(offset, offset + DATA_BLOCK_BYTES),
      ),
    );
  }

  return blocks;
}
