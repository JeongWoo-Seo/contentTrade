import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAccountBalanceUpdate } from '../src/utils/crypto/balance';
import { SymmetricKeyEncryption } from '../src/utils/crypto/encryption';

// skEnc: 임의의 유효한 private key (BN254 field range 내)
const SK_ENC = '1';

function toEna(ciphertext: { r: string; ct: string }) {
  return { r: BigInt(`0x${ciphertext.r}`), ct: BigInt(`0x${ciphertext.ct}`) };
}

test('차감 후 재암호화: oldEna는 원본 그대로, newEna는 balance - price', async () => {
  const encryption = await SymmetricKeyEncryption.create(SK_ENC, 1);

  const balance = 5000n;
  const price = 1200n;

  const encrypted = encryption.Enc(balance);
  const ena = toEna(encrypted);

  const result = await computeAccountBalanceUpdate(SK_ENC, ena, price);

  // oldEna: 원본 암호문 그대로 유지
  assert.equal(result.oldEna, JSON.stringify(encrypted));

  // newEna: 복호화하면 balance - price
  const newCiphertext = JSON.parse(result.newEna) as { r: string; ct: string };
  const newBalanceHex = encryption.Dec(newCiphertext);
  assert.equal(BigInt(`0x${newBalanceHex}`), balance - price);
});

test('잔액 부족 시 오류를 던진다', async () => {
  const encryption = await SymmetricKeyEncryption.create(SK_ENC, 1);

  const balance = 100n;
  const price = 200n;

  const encrypted = encryption.Enc(balance);
  const ena = toEna(encrypted);

  await assert.rejects(
    () => computeAccountBalanceUpdate(SK_ENC, ena, price),
    /잔액이 부족합니다/,
  );
});

test('정확히 잔액과 같은 가격이면 newEna는 0이 된다', async () => {
  const encryption = await SymmetricKeyEncryption.create(SK_ENC, 1);

  const balance = 3000n;
  const price = 3000n;

  const encrypted = encryption.Enc(balance);
  const ena = toEna(encrypted);

  const result = await computeAccountBalanceUpdate(SK_ENC, ena, price);

  const newCiphertext = JSON.parse(result.newEna) as { r: string; ct: string };
  const newBalanceHex = encryption.Dec(newCiphertext);
  assert.equal(BigInt(`0x${newBalanceHex}`), 0n);
});
