import { buildBabyjub } from 'circomlibjs';

let babyjubPromise = null;

export function getBabyJub() {
  if (!babyjubPromise) babyjubPromise = buildBabyjub();
  return babyjubPromise;
}

// pk_enc = sk_enc * G (BabyJubjub base point). scalar is a bigint.
// Returns the point as [x, y] bigints (Montgomery form), matching circomlibjs Base8.
export async function scalarMulBase(scalar) {
  const babyJub = await getBabyJub();
  const F = babyJub.F;
  const point = babyJub.mulPointEscalar(babyJub.Base8, scalar);
  return [BigInt(F.toString(point[0])), BigInt(F.toString(point[1]))];
}
