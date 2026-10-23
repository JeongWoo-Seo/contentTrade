import { buildPoseidon } from 'circomlibjs';

let poseidonPromise: ReturnType<typeof buildPoseidon> | null = null;

// circomlibjs builds Poseidon over BN254; the (async, WASM) construction is memoized.
export function getPoseidon(): ReturnType<typeof buildPoseidon> {
  if (!poseidonPromise) poseidonPromise = buildPoseidon();
  return poseidonPromise;
}

// Hash an array of bigints, returning a bigint (< FIELD_PRIME).
export async function poseidonHash(values: bigint[]): Promise<bigint> {
  const poseidon = await getPoseidon();
  const F = poseidon.F;
  const elements = values.map((v) => F.e(v));
  const out = poseidon(elements);
  return BigInt(F.toString(out));
}
