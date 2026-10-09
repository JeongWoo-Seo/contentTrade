import { generateProof } from "../proof/proof.service.js";
import { transactionRepository } from "../repositories/transaction.repository.js"
import { encryptContent, type ContentEncryptionResult } from "../crypto/encryption.js";
import { withDbRetry, withGrpcRetry } from "../utils/retry.js";
import { outboxRepository } from "../repositories/outbox.repository.js";
import type { ProofRequestedMessage } from "../kafka/types.js";
import { getContentRegistrationSource } from "../grpc/market.client.js";
import { Market } from "@content-trade/grpc-contract";

export interface CreateContentRegistrationProofInput {
    jobId: string;
    registrationId: number;
    originalText: string;
    authorPkOwn: string;
}

export interface ContentRegistrationProofResult {
    proof: string;
    publicSignals: string;
    encryption: ContentEncryptionResult;
}

export async function createContentRegistrationProof(
    input: CreateContentRegistrationProofInput,
): Promise<
    | {
        success: true;
        result: ContentRegistrationProofResult;
    }
    | {
        success: false;
        reason: string;
    }
> {
    // 1. 콘텐츠 암호화
    const encrypted = encryptContent(input.originalText, input.authorPkOwn);
    if (!encrypted.success) {
        return encrypted;
    }

    // 2. ZK Proof 생성
    const proof = await generateProof({
        proofType: "CONTENT_REGISTRATION",
        originalText: input.originalText,
        encryption: encrypted.result,
    });
    if (!proof.success) {
        return proof;
    }

    return {
        success: true,
        result: {
            proof: proof.result.proof,
            publicSignals: proof.result.publicSignals,
            encryption: encrypted.result,
        },
    };
}

export async function saveContentRegistrationTransactionWithRetry(
  input: {
    jobId: string;
    registrationId: number;
    result: ContentRegistrationProofResult;
  },
): Promise<void> {
  await withDbRetry(
    () =>
      saveContentRegistrationTransaction(input),
    {
      operationName: `saveContentRegistrationTransaction:${input.jobId}`,
    },
  );
}

export async function saveContentRegistrationTransaction(
    input: {
        jobId: string;
        registrationId: number;
        result: ContentRegistrationProofResult;
    },
): Promise<void> {
    await transactionRepository.createContentRegistrationWithOutbox({
        jobId: input.jobId,
        registrationId: input.registrationId,
        ContentRegistrationProof: input.result,
    });
}

export async function findContentRegistrationByJobIdWithRetry(
    jobId: string,
) {
    return withDbRetry(
        () => transactionRepository.findContentRegistrationByJobId(jobId),
        {
            operationName: `findContentRegistrationByJobId:${jobId}`,
        },
    );
}

export async function failJubOutboxWithRetry(
    job: ProofRequestedMessage,
    reason: string,
): Promise<void> {
    await withDbRetry(
        () => failJubOutbox(job, reason),
        {
            operationName: `failJob:${job.jobId}`,
        },
    );
}

async function failJubOutbox(
    job: ProofRequestedMessage,
    reason: string,
): Promise<void> {
    if (job.proofType === "CONTENT_REGISTRATION") {
        await outboxRepository.create({
            jobId: job.jobId,
            jobType: job.proofType,
            eventType: "PROOF_FAILED",
            failReason: reason,
            registrationId: job.registrationId,
        });

        return;
    }

    await outboxRepository.create({
        jobId: job.jobId,
        jobType: job.proofType,
        eventType: "PROOF_FAILED",
        failReason: reason,
        purchaseId: job.purchaseId,
    })
}

export async function getContentRegistrationSourceWithRetry(
    registrationId: number,
    jobId: string,
): Promise<Market.GetContentRegistrationResponse> {
    return withGrpcRetry(
        () => getContentRegistrationSource(registrationId, jobId),
        {
            operationName: `getContentRegistrationSource:${registrationId}:${jobId}`,
        },
    );
}