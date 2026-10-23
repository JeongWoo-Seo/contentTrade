// circomlibjs는 자체 타입 정의를 제공하지 않으므로 최소 타입을 선언한다.
// 실제 사용처(poseidon/ecc/encryption)에서 쓰는 메서드만 포함한다.
declare module "circomlibjs" {
  export type FieldElement = bigint;

  export interface Field {
    p?: bigint;
    e(value: bigint | number | string): FieldElement;
    toString(value: FieldElement): string;
    toObject(value: FieldElement): unknown;
  }

  export interface Poseidon {
    F: Field;
    (inputs: FieldElement[]): FieldElement;
  }

  export type Point = FieldElement[];

  export interface BabyJub {
    F: Field & { p: bigint };
    subOrder: bigint;
    Base8: Point;
    mulPointEscalar(point: Point, scalar: bigint): Point;
  }

  export function buildPoseidon(): Promise<Poseidon>;
  export function buildBabyjub(): Promise<BabyJub>;
}
