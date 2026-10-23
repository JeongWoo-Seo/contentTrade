// 소설(novel) API request/response 타입 정의.
// Backend 응답 구조가 확정되면 이 파일만 수정하면 된다.

// 소설 등록 요청 body
export interface CreateNovelRequest {
  title: string;
  description: string;
  content: string;
  price: number;
}

// 소설 목록 항목
export interface NovelListItem {
  id: number;
  title: string;
  description: string;
  author: string; // 작가(username)
  price: number;
}

// 소설 목록 응답
export interface NovelListResponse {
  items: NovelListItem[];
  page: number;
  size: number;
  total: number;
}

// 등록 처리 상태
export type RegistrationStatus = 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED';

// 내 등록 요청 항목 (ContentRegistration)
export interface MyRegistrationItem {
  id: number;
  title: string;
  price: number;
  status: RegistrationStatus;
  rejectionReason: string | null;
  contentId: number | null;
  createdAt: string;
  updatedAt: string;
}

// 내 등록 요청 목록 응답
export interface MyRegistrationListResponse {
  items: MyRegistrationItem[];
  page: number;
  size: number;
  total: number;
}

// 거래 정보 조회 응답 (GET /api/novels/:id/trade)
export interface TradeInfo {
  hCt: string;
  ctData: string;
  authorPkOwn: string;
  price: number;
  hK: string;
  serverPkEnc: string;
  serverPkOwn: string;
}
