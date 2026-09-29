import crypto from "node:crypto";
import { env } from "../config/env.js";
import { hashBlocks, calculateKeyHash } from "./poseidon.js";

const AES_KEY_LENGTH = 32;
const AES_IV_LENGTH = 16;

const ENCRYPTION_VERSION = 1;

const MAX_CONTENT_CHARS = 5000;

// UTF-8에서 문자 1개가 최대 4 bytes
const MAX_CONTENT_BYTES = MAX_CONTENT_CHARS * 4;

// ZK 고정 블록 크기
const ZK_BLOCK_SIZE = 32;

// 원문 길이를 저장하기 위한 4 bytes
const PLAIN_TEXT_LENGTH_BYTES = 4;

// 길이 정보 + plaintext + padding marker
const MAX_PADDED_CONTENT_BYTES = MAX_CONTENT_BYTES + PLAIN_TEXT_LENGTH_BYTES + 1;

// ZK block에 맞춰 올림
const PADDED_CONTENT_BYTES = Math.ceil(MAX_PADDED_CONTENT_BYTES / ZK_BLOCK_SIZE) * ZK_BLOCK_SIZE;

const MAX_PADDED_CONTENT_BLOCKS = PADDED_CONTENT_BYTES / ZK_BLOCK_SIZE;


export interface ContentEncryptionResult {
  plaintextBlocks: Uint8Array[];
  encryptedDataBlocks: Uint8Array[];

  dataIv: Uint8Array;

  encryptedDataKey: Uint8Array;
  keyIv: Uint8Array;
  keyAuthTag: Uint8Array;

  encryptionVersion: number;

  keyHash: string;
  encryptedDataHash: string;
  contentHash: string;
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

  if (!env.masterKey) {
    throw new Error("MASTER_KEY is not configured");
  }

  // ==========================================================
  // 0. 입력 검증
  // ==========================================================

  if ([...originalText].length > MAX_CONTENT_CHARS) {
    return {
      success: false,
      reason: `Content is too long: maximum ${MAX_CONTENT_CHARS} characters`,
    };
  }

  const plaintext = Buffer.from(originalText, "utf8");

  if (plaintext.length > MAX_CONTENT_BYTES) {
    return {
      success: false,
      reason:
        `Content is too large: ${plaintext.length} bytes ` +
        `(maximum ${MAX_CONTENT_BYTES} bytes)`,
    };
  }

  // ==========================================================
  // 1. MASTER KEY
  // ==========================================================

  const masterKey = Buffer.from(env.masterKey, "base64");

  if (masterKey.length !== AES_KEY_LENGTH) {
    throw new Error("MASTER_KEY must be 32 bytes");
  }

  // ==========================================================
  // 2. Padding
  // ==========================================================

  const paddedPlaintext = padPlaintext(plaintext);

  if (paddedPlaintext.length !== PADDED_CONTENT_BYTES) {
    throw new Error(`Invalid padded plaintext length: ${paddedPlaintext.length}`);
  }

  // ==========================================================
  // 3. Plaintext → ZK blocks
  // ==========================================================

  const plaintextBlocks = splitIntoBlocks(paddedPlaintext);

  if (plaintextBlocks.length !== MAX_PADDED_CONTENT_BLOCKS) {
    throw new Error(
      `Invalid block count: expected ` +
      `${MAX_PADDED_CONTENT_BLOCKS}, got ` +
      `${plaintextBlocks.length}`,
    );
  }

  // ==========================================================
  // 4. AES-256-CTR
  // ==========================================================

  const dataKey = crypto.randomBytes(AES_KEY_LENGTH);
  const dataIv = crypto.randomBytes(AES_IV_LENGTH);
  const cipher = crypto.createCipheriv(
    "aes-256-ctr",
    dataKey,
    dataIv,
  );

  const encryptedDataBuffer = Buffer.concat([
    cipher.update(paddedPlaintext),
    cipher.final(),
  ]);

  if (encryptedDataBuffer.length !== paddedPlaintext.length) {
    throw new Error("Encrypted data length mismatch");
  }

  // ==========================================================
  // 5. Encrypted data → ZK blocks
  // ==========================================================

  const encryptedDataBlocks = splitIntoBlocks(encryptedDataBuffer);
  if (encryptedDataBlocks.length !== MAX_PADDED_CONTENT_BLOCKS) {
    throw new Error(
      `Invalid encrypted block count: expected ` +
      `${MAX_PADDED_CONTENT_BLOCKS}, got ` +
      `${encryptedDataBlocks.length}`,
    );
  }

