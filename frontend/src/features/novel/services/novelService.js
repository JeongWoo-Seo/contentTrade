// 소설 API 클라이언트. JWT 인증은 기존 authService.authFetch를 재사용한다
// (Authorization: Bearer + 401 시 자동 refresh). 별도 인증 시스템을 만들지 않는다.
import { authFetch } from '../../auth/services/authService.js';

/**
 * 소설 등록
 * @param {import('../types.js').CreateNovelRequest} payload
 */
export async function createNovel(payload) {
  const res = await authFetch('/api/novels', { method: 'POST', body: payload });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || data?.error || '소설 등록에 실패했습니다.');
  }
  return res.json();
}

/**
 * 소설 목록 조회 (페이지네이션)
 * @param {{ page?: number, size?: number }} [params]
 * @returns {Promise<import('../types.js').NovelListResponse>}
 */
export async function listNovels({ page = 1, size = 20 } = {}) {
  const res = await authFetch(`/api/novels?page=${page}&size=${size}`);

  if (!res.ok) {
    throw new Error('소설 목록을 불러오지 못했습니다.');
  }
  return res.json();
}

/**
 * 내가 등록한 소설(등록 요청) 목록 조회. authorId는 전달하지 않고
 * 서버가 JWT에서 로그인 사용자를 식별한다.
 * @param {{ page?: number, size?: number }} [params]
 * @returns {Promise<import('../types.js').MyRegistrationListResponse>}
 */
export async function getMyRegistrations({ page = 1, size = 20 } = {}) {
  const res = await authFetch(`/api/novels/mine?page=${page}&size=${size}`);

  if (!res.ok) {
    throw new Error('소설 목록을 불러오지 못했습니다.');
  }
  return res.json();
}
