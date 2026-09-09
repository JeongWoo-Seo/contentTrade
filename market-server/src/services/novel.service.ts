import { contentRegistrationRepository } from "../repositories/content-registration.repository.js";
import { contentListRepository } from "../repositories/content-list.repository.js";
import { ApiError } from "../utils/errors.js";

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
  // 소설 등록 요청: ContentRegistration INSERT (status=PENDING). Kafka 미구현.
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
    if (content.length > MAX_CONTENT_LENGTH) {
      throw new ApiError(400, "VALIDATION_ERROR", `content must be at most ${MAX_CONTENT_LENGTH} characters`);
    }
    if (typeof price !== "number" || !Number.isInteger(price) || price < 0) {
      throw new ApiError(400, "VALIDATION_ERROR", "price must be a non-negative integer");
    }

    const registration = await contentRegistrationRepository.create({
      title: trimmedTitle,
      description: trimmedDescription,
      authorId: userId,
      price,
    });

    // TODO: Publish CONTENT_REGISTRATION_REQUESTED event to Kafka.
    // This will be consumed by the future ZK Worker.

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

  // 내 등록 요청 목록: ContentRegistration (본인 것만).
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
};
