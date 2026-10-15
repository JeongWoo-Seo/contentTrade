
import assert from "node:assert/strict";
import { PublicKeyEncryption } from "./encryption.js";

console.log("test.ts started");

async function main(): Promise<void> {
    const encryption = await PublicKeyEncryption.create();

    // 1. 키 쌍 생성
    const user = encryption.generateKeyPair();

    console.log("Private key:", user.privKey);
    console.log("Public key:", user.pubKey);

    // 2. 평문 준비 (16진수 문자열)
    const messages = [
        "48656c6c6f",
        "576f726c64",
        "1234",
    ];

    // 3. 암호화
    const ciphertext = encryption.Enc(
        user.pubKey,
        ...messages,
    );

    console.log("\nCiphertext:");
    console.log(JSON.stringify(ciphertext, null, 2));

    // 4. 복호화
    const decrypted = encryption.Dec(
        ciphertext,
        user.privKey,
    );

    console.log("\nDecrypted:");
    console.log(decrypted);

    // 5. 결과 검증
    assert.deepEqual(decrypted, messages);

    console.log("\nEncryption/decryption test passed!");
}

main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});