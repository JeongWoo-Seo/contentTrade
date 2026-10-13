import { readFileSync } from "node:fs";
import { ethers } from "ethers";
import type { InterfaceAbi } from "ethers";
import { env } from "../config/env.js";
import contentTradeArtifact from "./ContentTrade.json" with {
    type: "json",
};

const mnemonic = "test test test test test test test test test test test junk";

interface ContractDeployment {
    chainId: number;
    registContentVerifier: string;
    contentTrade: string;
    deployedAt: number;
}

function loadContractDeployment(): ContractDeployment {
    const deploymentPath = env.contractDeploymentPath;

    const json = readFileSync(deploymentPath, "utf-8");
    const deployment = JSON.parse(json) as ContractDeployment;

    if (!ethers.isAddress(deployment.contentTrade)) {
        throw new Error(`Invalid ContentTrade address in ${deploymentPath}`);
    }

    if (!ethers.isAddress(deployment.registContentVerifier)) {
        throw new Error(`Invalid RegistContentVerifier address in ${deploymentPath}`);
    }

    return deployment;
}

export const provider = new ethers.JsonRpcProvider(env.ethereumRpcUrl);

export const wallet = ethers.HDNodeWallet.fromPhrase(
  mnemonic,
  undefined,
  "m/44'/60'/0'/0/0",
).connect(provider);

const deployment = loadContractDeployment();

export const contentTradeContractAddress = deployment.contentTrade;
export const registContentVerifierAddress = deployment.registContentVerifier;

export const contentTradeContract = new ethers.Contract(
    contentTradeContractAddress,
    contentTradeArtifact.abi as InterfaceAbi,
    wallet,
);

/**
 * 워커 시작 전에 호출하여 RPC와 배포 정보가 일치하는지 확인합니다.
 */
export async function validateContractDeployment(): Promise<void> {
    const network = await provider.getNetwork();

    if (network.chainId !== BigInt(deployment.chainId)) {
        throw new Error(`Chain ID mismatch: RPC=${network.chainId}, deployment=${deployment.chainId}`);
    }

    const code = await provider.getCode(contentTradeContractAddress);

    if (code === "0x") {
        throw new Error(`No contract deployed at ${contentTradeContractAddress}`);
    }
}