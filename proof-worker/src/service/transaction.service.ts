import { generateProof } from "../proof/proof.service.js";
import { transactionRepository } from "../repositories/transaction.repository.js"
import { encryptContent, type ContentEncryptionResult } from "../crypto/encryption.js";

export interface CreateContentRegistrationProofInput {
    jobId: string;
    registrationId: number;
    originalText: string;
    authorPkOwn: string;
}

export interface ContentRegistrationProofResult {
    proof: string;
    publicSignals: string[];
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