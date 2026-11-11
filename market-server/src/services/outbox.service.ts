import { outboxRepository } from "../repositories/outbox.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { buyHistoryRepository } from "../repositories/buy-history.repository.js";
import { sendProofRequested, sendAccountRegistration, sendPurchaseRequest } from "../kafka/producer.js";
import { withDbRetry } from "../utils/retry.js";
import type { Outbox } from "@prisma/client";
import type { ProofRequestedMessage, TradeProofRequestedMessage, AccountRegistrationMessage, PurchaseRequestMessage } from "../kafka/types.js";

/**
 * PENDING Outbox 하나를 Kafka로 publish하고 PUBLISHED 처리한다.
 * publish 실패 시 retryCount 증가 + lastError 기록 후 PENDING으로 유지한다.
 *
 * - CONTENT_REGISTRATION / TRADE_APPROVAL → PROOF_REQUESTED (proof-worker)
 * - ACCOUNT_REGISTRATION → 계좌 등록 확인 (receipt worker)
 */
export async function publishNextPendingOutbox(): Promise<boolean> {
  const outbox = await outboxRepository.findNextPending();
  if (!outbox) {
    return false;
  }

  try {
    switch (outbox.jobType) {
      case "ACCOUNT_REGISTRATION":
        await sendAccountRegistration(await buildAccountRegistrationMessage(outbox));
        break;

      case "PURCHASE_VERIFICATION":
        await sendPurchaseRequest(await buildPurchaseMessage(outbox));
        break;

      // CONTENT_REGISTRATION, TRADE_APPROVAL
      default:
        await sendProofRequested(buildProofRequestedMessage(outbox));
        break;
    }

    await withDbRetry(
      () => outboxRepository.markPublished(outbox.id),
      { operationName: `markPublished:${outbox.id}` },
    );

    console.log(`[market-server] outbox published id=${outbox.id} jobId=${outbox.jobId}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await withDbRetry(
      () => outboxRepository.markPublishFailed(outbox.id, message),
      { operationName: `markPublishFailed:${outbox.id}` },
    );

    console.error(`[market-server] outbox publish failed id=${outbox.id} jobId=${outbox.jobId}: ${message}`);
    return false;
  }
}

function buildProofRequestedMessage(outbox: Outbox): ProofRequestedMessage {
  //CONTENT_REGISTRATION
  if (outbox.jobType === "CONTENT_REGISTRATION") {
    return {
      jobId: outbox.jobId,
      jobType: "CONTENT_REGISTRATION",
      referenceId: outbox.referenceId,
      requestedAt: outbox.createdAt.toISOString(),
    };
  }

  //TRADE_APPROVAL
  return {
    jobId: outbox.jobId,
    jobType: "TRADE_APPROVAL",
    referenceId: outbox.referenceId,
    requestedAt: outbox.createdAt.toISOString(),
  };
}

/**
 * ACCOUNT_REGISTRATION Outbox → Kafka 메시지. referenceId(user.id)로
 * 사용자를 조회해 확인할 addr/txHash를 포함한다.
 * 회원이 없으면 throw → markPublishFailed(재시도)로 이어진다.
 */
export async function buildAccountRegistrationMessage(
  outbox: Outbox,
): Promise<AccountRegistrationMessage> {
  const user = await userRepository.findById(outbox.referenceId);
  if (!user) {
    throw new Error(`account registration outbox references missing user id=${outbox.referenceId}`);
  }

  return {
    jobId: outbox.jobId,
    jobType: "ACCOUNT_REGISTRATION",
    addr: user.addr,
    txHash: user.txHash,
    referenceId: user.id,
    requestedAt: outbox.createdAt.toISOString(),
  };
}

/**
 * PURCHASE_VERIFICATION Outbox → Kafka 메시지. referenceId(BuyHistory.id)로
 * 구매 이력을 조회해 확인할 txHash를 포함한다.
 * 구매 이력이 없거나 txHash가 없으면 throw → markPublishFailed(재시도)로 이어진다.
 */
export async function buildPurchaseMessage(
  outbox: Outbox,
): Promise<PurchaseRequestMessage> {
  const buyHistory = await buyHistoryRepository.findById(outbox.referenceId);
  if (!buyHistory || !buyHistory.txHash) {
    throw new Error(`purchase outbox references missing buy history or txHash id=${outbox.referenceId}`);
  }

  return {
    jobId: outbox.jobId,
    jobType: "PURCHASE_VERIFICATION",
    txHash: buyHistory.txHash,
    referenceId: buyHistory.id,
    requestedAt: outbox.createdAt.toISOString(),
  };
}
