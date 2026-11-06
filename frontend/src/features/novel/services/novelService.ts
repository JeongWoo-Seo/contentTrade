import { authFetch } from '../../auth/services/authService';
import { poseidonHash } from '../../../utils/crypto/poseidon';
import { PublicKeyEncryption } from '../../../utils/crypto/encryption';
import { fromHex, fromDecimal, randomFieldElement } from '../../../utils/crypto/util';
import type {
  CreateNovelRequest,
  NovelListResponse,
  MyRegistrationListResponse,
  TradeInfo,
  MyRegistrationItem,
} from '../types';
import { FIELD_PRIME } from '../../../utils/crypto/constants';

interface ApiErrorResponse {
  error?: string;
  message?: string;
}

async function parseError(res: Response): Promise<ApiErrorResponse> {
  return res.json().catch(() => ({})) as Promise<ApiErrorResponse>;
}

// 소설 등록
export async function createNovel(payload: CreateNovelRequest): Promise<MyRegistrationItem> {
  const res = await authFetch('/api/novels', { method: 'POST', body: payload });

  if (!res.ok) {
    const data = await parseError(res);
    throw new Error(data?.message || data?.error || '소설 등록에 실패했습니다.');
  }
  return res.json() as Promise<MyRegistrationItem>;
}

// 소설 목록 조회 (페이지네이션)
export async function listNovels({ page = 1, size = 20 }: { page?: number; size?: number } = {}): Promise<NovelListResponse> {
  const res = await authFetch(`/api/novels?page=${page}&size=${size}`);

  if (!res.ok) {
    throw new Error('소설 목록을 불러오지 못했습니다.');
  }
  return res.json() as Promise<NovelListResponse>;
}

// 내가 등록한 소설(등록 요청) 목록 조회. authorId는 전달하지 않고
// 서버가 JWT에서 로그인 사용자를 식별한다.
export async function getMyRegistrations({ page = 1, size = 20 }: { page?: number; size?: number } = {}): Promise<MyRegistrationListResponse> {
  const res = await authFetch(`/api/novels/mine?page=${page}&size=${size}`);

  if (!res.ok) {
    throw new Error('소설 목록을 불러오지 못했습니다.');
  }
  return res.json() as Promise<MyRegistrationListResponse>;
}

// 소설 거래 정보 조회 (h_ct, ct_data, 작가 pk_own, price, 서버 pk_enc/pk_own, h_k).
// 거래 불가(ACTIVE 아님) 또는 미존재 시 서버가 오류를 반환한다.
export async function getTradeInfo(id: number): Promise<TradeInfo> {
  const res = await authFetch(`/api/novels/${id}/trade`);

  if (!res.ok) {
    const data = await parseError(res);
    throw new Error(data?.message || data?.error || '거래 정보를 불러오지 못했습니다.');
  }
  return res.json() as Promise<TradeInfo>;
}

export async function createPurchaseOrder(
  input: {
    pk_enc_cons_x: string;
    pk_enc_cons_y: string;
    pk_own_cons: string;
    pk_enc_svr_x: string;
    pk_enc_svr_y: string;
    pk_own_svr: string;
    pk_own_auth: string;
    h_k: string;
    price: bigint;
  }
) {
  const {
    pk_enc_cons_x,
    pk_enc_cons_y,
    pk_own_cons,
    pk_enc_svr_x,
    pk_enc_svr_y,
    pk_own_svr,
    pk_own_auth,
    h_k,
    price,
  } = input;

  if (price < 1n || price >= FIELD_PRIME) {
    throw new Error("Invalid price");
  }

  const fee_svr = 1n;
  const fee_auth = price - fee_svr;

  const r = randomFieldElement();

  const cm_svr = await poseidonHash(
    [fromHex(pk_own_svr),
      r,
      fee_svr,
      fromDecimal(h_k),
      fromHex(pk_enc_cons_x),
      fromHex(pk_enc_cons_y)
    ]
  );

  const cm_auth = await poseidonHash(
    [fromHex(pk_own_auth),
      r,
      fee_auth,
      fromDecimal(h_k),
      fromHex(pk_enc_cons_x),
      fromHex(pk_enc_cons_y)
    ]
  );

  // pk_enc_svr로 암호화
  const pubEnc = await PublicKeyEncryption.create()
  const encrypted = pubEnc.Enc(
    [fromHex(pk_enc_svr_x), fromHex(pk_enc_svr_y)],
    fromHex(pk_own_cons),
    r,
    fee_svr,
    fee_auth,
    fromDecimal(h_k),
  );

  return {
    fee_svr,
    fee_auth,
    r,

    cm_svr,
    cm_auth,

    r_enc: encrypted.r_enc,
    c0: encrypted.c0,
    c1: encrypted.c1,
  };
}