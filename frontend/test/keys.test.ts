import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSkOwn, deriveAccount } from '../src/utils/crypto/keys';

const HEX64_RE = /^[0-9a-f]{64}$/;

test('deriveAccount: kENA가 파생되고 64자 hex 문자열이다', async () => {
  const skOwn = generateSkOwn();
  const account = await deriveAccount(skOwn);

  assert.match(account.skOwn, /^[0-9a-f]+$/);
  assert.match(account.skEnc, HEX64_RE);
  assert.match(account.kENA, HEX64_RE);
  assert.match(account.pkOwn, HEX64_RE);
  assert.match(account.pkEnc, /^[0-9a-f]{128}$/);
  assert.match(account.addr, HEX64_RE);
});

test('deriveAccount: 같은 skOwn으로 재파생하면 동일한 계정(kENA 포함)을 얻는다', async () => {
  const skOwn = generateSkOwn();
  const a = await deriveAccount(skOwn);
  const b = await deriveAccount(skOwn);

  assert.deepEqual(a, b);
});

test('deriveAccount: 서로 다른 skOwn은 다른 kENA를 만든다', async () => {
  const a = await deriveAccount(generateSkOwn());
  const b = await deriveAccount(generateSkOwn());

  assert.notEqual(a.kENA, b.kENA);
});
