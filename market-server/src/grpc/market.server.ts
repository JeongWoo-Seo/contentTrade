import grpc from "@grpc/grpc-js";
import { Market } from "@content-trade/grpc-contract";
import { novelService } from "../services/novel.service.js"


export function createGrpcServer() {
    const server = new grpc.Server();

    server.addService(
        Market.MarketServiceService,
        {
            getContentRegistration: async (
                call: {request: Market.GetContentRegistrationRequest},
                callback: grpc.sendUnaryData<Market.GetContentRegistrationResponse>
            ) => {
                try {
                    const { registrationId, jobId } = call.request;

                    console.log(
                        `GetContentRegistration`,
                        `registrationId=${registrationId}`,
                        `jobId=${jobId}`
                    );

                    const registration = await novelService.getRegistrationSource(registrationId);
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
                callback: grpc.sendUnaryData<Market.CompleteContentRegistrationResponse>
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

            getTradeApproval: async (
                call: { request: Market.GetTradeApprovalRequest },
                callback: grpc.sendUnaryData<Market.GetTradeApprovalResponse>
            ) => {
                try {
                    const { jobId, tradeId } = call.request;

                    console.log(
                        `GetTradeApproval`,
                        `tradeId=${tradeId}`,
                        `jobId=${jobId}`
                    );

                    const data = await novelService.getTradeApproval(tradeId);

                    return callback(null, {
                        jobId,
                        tradeId,
                        encryptedDataEncKey: data.encryptedDataEncKey,
                        ctR: data.ctR,
                        price: data.price,
                        hK: data.hK,
                        pkEncCons: data.pkEncCons,
                        pkOwnAuth: data.pkOwnAuth
                    });

                } catch (error) {
                    console.error(error);

                    return callback({
                        code: grpc.status.INTERNAL,
                        message: error instanceof Error ? error.message : "Internal server error",
                    });
                }
            }
        },
    );

    return server;
}