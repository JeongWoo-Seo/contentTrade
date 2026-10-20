import { buildPoseidon } from 'circomlibjs';

let poseidonPromise = null;

// circomlibjs builds Poseidon over BN254; the (async, WASM) construction is memoized.
export function getPoseidon() {
  if (!poseidonPromise) poseidonPromise = buildPoseidon();
  return poseidonPromise;
}

// Hash an array of bigints, returning a bigint (< FIELD_PRIME).
export async function poseidonHash(values) {
  const poseidon = await getPoseidon();
  const F = poseidon.F;
  const elements = values.map((v) => F.e(v));
  const out = poseidon(elements);
  return BigInt(F.toString(out));
}
