import { contentRegistrationRepository, contentRegistrationSourceRepository } from "../repositories/content-registration.repository.js";
import { contentListRepository } from "../repositories/content-list.repository.js";
import { buyHistoryRepository } from "../repositories/buy-history.repository.js";
import { ApiError } from "../utils/errors.js";
import crypto from "node:crypto";
import { withDbRetry } from "../utils/retry.js";
import { env } from "../config/env.js";


const MAX_TITLE_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 200;
const MAX_CONTENT_LENGTH = 5000;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

interface RegisterNovelInput {
  title: unknown;
  description: unknown;
  content: unknown;
  price: unknown;
}

function parsePagination(pageRaw: unknown, sizeRaw: unknown) {
  const page = pageRaw === undefined || pageRaw === null || pageRaw === "" ? 1 : Number(pageRaw);
  const size = sizeRaw === undefined || sizeRaw === null || sizeRaw === "" ? DEFAULT_PAGE_SIZE : Number(sizeRaw);

  if (!Number.isInteger(page) || page < 1) {
    throw new ApiError(400, "VALIDATION_ERROR", "page must be a positive integer");
  }
  if (!Number.isInteger(size) || size < 1 || size > MAX_PAGE_SIZE) {
    throw new ApiError(400, "VALIDATION_ERROR", `size must be between 1 and ${MAX_PAGE_SIZE}`);
  }

  return { page, size, skip: (page - 1) * size, take: size };
}

