import { Kafka, EachMessagePayload } from "kafkajs";
import type { JobFailedMessage } from "../types/message.js";
import { novelService } from "../services/novel.service.js";

const kafka = new Kafka({
    clientId: "market-server",
    brokers: ["localhost:9092"],
});

const consumer = kafka.consumer({
    groupId: "market-blockchain-result",
});

export async function connectFailedConsumer() {
    await consumer.connect();

    await consumer.subscribe({
        topic: "BLOCKCHAIN_FAILED",
        fromBeginning: false,
    });

    await consumer.run({
        eachMessage: async ({
            message,
        }: EachMessagePayload) => {
            if (!message.value) {
                return;
            }

            try {
                const data = JSON.parse( message.value.toString()) as JobFailedMessage;

                console.log(`[BLOCKCHAIN_FAILED] jobId=${data.jobId}`);

                await handleBlockchainFailed(data);
            } catch (error) {
                console.error("Failed to process BLOCKCHAIN_FAILED message:",error);
                throw error;
            }
        },
    });

    console.log(
        "Blockchain failed consumer connected"
    );
}

async function handleBlockchainFailed(
    message: JobFailedMessage
) {
    if (
        message.proofType === "CONTENT_REGISTRATION"
    ) {
        if (message.registrationId == null) {
            throw new Error(`registrationId is required: jobId=${message.jobId}`);
        }

        await novelService.failedRegistration({
            registrationId: message.registrationId,
            reason: message.reason,
        });

        console.log(`Registration ${message.registrationId} rejected`);
        return;
    }

    if (message.proofType === "TRADE_APPROVAL") {
        if (message.purchaseId == null) {
            throw new Error(`purchaseId is required: jobId=${message.jobId}`);
        }

        // TODO:
        // 구매 실패 처리
        // await purchaseRepository.failedPurchase(...)

        console.log(`Purchase ${message.purchaseId} failed`);

        return;
    }

    throw new Error(
        "Unknown blockchain failed message"
    );
}