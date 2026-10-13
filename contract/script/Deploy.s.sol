// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {RegistContentVerifier} from "../src/RegistContentVerifier.sol";
import {ContentTrade} from "../src/Trade.sol";

/**
 * @title Deploy
 * @notice RegistContentVerifier + ContentTrade 배포 스크립트.
 *
 * 환경 변수:
 *   DEPLOYER_PRIVATE_KEY - MNEMONIC
 * 사용법:
 *   forge script script/Deploy.s.sol --rpc-url <RPC> --broadcast
 *
 * 배포 순서:
 *   1. RegistContentVerifier (Groth16 verifier, public inputs 4개)
 *   2. ContentTrade(registVerifier 주소)
 *
 * 재배포 방지:
 *   deployments/<chainId>.json 에 저장된 주소의 코드 존재 여부와 체인 ID를 확인하여
 *   이미 배포되어 있으면 해당 컨트랙트는 재배포하지 않는다.
 */
contract Deploy is Script {
    string constant DEPLOYMENTS_DIR = "deployments";

    function run() external {
        string memory mnemonic = "test test test test test test test test test test test junk";
        uint256 deployerPrivateKey = vm.deriveKey(mnemonic, 0);
        address deployer = vm.addr(deployerPrivateKey);

        uint256 chainId = block.chainid;
        string memory path = string.concat(
            DEPLOYMENTS_DIR,
            "/",
            vm.toString(chainId),
            ".json"
        );

        // ─────────────────────────────────────────────
        // 기존 배포 확인 (체인 ID + 코드 존재 여부)
        // ─────────────────────────────────────────────
        address registVerifierAddr = address(0);
        address contentTradeAddr = address(0);

        if (vm.exists(path)) {
            string memory json = vm.readFile(path);
            registVerifierAddr = vm.parseJsonAddress(
                json,
                ".registContentVerifier"
            );
            contentTradeAddr = vm.parseJsonAddress(json, ".contentTrade");
        }

        bool verifierDeployed = registVerifierAddr != address(0) &&
            registVerifierAddr.code.length > 0;
        bool tradeDeployed = contentTradeAddr != address(0) &&
            contentTradeAddr.code.length > 0;

        console2.log("Deployer:", deployer);
        console2.log("Chain ID:", chainId);

        // ─────────────────────────────────────────────
        // 배포
        // ─────────────────────────────────────────────
        vm.startBroadcast(deployerPrivateKey);

        if (!verifierDeployed) {
            registVerifierAddr = address(new RegistContentVerifier());
            console2.log(
                "RegistContentVerifier deployed at:",
                registVerifierAddr
            );
        } else {
            console2.log(
                "RegistContentVerifier already deployed at:",
                registVerifierAddr
            );
        }

        if (!tradeDeployed) {
            contentTradeAddr = address(new ContentTrade(registVerifierAddr));
            console2.log("ContentTrade deployed at:", contentTradeAddr);
        } else {
            console2.log("ContentTrade already deployed at:", contentTradeAddr);
        }

        vm.stopBroadcast();

        // ─────────────────────────────────────────────
        // 배포 결과 저장 (deployments/<chainId>.json)
        // ─────────────────────────────────────────────
        string memory obj = "contentTradeDeployment";
        vm.serializeUint(obj, "chainId", chainId);
        vm.serializeAddress(obj, "registContentVerifier", registVerifierAddr);
        vm.serializeAddress(obj, "contentTrade", contentTradeAddr);
        string memory finalJson = vm.serializeUint(
            obj,
            "deployedAt",
            block.timestamp
        );

        vm.writeJson(finalJson, path);
        console2.log("Deployment saved to:", path);
    }
}
