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
    const encryptStart = performance.now();

    // 1. 콘텐츠 암호화
    const encrypted = encryptContent(input.originalText, input.authorPkOwn);
    if (!encrypted.success) {
        return encrypted;
    }

    const encryptDuration = performance.now() - encryptStart;
    console.info(
        `[proof-worker] step=encryptContent status=${encrypted.success ? "completed" : "failed"} durationMs=${encryptDuration.toFixed(2)}`,
    );

    const proofStart = performance.now();
    // 2. ZK Proof 생성
    const proof = await generateProof({
        proofType: "CONTENT_REGISTRATION",
        originalText: input.originalText,
        encryption: encrypted.result,
    });
    if (!proof.success) {
        return proof;
    }

    const proofDuration = performance.now() - proofStart;
    console.info(
        `[proof-worker] step=generateProof status=${proof.success ? "completed" : "failed"} durationMs=${proofDuration.toFixed(2)} proofType=CONTENT_REGISTRATION`,
    );

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

export async function failJobOutboxWithRetry(
    job: ProofRequestedMessage,
    reason: string,
): Promise<void> {
    await withDbRetry(
        () => transactionRepository.createFailureWithOutbox(
          job,reason),
        {
            operationName: `failJob:${job.jobId}`,
        },
    );
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