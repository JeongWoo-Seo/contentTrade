import { SymmetricKeyEncryption } from './encryption';

// 스마트 컨트랙트의 ENA(struct {r, ct})에 대응하는 암호화 잔액.
export interface Ena {
  r: bigint;
  ct: bigint;
}

// 콘텐츠 구매 시 계좌 잔액 차감 결과.
export interface AccountBalanceUpdate {
  oldEna: Ena; // 기존 암호화 잔액 (원본 암호문 그대로)
  newEna: Ena; // 구매 금액 차감 후 재암호화한 잔액
}

/**
 * 기존 ENA를 skEnc로 복호화해 price를 차감한 뒤, 기존 ENA 암호화 방식으로 재암호화한다.
 *
 * - oldEna: 기존 암호문 그대로 유지 (재직렬화하지 않음)
 * - 잔액 부족 / 복호화 실패 시 오류를 던진다.
 * - 금액 계산은 BigInt 정수 기반으로 처리한다.
 */
export async function computeAccountBalanceUpdate(
  kENA: string,
  ena: Ena,
  price: bigint,
): Promise<AccountBalanceUpdate> {
  // 기존 ENA 암호화 모듈 재사용 (dataMaxBlockNum=1: 단일 잔액 값)
  const kENABigInt = BigInt(`0x${kENA}`);
  const encryption = await SymmetricKeyEncryption.create(kENABigInt, 1);

  // 복호화: balance = Dec(ENA)
  const balance = encryption.Dec(ena);

  if (balance < price) {
    throw new Error('잔액이 부족합니다.');
  }

  const newBalance = balance - price;

  // 기존 ENA 암호화 방식으로 재암호화
  const newEna = encryption.Enc(newBalance);

  return { oldEna:ena, newEna };
}
