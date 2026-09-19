import { isError } from "ethers";

export function getErrorReason(error: unknown): string {
    if (isError(error, "CALL_EXCEPTION")) {
        return (
            error.reason ??
            error.shortMessage ??
            error.message
        );
    }

    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}

type EthersError = Error & {
  code: string;
};

export function isRetryableRpcError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const ethersError = error as EthersError;

  switch (ethersError.code) {
    case "NETWORK_ERROR":
    case "TIMEOUT":
    case "SERVER_ERROR":
      return true;

    default:
      return false;
  }
}