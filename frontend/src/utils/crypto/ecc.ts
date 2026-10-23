import { buildBabyjub } from 'circomlibjs';

let babyjubPromise: ReturnType<typeof buildBabyjub> | null = null;

export function getBabyJub(): ReturnType<typeof buildBabyjub> {
  if (!babyjubPromise) babyjubPromise = buildBabyjub();
  return babyjubPromise;
}

// pk_enc = sk_enc * G (BabyJubjub base point). scalar is a bigint.
// Returns the point as [x, y] bigints (Montgomery form), matching circomlibjs Base8.
export async function scalarMulBase(scalar: bigint): Promise<[bigint, bigint]> {
  const babyJub = await getBabyJub();
  const F = babyJub.F;
  const point = babyJub.mulPointEscalar(babyJub.Base8, scalar);
  return [BigInt(F.toString(point[0])), BigInt(F.toString(point[1]))];
}
