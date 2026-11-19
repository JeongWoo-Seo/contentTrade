import { authFetch } from '../../auth/services/authService';
import type {
  CreateNovelRequest,
  NovelListResponse,
  MyRegistrationListResponse,
  TradeInfo,
  MyRegistrationItem,
} from '../types';

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

// 구매 승인 요청: contentId + txHash를 서버에 전달한다.
// 서버가 contentId의 판매 상태(ACTIVE)를 검증하고, 판매 중이 아니면 오류를 반환한다.
export async function requestPurchase(contentId: number, txHash: string): Promise<{ contentId: number; txHash: string }> {
  const res = await authFetch(`/api/novels/${contentId}/purchase`, { method: 'POST', body: { txHash } });

  if (!res.ok) {
    const data = await parseError(res);
    throw new Error(data?.message || data?.error || '구매 승인 요청에 실패했습니다.');
  }
  return res.json() as Promise<{ contentId: number; txHash: string }>;
}