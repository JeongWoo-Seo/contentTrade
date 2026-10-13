// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {RegistContentVerifier} from "../src/RegistContentVerifier.sol";
import {ContentTrade} from "../src/Trade.sol";

/// @notice ContentTrade 등록 로직 테스트용 mock 검증기.
/// 실제 Groth16 증명을 생성하지 않고도 ContentTrade의 상태 전이를 검증한다.
contract MockRegistContentVerifier {
    bool public result = true;

    function verifyProof(
        uint[2] calldata,
        uint[2][2] calldata,
        uint[2] calldata,
        uint[4] calldata
    ) external view returns (bool) {
        return result;
    }

    function setResult(bool r) external {
        result = r;
    }
}

contract RegistContentTest is Test {
    RegistContentVerifier verifier;
    ContentTrade trade;

    function setUp() public {
        verifier = new RegistContentVerifier();
        trade = new ContentTrade(address(verifier));
    }

    /// @notice 배포자(이 테스트 컨트랙트)가 owner가 된다.
    function test_OwnerIsDeployer() public view {
        assertEq(trade.owner(), address(this));
    }

    /// @notice 실제 Groth16 verifier가 0 증명을 거부한다.
    /// (검증기 배포 후 정상 동작 sanity check)
    function test_VerifierRejectsZeroProof() public view {
        uint[2] memory a = [uint256(0), 0];
        uint[2][2] memory b = [[uint256(0), 0], [uint256(0), 0]];
        uint[2] memory c = [uint256(0), 0];
        uint[4] memory input = [uint256(0), 0, 0, 0];

        assertFalse(verifier.verifyProof(a, b, c, input));
    }

    /// @notice mock 검증기가 true면 콘텐츠 등록이 성공하고, h_ct(=input[3]) 키에 기록된다.
    function test_RegisterContentSuccess() public {
        MockRegistContentVerifier mock = new MockRegistContentVerifier();
        ContentTrade mockTrade = new ContentTrade(address(mock));

        uint[2] memory a = [uint256(1), 2];
        uint[2][2] memory b = [[uint256(1), 2], [uint256(3), 4]];
        uint[2] memory c = [uint256(5), 6];
        // publicSignals: [pk_own, h_k, h_ct, h_data]
        uint[4] memory input = [uint256(11), 22, 33, 44];

        vm.expectEmit(true, false, false, true, address(mockTrade));
        emit ContentTrade.ContentRegistered(44);

        mockTrade.registerContent(a, b, c, input);

        assertTrue(mockTrade.contents(44));
    }

    /// @notice 동일 h_ct로 재등록하면 ContentAlreadyRegistered.
    function test_RegisterContentDedup() public {
        MockRegistContentVerifier mock = new MockRegistContentVerifier();
        ContentTrade mockTrade = new ContentTrade(address(mock));

        uint[2] memory a = [uint256(1), 2];
        uint[2][2] memory b = [[uint256(1), 2], [uint256(3), 4]];
        uint[2] memory c = [uint256(5), 6];
        uint[4] memory input = [uint256(11), 22, 33, 44];

        mockTrade.registerContent(a, b, c, input);

        vm.expectRevert(ContentTrade.ContentAlreadyRegistered.selector);
        mockTrade.registerContent(a, b, c, input);
    }

    /// @notice 검증 실패 시 InvalidProof.
    function test_RegisterContentInvalidProof() public {
        MockRegistContentVerifier mock = new MockRegistContentVerifier();
        mock.setResult(false);
        ContentTrade mockTrade = new ContentTrade(address(mock));

        uint[2] memory a = [uint256(1), 2];
        uint[2][2] memory b = [[uint256(1), 2], [uint256(3), 4]];
        uint[2] memory c = [uint256(5), 6];
        uint[4] memory input = [uint256(11), 22, 33, 44];

        vm.expectRevert(ContentTrade.InvalidProof.selector);
        mockTrade.registerContent(a, b, c, input);
    }

    /// @notice verifier 주소는 owner만 변경할 수 있다.
    function test_OnlyOwnerCanSetVerifier() public {
        vm.prank(address(0xdead));
        vm.expectRevert(ContentTrade.NotOwner.selector);
        trade.setRegistVerifier(address(0xbeef));
    }
}
