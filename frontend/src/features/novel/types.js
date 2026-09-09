// 소설(novel) API request/response 타입 정의 (JSDoc).
// Backend 응답 구조가 확정되면 이 파일만 수정하면 된다.

/**
 * 소설 등록 요청 body
 * @typedef {Object} CreateNovelRequest
 * @property {string} title       제목
 * @property {string} description 간략 소개
 * @property {string} content     본문
 * @property {number} price       가격
 */

/**
 * 소설 목록 항목
 * @typedef {Object} NovelListItem
 * @property {number} id
 * @property {string} title
 * @property {string} description
 * @property {string} author      작가(username)
 * @property {number} price
 */

/**
 * 소설 목록 응답
 * @typedef {Object} NovelListResponse
 * @property {NovelListItem[]} items
 * @property {number} page
 * @property {number} size
 * @property {number} total
 */


/**
 * 내 등록 요청 항목 (ContentRegistration)
 * @typedef {Object} MyRegistrationItem
 * @property {number} id
 * @property {string} title
 * @property {number} price
 * @property {'PENDING'|'PROCESSING'|'APPROVED'|'REJECTED'} status  등록 처리 상태
 * @property {string|null} rejectionReason
 * @property {number|null} contentId  승인 후 연결된 ContentList id
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * 내 등록 요청 목록 응답
 * @typedef {Object} MyRegistrationListResponse
 * @property {MyRegistrationItem[]} items
 * @property {number} page
 * @property {number} size
 * @property {number} total
 */
export {};
