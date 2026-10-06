import grpc from "@grpc/grpc-js";
import { Market } from "@content-trade/grpc-contract";
import { novelService } from "../services/novel.service.js"


export function createGrpcServer() {
    const server = new grpc.Server();

    server.addService(
        Market.MarketServiceService,
        {
            getContentRegistration: async (
                call: any,
                callback: any
            ) => {
                try {
                    const { registration_id, job_id } = call.request;

                    console.log(
                        `GetContentRegistration`,
                        `registrationId=${registration_id}`,
                        `jobId=${job_id}`
                    );

                    const registration = await novelService.getRegistrationSource(registration_id);
                    if (!registration) {
                        return callback({
                            code: grpc.status.FAILED_PRECONDITION,
                            message: "Content registration source not found",
                        });
                    }

                    return callback(null, {
                        registrationId: registration.registrationId,
                        originalText: registration.originalText,
                        authorPkOwn: registration.authorPkOwn
                    });

                } catch (error) {
                    console.error(error);

                    return callback({
                        code: grpc.status.INTERNAL,
                        message: "Internal server error",
                    });
                }
            },

            completeContentRegistration: async (
                call: { request: Market.CompleteContentRegistrationRequest },
                callback: any
            ) => {
                try {
                    const {
                        jobId,
                        registrationId,
                        encryptedData,
                        encryptedDataKey,
                        ctR,
                        encryptionVersion,
                        hK,
                        hData,
                        hCt,
                        txHash,
                    } = call.request;

                    console.log(
                        `CompleteContentRegistration`,
                        `jobId=${jobId}`,
                        `registrationId=${registrationId}`
                    );

                    await novelService.completeRegistration({
                        registrationId,
                        encryptedData,
                        encryptedDataKey,
                        ctR,
                        encryptionVersion,
                        hK,
                        hData,
                        hCt,
                        txHash
                    });

                    return callback(null, {
                        success: true,
                        message: "Content registration completed",
                    });

                } catch (error) {
                    console.error(error);

                    return callback({
                        code: grpc.status.INTERNAL,
                        message: error instanceof Error ? error.message : "Internal server error",
                    });
                }
            },
        }
    );

    return server;
}