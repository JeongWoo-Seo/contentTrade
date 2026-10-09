import crypto from "node:crypto";
import { bytes32ToField, fieldToBytes32 } from "./poseidon.js";

const AES_KEY_LENGTH = 32;
const CTR_IV_LENGTH = 16;
const DATA_ENC_KEY_LENGTH = 32;

export const ENCRYPTED_DATA_KEY_LENGTH = CTR_IV_LENGTH + DATA_ENC_KEY_LENGTH;

/**
 * dataEncKey
 *   → AES-256-CTR(masterKey)
 *   → [IV][ciphertext]
 */
export function wrapDataEncKey(
  dataEncKey: bigint,
  masterKey: Buffer,
): Uint8Array<ArrayBuffer> {
  if (masterKey.length !== AES_KEY_LENGTH) {
    throw new Error(`MASTER_KEY must be ${AES_KEY_LENGTH} bytes`);
  }

  const iv = crypto.randomBytes(CTR_IV_LENGTH);

  const cipher = crypto.createCipheriv("aes-256-ctr", masterKey, iv);

  const plaintext = Buffer.from(fieldToBytes32(dataEncKey));

  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);

  return Uint8Array.from(
    Buffer.concat([
      iv,
      ciphertext,
    ]),
  );
}

/**
 * [IV][ciphertext]
 *   → AES-256-CTR(masterKey)
 *   → dataEncKey
 */
export function unwrapDataEncKey(
  encryptedDataKey: Uint8Array,
  masterKey: Buffer,
): bigint {
  if (masterKey.length !== AES_KEY_LENGTH) {
    throw new Error(`MASTER_KEY must be ${AES_KEY_LENGTH} bytes`);
  }

  if (encryptedDataKey.length !== ENCRYPTED_DATA_KEY_LENGTH) {
    throw new Error(`Invalid encryptedDataKey length: expected ${ENCRYPTED_DATA_KEY_LENGTH}, got ${encryptedDataKey.length}`);
  }

  const iv = encryptedDataKey.subarray(0, CTR_IV_LENGTH,);

  const ciphertext = encryptedDataKey.subarray(CTR_IV_LENGTH);

  const decipher = crypto.createDecipheriv("aes-256-ctr", masterKey, iv);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  if (plaintext.length !== DATA_ENC_KEY_LENGTH) {
    throw new Error(`Invalid decrypted dataEncKey length: expected ${DATA_ENC_KEY_LENGTH}, got ${plaintext.length}`);
  }

  return bytes32ToField(Uint8Array.from(plaintext));
}