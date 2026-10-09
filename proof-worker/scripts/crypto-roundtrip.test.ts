import "dotenv/config";
import { encryptContent, decryptContent } from "../src/crypto/encryption.js";
import {
  wrapDataEncKey,
  unwrapDataEncKey,
  ENCRYPTED_DATA_KEY_LENGTH,
} from "../src/crypto/key-wrapping.js";
import { parseFieldElement } from "../src/crypto/poseidon.js";
import { env } from "../src/config/env.js";

const authorPkOwn =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const masterKey = Buffer.from(env.masterKey, "base64");

function run(name: string, text: string): void {
  const enc = encryptContent(text, authorPkOwn);
  if (!enc.success) {
    throw new Error(`encrypt failed: ${enc.reason}`);
  }

  const r = enc.result;

  // witness 는 private ZK input 만 포함 (dataEncKey, data, CT_data, CT_r)
  const witnessKeys = Object.keys(r.witness).sort();
  const expectedWitnessKeys = ["CT_data", "CT_r", "data", "dataEncKey"].sort();
  if (JSON.stringify(witnessKeys) !== JSON.stringify(expectedWitnessKeys)) {
    throw new Error(`witness keys mismatch: ${JSON.stringify(witnessKeys)}`);
  }

  // publicSignals 순서 [pk_own, h_k, h_ct, h_data]
  if (r.publicSignals.length !== 4) {
    throw new Error(`publicSignals length != 4`);
  }

  // encryptedDataKey = [IV(12)][authTag(16)][ciphertext(32)] = 60 bytes
  if (r.encryptedDataKey.length !== ENCRYPTED_DATA_KEY_LENGTH) {
    throw new Error(`encryptedDataKey length != ${ENCRYPTED_DATA_KEY_LENGTH}`);
  }

  // ctR = canonical 64-char hex string
  if (r.ctR.length !== 64 || !/^[0-9a-f]{64}$/.test(r.ctR)) {
    throw new Error(`ctR is not a 64-char hex string`);
  }

  if (r.encryptionVersion !== 1) {
    throw new Error(`encryptionVersion != 1`);
  }

  // dataEncKey wrapping round-trip
  const unwrapped = unwrapDataEncKey(r.encryptedDataKey, masterKey);
  const dataEncKey = BigInt(r.witness.dataEncKey);
  if (unwrapped !== dataEncKey) {
    throw new Error(`unwrap(dataEncKey) mismatch`);
  }

  // Poseidon cipher round-trip (encryptedDataKey → dataEncKey, ctR → CT_r)
  const CT_r = parseFieldElement(r.ctR);
  const dec = decryptContent(r.encryptedData, dataEncKey, CT_r);
  const decText = dec.toString("utf8");
  if (decText !== text) {
    throw new Error(`round-trip failed: got ${JSON.stringify(decText)}`);
  }

  console.log(`[OK] ${name} (encryptedDataKey=${r.encryptedDataKey.length}B, ctR=${r.ctR.length}hex)`);
}

run("ascii-short", "hello");
run("korean", "안녕하세요 세계! ZK 암호화 테스트");
run("31-byte-boundary", "a".repeat(31));
run("leading-zero", "\x00".repeat(20) + "x");
run("max-content", "x".repeat(243));


console.log("ALL PASS");
