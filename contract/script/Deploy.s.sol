
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {RegistContentVerifier} from "../src/RegistContentVerifier.sol";
import {GenerateTradeVerifier} from "../src/GenerateTradeVerifier.sol";
import {ApproveTradeVerifier} from "../src/ApproveTradeVerifier.sol";
import {ContentTrade} from "../src/Trade.sol";

contract Deploy is Script {
    string constant DEPLOYMENTS_DIR = "deployments";

    string constant MNEMONIC =
        "test test test test test test test test test test test junk";

    struct DeploymentData {
        address registVerifier;
        address generateTradeVerifier;
        address approveTradeVerifier;
        address contentTrade;

        // 기존 배포 주소 보존 (재배포 여부 확인용)
        address recordedRegistVerifier;
        address recordedGenerateTradeVerifier;
        address recordedApproveTradeVerifier;
    }

    function run() external {
        uint256 deployerPrivateKey = vm.deriveKey(MNEMONIC, 0);
        uint256 chainId = block.chainid;

        string memory path = string.concat(
            DEPLOYMENTS_DIR,
            "/",
            vm.toString(chainId),
            ".json"
        );

        console2.log("Deployer:", vm.addr(deployerPrivateKey));
        console2.log("Chain ID:", chainId);

        // 1. 기존 배포 정보 읽기
        DeploymentData memory deployment = _loadDeployment(path);

        // 2. Verifier 및 ContentTrade 배포
        vm.startBroadcast(deployerPrivateKey);

        deployment = _deployVerifiers(deployment);
        deployment = _deployContentTrade(deployment);

        vm.stopBroadcast();

        // 3. 배포 결과 저장
        _saveDeployment(path, chainId, deployment);
    }

    // =====================================================
    // 1. 기존 배포 정보 읽기
    // =====================================================

    function _loadDeployment(
        string memory path
    ) internal returns (DeploymentData memory d) {
        if (!vm.exists(path)) {
            return d;
        }

        string memory json = vm.readFile(path);

        if (vm.keyExistsJson(json, ".registContentVerifier")) {
            d.registVerifier = vm.parseJsonAddress(
                json,
                ".registContentVerifier"
            );
        }

        if (vm.keyExistsJson(json, ".generateTradeVerifier")) {
            d.generateTradeVerifier = vm.parseJsonAddress(
                json,
                ".generateTradeVerifier"
            );
        }

        if (vm.keyExistsJson(json, ".approveTradeVerifier")) {
            d.approveTradeVerifier = vm.parseJsonAddress(
                json,
                ".approveTradeVerifier"
            );
        } else if (
            vm.keyExistsJson(json, ".approveTradeVerifierAddr")
        ) {
            // 이전 버전 JSON 호환
            d.approveTradeVerifier = vm.parseJsonAddress(
                json,
                ".approveTradeVerifierAddr"
            );
        }

        if (vm.keyExistsJson(json, ".contentTrade")) {
            d.contentTrade = vm.parseJsonAddress(
                json,
                ".contentTrade"
            );
        }

        // 기존 주소 보존
        d.recordedRegistVerifier = d.registVerifier;
        d.recordedGenerateTradeVerifier = d.generateTradeVerifier;
        d.recordedApproveTradeVerifier = d.approveTradeVerifier;
    }

    // =====================================================
    // 2. Verifier 배포
    // =====================================================

    function _deployVerifiers(
        DeploymentData memory d
    ) internal returns (DeploymentData memory) {

        // RegistContentVerifier
        if (!_hasCode(d.registVerifier)) {
            d.registVerifier = address(
                new RegistContentVerifier()
            );

            console2.log(
                "RegistContentVerifier deployed:",
                d.registVerifier
            );
        } else {
            console2.log(
                "RegistContentVerifier already deployed:",
                d.registVerifier
            );
        }

        // GenerateTradeVerifier
        if (!_hasCode(d.generateTradeVerifier)) {
            d.generateTradeVerifier = address(
                new GenerateTradeVerifier()
            );

            console2.log(
                "GenerateTradeVerifier deployed:",
                d.generateTradeVerifier
            );
        } else {
            console2.log(
                "GenerateTradeVerifier already deployed:",
                d.generateTradeVerifier
            );
        }

        // ApproveTradeVerifier
        if (!_hasCode(d.approveTradeVerifier)) {
            d.approveTradeVerifier = address(
                new ApproveTradeVerifier()
            );

            console2.log(
                "ApproveTradeVerifier deployed:",
                d.approveTradeVerifier
            );
        } else {
            console2.log(
                "ApproveTradeVerifier already deployed:",
                d.approveTradeVerifier
            );
        }

        return d;
    }

    // =====================================================
    // 3. ContentTrade 배포
    // =====================================================

    function _deployContentTrade(
        DeploymentData memory d
    ) internal returns (DeploymentData memory) {

        bool canReuse =
            _hasCode(d.contentTrade) &&
            d.recordedRegistVerifier == d.registVerifier &&
            d.recordedGenerateTradeVerifier == d.generateTradeVerifier &&
            d.recordedApproveTradeVerifier == d.approveTradeVerifier;

        if (!canReuse) {
            d.contentTrade = address(
                new ContentTrade(
                    d.registVerifier,
                    d.generateTradeVerifier,
                    d.approveTradeVerifier
                )
            );

            console2.log(
                "ContentTrade deployed:",
                d.contentTrade
            );
        } else {
            console2.log(
                "ContentTrade already deployed:",
                d.contentTrade
            );
        }

        return d;
    }

    // =====================================================
    // 4. 배포 결과 저장
    // =====================================================

    function _saveDeployment(
        string memory path,
        uint256 chainId,
        DeploymentData memory d
    ) internal {
        string memory obj = "contentTradeDeployment";

        vm.serializeUint(obj, "chainId", chainId);

        vm.serializeAddress(
            obj,
            "registContentVerifier",
            d.registVerifier
        );

        vm.serializeAddress(
            obj,
            "generateTradeVerifier",
            d.generateTradeVerifier
        );

        vm.serializeAddress(
            obj,
            "approveTradeVerifier",
            d.approveTradeVerifier
        );

        vm.serializeAddress(
            obj,
            "contentTrade",
            d.contentTrade
        );

        string memory finalJson = vm.serializeUint(
            obj,
            "deployedAt",
            block.timestamp
        );

        vm.writeJson(finalJson, path);

        console2.log("Deployment saved to:", path);
    }

    // =====================================================
    // Utility
    // =====================================================

    function _hasCode(address addr) internal view returns (bool) {
        return addr != address(0) && addr.code.length > 0;
    }
}
