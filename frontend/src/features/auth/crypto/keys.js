import { poseidonHash } from './poseidon.js';
import { scalarMulBase } from './ecc.js';
import { FIELD_PRIME, SUBGROUP_ORDER, SK_OWN_BYTES } from './constants.js';
import { bytesToHex, bigintToHex64, strToField } from './util.js';

// Domain-separation tags, derived deterministically from labels (spec section 4-6):
//   pk_own = Poseidon(sk_own, DOMAIN_OWN)
//   sk_enc = Poseidon(sk_own, DOMAIN_ENC)
//   ena    = Poseidon(pk_own, pk_enc)
const DOMAIN_OWN = strToField('sk_own->pk_own');
const DOMAIN_ENC = strToField('sk_own->sk_enc');

function toField(hex) {
  return BigInt('0x' + hex) % FIELD_PRIME;
}

// BabyJubjub point [x, y] -> 128-char hex (x(64) || y(64)).
export function pointToHex([x, y]) {
  return bigintToHex64(x) + bigintToHex64(y);
}

export function pointFromHex(hex) {
  return [BigInt('0x' + hex.slice(0, 64)), BigInt('0x' + hex.slice(64, 128))];
}

// sk_own: cryptographically secure random secret (Web Crypto CSPRNG).
// Math.random()/other PRNGs are never used for key material.
export function generateSkOwn() {
  const bytes = crypto.getRandomValues(new Uint8Array(SK_OWN_BYTES));
  return bytesToHex(bytes); // 64-char hex, no 0x prefix
}

// Derive the full key set from sk_own. Returns hex strings for storage/transport.
export async function deriveAccount(skOwn) {
  const skOwnField = toField(skOwn);

  const pkOwn = await poseidonHash([skOwnField, DOMAIN_OWN]); // public identifier
  const skEncField = await poseidonHash([skOwnField, DOMAIN_ENC]); // encryption secret
  const skEncScalar = skEncField % SUBGROUP_ORDER; // reduce to valid ECC scalar
  const pkEncPoint = await scalarMulBase(skEncScalar); // pk_enc = sk_enc * G
  const addr = await poseidonHash([pkOwn, pkEncPoint[0], pkEncPoint[1]]); // account commitment

  return {
    skOwn, // secret — never leaves the browser unencrypted
    skEnc: bigintToHex64(skEncField), // secret — derived from sk_own
    pkOwn: bigintToHex64(pkOwn), // public
    pkEnc: pointToHex(pkEncPoint), // public (x||y)
    addr: bigintToHex64(addr), // public commitment
  };
}
