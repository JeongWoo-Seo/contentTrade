// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {RegistContentVerifier} from "../src/RegistContentVerifier.sol";
import {GenerateTradeVerifier} from "../src/GenerateTradeVerifier.sol";
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

/// @notice 구매(purchaseContent) 검증기 mock. public inputs 13개.
contract MockPurchaseVerifier {
    bool public result = true;

    function verifyProof(
        uint[2] calldata,
        uint[2][2] calldata,
        uint[2] calldata,
        uint[13] calldata
    ) external view returns (bool) {
        return result;
    }

    function setResult(bool r) external {
        result = r;
    }
}

contract RegistContentTest is Test {
    RegistContentVerifier regist;
    GenerateTradeVerifier generate;
    ContentTrade trade;

    function setUp() public {
        regist = new RegistContentVerifier();
        generate = new GenerateTradeVerifier();
        trade = new ContentTrade(address(regist), address(generate));
    }

    // mock 기반 ContentTrade를 배포한다 (regist/purchase verifier 모두 mock).
    function newMockTrade()
        private
        returns (ContentTrade, MockRegistContentVerifier, MockPurchaseVerifier)
    {
        MockRegistContentVerifier mockRegist = new MockRegistContentVerifier();
        MockPurchaseVerifier mockPurchase = new MockPurchaseVerifier();
        ContentTrade mockTrade = new ContentTrade(
            address(mockRegist),
            address(mockPurchase)
        );
        return (mockTrade, mockRegist, mockPurchase);
    }

    /// @notice 배포자(이 테스트 컨트랙트)가 owner가 된다.
    function test_OwnerIsDeployer() public view {
        assertEq(trade.owner(), address(this));
    }

    /// @notice 실제 Groth16 verifier가 0 증명을 거부한다.
    function test_VerifierRejectsZeroProof() public view {
        uint[2] memory a = [uint256(0), 0];
        uint[2][2] memory b = [[uint256(0), 0], [uint256(0), 0]];
        uint[2] memory c = [uint256(0), 0];
        uint[4] memory input = [uint256(0), 0, 0, 0];

        assertFalse(regist.verifyProof(a, b, c, input));
    }

    /// @notice mock 검증기가 true면 콘텐츠 등록이 성공하고, h_ct(=input[2]) 키에 기록된다.
    function test_RegisterContentSuccess() public {
        (ContentTrade mockTrade, , ) = newMockTrade();

        uint[2] memory a = [uint256(1), 2];
        uint[2][2] memory b = [[uint256(1), 2], [uint256(3), 4]];
        uint[2] memory c = [uint256(5), 6];
        // publicSignals: [pk_own, h_k, h_ct, h_data]
        uint[4] memory input = [uint256(11), 22, 33, 44];

        // publicSignals: [pk_own, h_k, h_ct, h_data] → h_ct = input[2] = 33
        vm.expectEmit(true, false, false, true, address(mockTrade));
        emit ContentTrade.ContentRegistered(33);

        mockTrade.registerContent(a, b, c, input);

        assertTrue(mockTrade.contents(33));
    }

    /// @notice 동일 h_ct로 재등록하면 ContentAlreadyRegistered.
    function test_RegisterContentDedup() public {
        (ContentTrade mockTrade, , ) = newMockTrade();

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
        MockPurchaseVerifier purchaseMock = new MockPurchaseVerifier();
        ContentTrade mockTrade = new ContentTrade(
            address(mock),
            address(purchaseMock)
        );

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

    // ─────────────────────────────────────────────
    /// @notice registUser가 EOA 등록과 ena(addr) 기록을 수행한다.
    function test_RegistUserSuccess() public {
        uint256 addr = 1;
        uint256 pkOwn = 2;
        uint256[2] memory pkEnc = [uint256(3), 4];
        uint256 r = 5;
        uint256 ct = 6;

        trade.registUser(addr, pkOwn, pkEnc, r, ct);

        (uint256 enaR, uint256 enaCt) = trade.ena(addr);
        assertEq(enaR, r);
        assertEq(enaCt, ct);
    }

    /// @notice 같은 EOA가 재등록하면 UserAlreadyRegistered.
    function test_RegistUserDedup() public {
        trade.registUser(1, 2, [uint256(3), 4], 5, 6);

        vm.expectRevert(ContentTrade.UserAlreadyRegistered.selector);
        trade.registUser(7, 8, [uint256(9), 10], 11, 12);
    }

    /// @notice addr == 0이면 ZeroAddress.
    function test_RegistUserZeroAddr() public {
        vm.expectRevert(ContentTrade.ZeroAddress.selector);
        trade.registUser(0, 2, [uint256(3), 4], 5, 6);
    }

    // ─────────────────────────────────────────────
    // purchaseContent
    // ─────────────────────────────────────────────

    /// @notice 등록된 사용자가 유효한 증명으로 구매하면 PENDING 주문이 생성된다.
    function test_PurchaseContentSuccess() public {
        (ContentTrade mockTrade, , MockPurchaseVerifier purchaseMock) =
            newMockTrade();

        mockTrade.registUser(1, 2, [uint256(3), 4], 5, 6);
        mockTrade.setPurchaseVerifier(address(purchaseMock));

        uint[2] memory a = [uint256(1), 2];
        uint[2][2] memory b = [[uint256(1), 2], [uint256(3), 4]];
        uint[2] memory c = [uint256(5), 6];
        uint[13] memory input;
        input[0] = 10; // cm_svr
        input[1] = 20; // cm_auth

        uint256 orderNumber = mockTrade.purchaseContent(a, b, c, input);

        // OrderStatus.PENDING == 1
        assertEq(uint256(mockTrade.orderStatus(orderNumber)), 1);
    }

    /// @notice 등록하지 않은 사용자는 UserNotRegistered.
    function test_PurchaseContentNotRegistered() public {
        (ContentTrade mockTrade, , ) = newMockTrade();

        uint[2] memory a = [uint256(1), 2];
        uint[2][2] memory b = [[uint256(1), 2], [uint256(3), 4]];
        uint[2] memory c = [uint256(5), 6];
        uint[13] memory input;
        input[0] = 10;
        input[1] = 20;

        vm.expectRevert(ContentTrade.UserNotRegistered.selector);
        mockTrade.purchaseContent(a, b, c, input);
    }

    // ─────────────────────────────────────────────
    // cancelOrder
    // ─────────────────────────────────────────────

    /// @notice 주문자가 취소하면 CANCELLED로 전이한다.
    function test_CancelOrderSuccess() public {
        (ContentTrade mockTrade, , MockPurchaseVerifier purchaseMock) =
            newMockTrade();

        mockTrade.registUser(1, 2, [uint256(3), 4], 5, 6);
        mockTrade.setPurchaseVerifier(address(purchaseMock));

        uint[2] memory a = [uint256(1), 2];
        uint[2][2] memory b = [[uint256(1), 2], [uint256(3), 4]];
        uint[2] memory c = [uint256(5), 6];
        uint[13] memory input;
        input[0] = 10;
        input[1] = 20;

        uint256 orderNumber = mockTrade.purchaseContent(a, b, c, input);

        mockTrade.cancelOrder(orderNumber);

        // OrderStatus.CANCELLED == 3
        assertEq(uint256(mockTrade.orderStatus(orderNumber)), 3);
    }

    /// @notice 주문자가 아니면 NotOrderOwn.
    function test_CancelOrderNotOwn() public {
        (ContentTrade mockTrade, , MockPurchaseVerifier purchaseMock) =
            newMockTrade();

        mockTrade.registUser(1, 2, [uint256(3), 4], 5, 6); // address(this)
        mockTrade.setPurchaseVerifier(address(purchaseMock));

        // 두 번째 사용자(0xdead → addr 100) 등록
        vm.prank(address(0xdead));
        mockTrade.registUser(100, 200, [uint256(300), 400], 500, 600);

        uint[2] memory a = [uint256(1), 2];
        uint[2][2] memory b = [[uint256(1), 2], [uint256(3), 4]];
        uint[2] memory c = [uint256(5), 6];
        uint[13] memory input;
        input[0] = 10;
        input[1] = 20;

        uint256 orderNumber = mockTrade.purchaseContent(a, b, c, input);

        vm.prank(address(0xdead));
        vm.expectRevert(ContentTrade.NotOrderOwn.selector);
        mockTrade.cancelOrder(orderNumber);
    }
}
