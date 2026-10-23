import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { ApiError } from "../utils/errors.js";

export interface ContractDeployment {
  chainId: number;
  contentTrade: string;
  deployedAt: number;
}

// 서버 시작 시 1회 읽어 메모리에 캐시한 배포 정보.
let deployment: ContractDeployment | null = null;

export const contractService = {
  /**
   * 서버 시작 시 contract/deployments/<chainId>.json 을 1회 읽어 캐시한다.
   * 파일이 없으면 null로 두고, 이후 요청에서 CONTRACT_NOT_FOUND를 반환한다.
   */
  async load(): Promise<void> {
    const filePath = path.join(env.contractDeploymentDir, `${env.chainId}.json`);

    try {
      const raw = await readFile(filePath, "utf8");
      const data = JSON.parse(raw) as ContractDeployment;

      deployment = {
        chainId: data.chainId,
        contentTrade: data.contentTrade,
        deployedAt: data.deployedAt,
      };

      console.log(`[market-server] contract deployment loaded (chainId=${data.chainId})`);
    } catch {
      console.warn(`[market-server] contract deployment not found (chainId=${env.chainId})`);
      deployment = null;
    }
  },

  /** 시작 시 캐시한 컨트랙트 주소를 반환한다. */
  getAddresses(): ContractDeployment {
    if (!deployment) {
      throw new ApiError(
        404,
        "CONTRACT_NOT_FOUND",
        `Contract deployment not found for chainId=${env.chainId}`,
      );
    }

    return deployment;
  },
};
