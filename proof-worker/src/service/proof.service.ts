import { generateProofForContentRegistration, generateProofForTradeApprove } from "../proof/proof.service.js";
import { transactionRepository } from "../repositories/transaction.repository.js"
import { encryptContent, type ContentEncryptionResult } from "../crypto/content-encryption.js";
import { withDbRetry, withGrpcRetry } from "../utils/retry.js";
import type { ProofRequestedMessage } from "../kafka/types.js";
import { getContentRegistrationSource, getTradeApproval } from "../grpc/market.client.js";
import { Market } from "@content-trade/grpc-contract";
import { PublicKeyEncryption, type PublicCiphertext } from "../crypto/encryption.js";
import { poseidonHash, parseFieldElement } from "../crypto/poseidon.js";


/////////////////////////////
// content registration
/////////////////////////////

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
    const proof = await generateProofForContentRegistration(encrypted.result);
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

export async function saveContentRegistrationWithRetry(
    input: {
        jobId: string;
        registrationId: number;
        result: ContentRegistrationProofResult;
    },
): Promise<void> {
    await withDbRetry(
        () =>
            saveContentRegistration(input),
        {
            operationName: `saveContentRegistration:${input.jobId}`,
        },
    );
}

export async function saveContentRegistration(
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

/////////////////////////////
// trade approve
/////////////////////////////

export interface DecryptedTradeOrder {
    pk_own_auth: bigint;
    r_cm: bigint;
    fee_svr: bigint;
    fee_auth: bigint;
    h_k: bigint;
    pk_enc_cons: [bigint, bigint];
}

export interface TradeApproveProofResult {
    proof: string;
    publicSignals: string;
}

export interface TradeApproveProofInput {
    jobId: string;
    buyHistoryId: number;
    cmAuth: string;
    cmSvr: string;
    pkOwnSvr: bigint;
    decrypted: DecryptedTradeOrder;
    dataEncKey: bigint;
}

export async function findTradeApprovalByPurchaseIdWithRetry(
    purchaseId: number,
) {
    return withDbRetry(
        () => transactionRepository.findTradeApprovalByPurchaseId(purchaseId),
        { operationName: `findTradeApprovalByPurchaseId:${purchaseId}` },
    );
}

export async function claimTradeApprovalWithRetry(
    purchaseId: number,
    jobId: string,
): Promise<boolean> {
    return withDbRetry(
        () => transactionRepository.claimTradeApproval(purchaseId, jobId),
        { operationName: `claimTradeApproval:${jobId}` },
    );
}

export async function decryptTradeOrder(
    c: PublicCiphertext,
    skEncSvr: bigint,
): Promise<DecryptedTradeOrder> {
    const pubEnc = await PublicKeyEncryption.create();

    const decrypted = pubEnc.Dec(
        c,
        skEncSvr,
    );

    return {
        pk_own_auth: decrypted[0],
        r_cm: decrypted[1],
        fee_auth: decrypted[2],
        fee_svr: decrypted[3],
        h_k: decrypted[4],
        pk_enc_cons: [decrypted[5], decrypted[6]]
    };
}

export async function getTradeApprovalWithRetry(
    purchaseId: number,
    jobId: string,
): Promise<Market.GetTradeApprovalResponse> {
    return withGrpcRetry(
        () => getTradeApproval(purchaseId, jobId),
        {
            operationName: `getTradeApproval:${purchaseId}:${jobId}`,
        },
    );
}

export function verifyTradeOrder(
    input: {
        decrypted: DecryptedTradeOrder;
        cmSvr: string;
        cmAuth: string;
        hK: string;
        price: bigint;
        pkEncCons: string;
        pkOwnSvr: bigint;
        pkOwnAuth: bigint;
    },
): { success: boolean; reason?: string } {
    // 1. h_k 검증: 복호화된 h_k === 콘텐츠 h_k
    const contentHK = BigInt(input.hK);
    if (input.decrypted.h_k !== contentHK) {
        return { success: false, reason: "h_k mismatch" };
    }

    if (input.price !== input.decrypted.fee_auth + input.decrypted.fee_svr) {
        return { success: false, reason: "price mismatch" };
    }

    // pkEncCons(x||y hex) 파싱
    const pkEncHex = input.pkEncCons.startsWith("0x")
        ? input.pkEncCons.slice(2)
        : input.pkEncCons;
    const pkEncConsX = BigInt("0x" + pkEncHex.slice(0, 64));
    const pkEncConsY = BigInt("0x" + pkEncHex.slice(64, 128));

    // 2. cm_svr 검증
    const cmSvr = poseidonHash([
        input.pkOwnSvr,
        input.decrypted.r_cm,
        input.decrypted.fee_svr,
        contentHK,
        pkEncConsX,
        pkEncConsY,
    ]);
    if (cmSvr !== BigInt(input.cmSvr)) {
        return { success: false, reason: "cm_svr mismatch" };
    }

    // 3. cm_auth 검증
    const cmAuth = poseidonHash([
        input.pkOwnAuth,
        input.decrypted.r_cm,
        input.decrypted.fee_auth,
        contentHK,
        pkEncConsX,
        pkEncConsY,
    ]);
    if (cmAuth !== BigInt(input.cmAuth)) {
        return { success: false, reason: "cm_auth mismatch" };
    }

    return { success: true };
}

export async function createTradeApproveProof(
    input: TradeApproveProofInput,
): Promise<
    | {
        success: true;
        result: TradeApproveProofResult;
    }
    | {
        success: false;
        reason: string;
    }
> {
    const encryptStart = performance.now();

    // 1. data enc key 암호화
    const pubEnc = await PublicKeyEncryption.create();
    const cipher = pubEnc.Enc(input.decrypted.pk_enc_cons, input.dataEncKey);

    const encryptDuration = performance.now() - encryptStart;
    console.info(
        `[proof-worker] step=encryptKey durationMs=${encryptDuration.toFixed(2)}`,
    );

    const proofStart = performance.now();
    const proof = await generateProofForTradeApprove({
        cmAuth: input.cmAuth,
        cmSvr: input.cmSvr,
        pkOwnSvr:  input.pkOwnSvr,
        order: input.decrypted,
        cipher,
        dataEncKey: input.dataEncKey
    });
    if (!proof.success) {
        return proof;
    }

    const proofDuration = performance.now() - proofStart;
    console.info(
        `[proof-worker] step=generateProof status=${proof.success ? "completed" : "failed"} durationMs=${proofDuration.toFixed(2)} proofType=TRADE_APPROVE`,
    );

    return {
        success: true,
        result: proof.result
    };
}

export async function saveTradeApprovalWithRetry(
    input: {
        purchaseId: number;
        jobId: string;
        proof: string;
        publicSignals: string;
    },
): Promise<void> {
    await withDbRetry(
        () =>
            saveTradeApproval(input),
        {
            operationName: `saveTradeApproval:${input.jobId}`,
        },
    );
}

export async function saveTradeApproval(
    input: {
        purchaseId: number;
        jobId: string;
        proof: string;
        publicSignals: string;
    },
): Promise<void> {
    await transactionRepository.saveTradeApprovalWithOutbox({
        purchaseId: input.purchaseId,
        jobId: input.jobId,
        proof: input.proof,
        publicSignals: input.publicSignals,
    });
}

/////////////////////////////
// common
/////////////////////////////

export async function failJobOutboxWithRetry(
    job: ProofRequestedMessage,
    reason: string,
): Promise<void> {
    await withDbRetry(
        () => transactionRepository.createFailureWithOutbox(
            job, reason),
        {
            operationName: `failJob:${job.jobId}`,
        },
    );
}