export const novelService = {
  async registerNovel(userId: number, { title, description, content, price }: RegisterNovelInput) {
    const trimmedTitle = typeof title === "string" ? title.trim() : "";
    const trimmedDescription = typeof description === "string" ? description.trim() : "";

    if (!trimmedTitle) throw new ApiError(400, "VALIDATION_ERROR", "title is required");
    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      throw new ApiError(400, "VALIDATION_ERROR", `title must be at most ${MAX_TITLE_LENGTH} characters`);
    }
    if (!trimmedDescription) throw new ApiError(400, "VALIDATION_ERROR", "description is required");
    if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH) {
      throw new ApiError(400, "VALIDATION_ERROR", `description must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
    }
    if (typeof content !== "string" || !content.trim()) {
      throw new ApiError(400, "VALIDATION_ERROR", "content is required");
    }
    if (Array.from(content).length > MAX_CONTENT_LENGTH) {
      throw new ApiError(400, "VALIDATION_ERROR", `content must be at most ${MAX_CONTENT_LENGTH} characters`);
    }
    if (typeof price !== "number" || !Number.isInteger(price) || price < 0) {
      throw new ApiError(400, "VALIDATION_ERROR", "price must be a non-negative integer");
    }

    // jobId 생성 (Outbox / Kafka / 이후 proof/blockchain 작업에서 공유)
    const jobId = crypto.randomUUID();

    // DB transaction: ContentRegistration + Source + Outbox 생성 (전체를 retry)
    const registration = await withDbRetry(
      () =>
        contentRegistrationRepository.createWithSource({
          jobId,
          title: trimmedTitle,
          description: trimmedDescription,
          authorId: userId,
          price,
          originalText: content,
        }),
      { operationName: `registerNovel:${jobId}` },
    );

    return {
      id: registration.id,
      title: registration.title,
      price: registration.price.toNumber(),
      status: registration.status,
      rejectionReason: registration.rejectionReason,
      contentId: registration.contentId,
      createdAt: registration.createdAt,
      updatedAt: registration.updatedAt,
    };
  },

  async failedRegistration({
    registrationId,
    reason,
  }: {
    registrationId: number,
    reason: string
  }) {
    return contentRegistrationRepository.failedRegistration({
      registrationId,
      reason
    });
  },

  async completeRegistration({
    registrationId,
    encryptedData,
    encryptedDataKey,
    ctR,
    encryptionVersion,
    hK,
    hData,
    hCt,
    txHash
  }: {
    registrationId: number;
    encryptedData: Uint8Array;
    encryptedDataKey: Uint8Array;
    ctR: string;
    encryptionVersion: number;
    hK: string;
    hData: string;
    hCt: string;
    txHash: string;
  }) {
    return contentRegistrationRepository.completeRegistration({
      registrationId,
      encryptedData,
      encryptedDataKey,
      ctR,
      encryptionVersion,
      hK,
      hData,
      hCt,
      txHash,
    });
  },

  // 등록 완료(승인)된 소설 목록: ContentList + 작가 이름.
  async listNovels(pageRaw: unknown, sizeRaw: unknown) {
    const { page, size, skip, take } = parsePagination(pageRaw, sizeRaw);
    const { items, total } = await contentListRepository.findManyWithAuthor(skip, take);

    return {
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        author: item.author.username,
        price: item.price.toNumber(),
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      page,
      size,
      total,
    };
  },

  // 내 등록 요청 목록: ContentRegistration
  async listMyRegistrations(userId: number, pageRaw: unknown, sizeRaw: unknown) {
    const { page, size, skip, take } = parsePagination(pageRaw, sizeRaw);
    const { items, total } = await contentRegistrationRepository.findManyByAuthor(userId, skip, take);

    return {
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        price: item.price.toNumber(),
        status: item.status,
        rejectionReason: item.rejectionReason,
        contentId: item.contentId,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      page,
      size,
      total,
    };
  },

  async getRegistrationSource(registrationId: number) {
    const source = await contentRegistrationSourceRepository.findByRegistrationId(registrationId);

    if (!source) {
      throw new Error(`Content registration source not found: ${registrationId}`);
    }

    return {
      registrationId: source.registration.id,
      originalText: source.originalText,
      authorPkOwn: source.registration.author.pkOwn,
    };
  },

  async getTradeInfo(userId: number, contentId: number) {
    if (!Number.isInteger(contentId) || contentId < 1) {
      throw new ApiError(404, "NOT_FOUND", "존재하지 않는 소설입니다.");
    }

    const content = await contentListRepository.findByIdWithAuthor(contentId);
    if (!content) {
      throw new ApiError(404, "NOT_FOUND", "존재하지 않는 소설입니다.");
    }

    // 이미 구매를 요청(REQUESTED)했거나 진행 중(PENDING)/완료(APPROVED)인 경우
    // 재구매를 막기 위해 구매 여부를 응답에 포함한다. REJECTED는 재구매 가능.
    const purchase = await buyHistoryRepository.findByBuyerAndContent(userId, contentId);
    const alreadyPurchased = purchase !== null && purchase.status !== "REJECTED";

    // 거래 상태 검증: ACTIVE(판매 중)만 거래 가능.
    // 단, 이미 구매한 사용자는 판매 상태와 무관하게 콘텐츠를 열람할 수 있다.
    if (!alreadyPurchased && content.status !== "ACTIVE") {
      throw new ApiError(409, "CONTENT_NOT_AVAILABLE", "거래할 수 없는 소설입니다.");
    }

    return {
      hCt: content.hCt,
      ctData: Buffer.from(content.encryptedData).toString("hex"),
      authorPkOwn: content.author.pkOwn,
      price: content.price.toNumber(),
      hK: content.hK,
      serverPkEnc: env.pkEnc,
      serverPkOwn: env.pkOwn,
      alreadyPurchased,
    };
  },

  async purchaseContent(userId: number, contentId: number, txHash: unknown) {
    if (!Number.isInteger(contentId) || contentId < 1) {
      throw new ApiError(404, "NOT_FOUND", "존재하지 않는 소설입니다.");
    }
    if (typeof txHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      throw new ApiError(400, "VALIDATION_ERROR", "txHash 형식이 올바르지 않습니다.");
    }

    const content = await contentListRepository.findById(contentId);
    if (!content) {
      throw new ApiError(404, "NOT_FOUND", "존재하지 않는 소설입니다.");
    }

    // 거래 상태 검증: ACTIVE(판매 중)만 거래 가능.
    if (content.status !== "ACTIVE") {
      throw new ApiError(409, "CONTENT_NOT_AVAILABLE", "거래할 수 없는 소설입니다.");
    }

    // jobId 생성 (Outbox / Kafka / Receipt worker에서 공유)
    const jobId = crypto.randomUUID();

    try {
      // 구매 요청(BuyHistory) + 구매 요청 확인용 Outbox를 하나의 transaction으로 저장.
      // referenceId는 BuyHistory.id.
      await buyHistoryRepository.createWithOutbox({
        jobId,
        buyerId: userId,
        contentId,
        txHash,
      });
    } catch (error) {
      // 중복 구매 요청 (buyerId, contentId unique)
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        throw new ApiError(409, "ALREADY_PURCHASED", "이미 구매를 요청한 소설입니다.");
      }
      throw error;
    }

    return { contentId, txHash };
  },

  async getTradeApproval(tradeId: number) {
    if (!Number.isInteger(tradeId) || tradeId < 1) {
      throw new ApiError(404, "NOT_FOUND", "존재하지 않는 구매입니다.");
    }

    const buyHistory = await buyHistoryRepository.findByIdWithContentAndBuyer(tradeId);
    if (!buyHistory) {
      throw new ApiError(404, "NOT_FOUND", "존재하지 않는 구매입니다.");
    }

    return {
      encryptedDataEncKey: Buffer.from(buyHistory.content.encryptedDataKey),
      ctR: buyHistory.content.ctR,
      price: buyHistory.content.price.toNumber(),
      hK: buyHistory.content.hK,
      pkEncCons: buyHistory.buyer.pkEnc,
      pkOwnAuth: buyHistory.content.author.pkOwn
    };
  },
};