  // ==========================================================
  // 6. Poseidon Hash
  //
  // 32-byte block
  //   ↓
  // 16 bytes + 16 bytes
  //   ↓
  // Poseidon(2)
  //   ↓
  // rolling Poseidon(2)
  // ==========================================================
  const contentHash = hashBlocks(plaintextBlocks).toString(16).padStart(64, "0");
  const encryptedDataHash = hashBlocks(encryptedDataBlocks).toString(16).padStart(64, "0");
  const keyHash = calculateKeyHash(authorPkOwn, dataKey).toString(16).padStart(64, "0");

  // ==========================================================
  // 7. Data Key를 MASTER_KEY로 암호화
  // ==========================================================

  const keyIv = crypto.randomBytes(AES_IV_LENGTH);
  const keyCipher = crypto.createCipheriv(
    "aes-256-ctr",
    masterKey,
    keyIv,
  );

  const encryptedDataKeyBuffer = Buffer.concat([
    keyCipher.update(dataKey),
    keyCipher.final(),
  ]);

  if (encryptedDataKeyBuffer.length !== AES_KEY_LENGTH) {
    throw new Error("Encrypted data key length mismatch");
  }

  // ==========================================================
  // 8. Data Key 무결성 검증
  // ==========================================================

  const keyAuthTag = crypto
    .createHmac("sha256", masterKey)
    .update(keyIv)
    .update(encryptedDataKeyBuffer)
    .digest();

  // ==========================================================
  // 9. 결과
  // ==========================================================

  const result: ContentEncryptionResult = {
    plaintextBlocks,
    encryptedDataBlocks,

    dataIv,
    encryptedDataKey: encryptedDataKeyBuffer,
    keyIv,
    keyAuthTag,

    encryptionVersion: ENCRYPTION_VERSION,

    keyHash,
    encryptedDataHash,
    contentHash,
  };

  return {
    success: true,
    result,
  };
}


/**
 * 데이터를 고정 크기 block으로 분할
 */
function splitIntoBlocks(
  data: Buffer,
): Uint8Array[] {

  if (data.length % ZK_BLOCK_SIZE !== 0) {
    throw new Error(`Data length must be multiple of ${ZK_BLOCK_SIZE} bytes`,
    );
  }

  const blocks: Uint8Array[] = [];

  for (let offset = 0; offset < data.length; offset += ZK_BLOCK_SIZE) {
    blocks.push(
      Uint8Array.from(
        data.subarray(
          offset,
          offset + ZK_BLOCK_SIZE,
        ),
      ),
    );
  }

  return blocks;
}


/**
 * Padding format
 * [4 bytes plaintext length][plaintext][0x80][0x00 ...]
 */
function padPlaintext(
  plaintext: Buffer,
): Buffer {

  if (plaintext.length > MAX_CONTENT_BYTES) {
    throw new Error(`Content is too large: ${plaintext.length} bytes`);
  }

  const padded = Buffer.alloc(PADDED_CONTENT_BYTES, 0x00);

  // ==========================================================
  // 1. 원문 byte 길이
  // ==========================================================

  // 처음 4 bytes에 원문의 길이 추가
  padded.writeUInt32BE(plaintext.length, 0);

  // ==========================================================
  // 2. 실제 plaintext
  // ==========================================================

  plaintext.copy(padded, PLAIN_TEXT_LENGTH_BYTES);

  // ==========================================================
  // 3. 종료 marker
  // ==========================================================

  const markerIndex = PLAIN_TEXT_LENGTH_BYTES + plaintext.length;
  padded[markerIndex] = 0x80;

  return padded;
}


/**
 * Padding 제거
 */
function unpadPlaintext(
  padded: Buffer,
): Buffer {

  if (padded.length !== PADDED_CONTENT_BYTES) {
    throw new Error("Invalid padded plaintext length");
  }

  // ==========================================================
  // 1. 원문 byte 길이
  // ==========================================================

  const plaintextLength = padded.readUInt32BE(0);

  if (plaintextLength > MAX_CONTENT_BYTES) {
    throw new Error("Invalid plaintext length");
  }

  // ==========================================================
  // 2. marker 위치
  // ==========================================================

  const markerIndex = PLAIN_TEXT_LENGTH_BYTES + plaintextLength;

  if (padded[markerIndex] !== 0x80) {
    throw new Error("Invalid padding marker");
  }

  // ==========================================================
  // 3. marker 이후는 전부 0x00
  // ==========================================================

  for (let i = markerIndex + 1; i < padded.length; i++) {
    if (padded[i] !== 0x00) {
      throw new Error("Invalid padding");
    }
  }

  // ==========================================================
  // 4. plaintext
  // ==========================================================

  return padded.subarray(
    PLAIN_TEXT_LENGTH_BYTES,
    markerIndex,
  );
}