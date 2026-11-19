// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "poseidon-solidity/PoseidonT3.sol";

/// @notice 콘텐츠 등록용 Groth16 검증기
interface IRegistContentVerifier {
    function verifyProof(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[4] calldata input
    ) external view returns (bool);
}

/// @notice 구매용 검증기
interface IPurchaseVerifier {
    function verifyProof(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[17] calldata input
    ) external view returns (bool);
}

/// @notice 거래승인 검증기
interface IApproveTradeVerifier {
    function verifyProof(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[6] calldata input
    ) external view returns (bool);
}

contract ContentTrade {
    // ─────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────

    error ZeroAddress();
    error NotOwner();
    error UserNotRegistered();
    error InvalidProof();
    error InvalidContentId();
    error ContentAlreadyRegistered();
    error ContentNotFound();
    error InvalidPrice();
    error InvalidVerifier();
    error UserAlreadyRegistered();
    error AddrAlreadyExists();
    error AlreadyExistCm();
    error NoExistsCm();
    error AlreadyExistsOrder();
    error NoExistsOrder();
    error NotEqualEna();
    error NotOrderOwn();

    // ─────────────────────────────────────────
    // State
    // ─────────────────────────────────────────

    enum OrderStatus {
        NONE,
        PENDING,
        APPROVED,
        CANCELLED
    }

    address public immutable owner;

    IRegistContentVerifier public registVerifier;
    IPurchaseVerifier public purchaseVerifier;
    IApproveTradeVerifier public approveTradeVerifier;

    struct ENA {
        uint256 r;
        uint256 ct;
    }

    struct userInfo {
        uint256 addr;
        uint256 pk_own;
        uint256[2] pk_enc;
    }

    struct Order {
        uint256 orderer;
        uint256 cm_svr;
        uint256 cm_auth;
        ENA oldEna;
        ENA newEna;
    }

    //eoa
    mapping(address => bool) internal _eoa_list;
    //addr
    mapping(uint256 => bool) internal _addr_list;

    // EOA -> user keys
    mapping(address => userInfo) public userInfoMap;

    // addr -> ena
    mapping(uint256 => ENA) public ena;

    // order number -> order
    mapping(uint256 => Order) public order;

    // order number
    mapping(uint256 => OrderStatus) public orderStatus;

    //h_ct
    mapping(uint256 => bool) public contents;

    // to check trade
    mapping(uint256 => bool) waitTradeCm;
    mapping(uint256 => bool) usedCm;

    // ─────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────

    event ContentRegistered(uint256 indexed h_ct);
    event ContentPurchased(uint256 indexed order_number);
    event TradeApproved(uint256 indexed order_number);
    event OrderCancelled(uint256 indexed order_number);

    event VerifierUpdated(
        uint8 indexed verifierType,
        address indexed verifierAddress
    );

    // ─────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ─────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────

    constructor(
        address _registVerifier,
        address _purchaseVerifier,
        address _approveTradeVerifier
    ) {
        if (
            _registVerifier == address(0) || _purchaseVerifier == address(0)
            || _approveTradeVerifier == address(0)
        ) {
            revert ZeroAddress();
        }

        owner = msg.sender;

        registVerifier = IRegistContentVerifier(_registVerifier);
        purchaseVerifier = IPurchaseVerifier(_purchaseVerifier);
        approveTradeVerifier = IApproveTradeVerifier(_approveTradeVerifier);
    }

    function registUser(
        uint256 addr,
        uint256 pk_own,
        uint256[2] calldata pk_enc,
        uint256 r,
        uint256 ct
    ) public {
        if (_eoa_list[msg.sender]) {
            revert UserAlreadyRegistered();
        }

        if (_addr_list[addr]) {
            revert AddrAlreadyExists();
        }

        if (addr == 0) {
            revert ZeroAddress();
        }

        _eoa_list[msg.sender] = true;
        _addr_list[addr] = true;

        userInfoMap[msg.sender].addr = addr;
        userInfoMap[msg.sender].pk_enc = pk_enc;
        userInfoMap[msg.sender].pk_own = pk_own;
        ena[addr] = ENA({r: r, ct: ct});
    }

    // ─────────────────────────────────────────
    // Content Registration
    // ─────────────────────────────────────────

    /// @notice ZK 증명을 검증한 뒤 콘텐츠를 등록
    /// @dev publicSignals 순서:
    /// [pk_own, h_k, h_ct, h_data]
    function registerContent(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[4] calldata publicSignals
    ) external onlyOwner {
        if (contents[publicSignals[2]] == true) {
            revert ContentAlreadyRegistered();
        }

        if (!registVerifier.verifyProof(a, b, c, publicSignals)) {
            revert InvalidProof();
        }

        contents[publicSignals[2]] = true;

        emit ContentRegistered(publicSignals[2]);
    }

    // ─────────────────────────────────────────
    // Content Purchase
    // ─────────────────────────────────────────

    /// @dev publicSignals 순서:
    /// cm_svr,cm_auth,oldEna_r,oldEna_ct,newEna_r,newEna_ct,c0[2],c1_auth,c1_svr,c2[7],
    function purchaseContent(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[17] calldata publicSignals
    ) external returns (uint256 orderNumber) {
        if (!_eoa_list[msg.sender]) {
            revert UserNotRegistered();
        }

        uint256 cmSvr = publicSignals[0];
        uint256 cmAuth = publicSignals[1];

        // 이미 사용된 커밋먼트인지 확인
        if (
            waitTradeCm[cmSvr] ||
            waitTradeCm[cmAuth] ||
            usedCm[cmSvr] ||
            usedCm[cmAuth]
        ) {
            revert AlreadyExistCm();
        }

        // ZK Proof 검증
        if (!purchaseVerifier.verifyProof(a, b, c, publicSignals)) {
            revert InvalidProof();
        }

        // cm_svr, cm_auth를 Poseidon으로 해싱하여 orderNumber 생성
        orderNumber = PoseidonT3.hash([cmSvr, cmAuth]);
        if (orderStatus[orderNumber] != OrderStatus.NONE) {
            revert AlreadyExistsOrder();
        }

        orderStatus[orderNumber] = OrderStatus.PENDING;

        // 거래 임시 등록
        waitTradeCm[cmSvr] = true;
        waitTradeCm[cmAuth] = true;

        order[orderNumber] = Order({
            orderer: userInfoMap[msg.sender].addr,
            cm_svr: cmSvr,
            cm_auth: cmAuth,
            oldEna: ENA({r: publicSignals[2], ct: publicSignals[3]}),
            newEna: ENA({r: publicSignals[4], ct: publicSignals[5]})
        });

        emit ContentPurchased(orderNumber);
    }

    // ─────────────────────────────────────────
    // approve trade
    // ─────────────────────────────────────────
    /// @dev publicSignals 순서:
    ///
    function approveTrade(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[6] calldata publicSignals
    ) external onlyOwner {
        uint256 cmSvr = publicSignals[0];
        uint256 cmAuth = publicSignals[1];

        if (!waitTradeCm[cmSvr] || !waitTradeCm[cmAuth]) {
            revert NoExistsCm();
        }

        if (usedCm[cmSvr] || usedCm[cmAuth]) {
            revert AlreadyExistCm();
        }

        if (!approveTradeVerifier.verifyProof(a, b, c, publicSignals)) {
            revert InvalidProof();
        }

        uint256 orderNumber = PoseidonT3.hash([cmSvr, cmAuth]);

        if (orderStatus[orderNumber] != OrderStatus.PENDING) {
            revert NoExistsOrder();
        }

        orderStatus[orderNumber] = OrderStatus.APPROVED;

        uint256 addr = order[orderNumber].orderer;
        if (
            ena[addr].r != order[orderNumber].oldEna.r ||
            ena[addr].ct != order[orderNumber].oldEna.ct
        ) {
            revert NotEqualEna();
        }

        ena[addr] = ENA({
            r: order[orderNumber].newEna.r,
            ct: order[orderNumber].newEna.ct
        });

        // 거래 cm 사용
        waitTradeCm[cmSvr] = false;
        waitTradeCm[cmAuth] = false;

        usedCm[cmSvr] = true;
        usedCm[cmAuth] = true;

        //merkle tree

        emit TradeApproved(orderNumber);
    }

    // ─────────────────────────────────────────
    // cancel order
    // ─────────────────────────────────────────
    function cancelOrder(uint256 orderNumber) public {
        if (orderStatus[orderNumber] != OrderStatus.PENDING) {
            revert NoExistsOrder();
        }

        if (!_eoa_list[msg.sender]) {
            revert UserNotRegistered();
        }

        if (userInfoMap[msg.sender].addr != order[orderNumber].orderer) {
            revert NotOrderOwn();
        }

        if (
            !waitTradeCm[order[orderNumber].cm_svr] ||
            !waitTradeCm[order[orderNumber].cm_auth]
        ) {
            revert NoExistsCm();
        }

        waitTradeCm[order[orderNumber].cm_svr] = false;
        waitTradeCm[order[orderNumber].cm_auth] = false;

        orderStatus[orderNumber] = OrderStatus.CANCELLED;

        emit OrderCancelled(orderNumber);
    }

    // ─────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────

    /// @notice 검증기 주소 변경
    /// immutable이 아닌 verifier 참조를 교체함
    function setRegistVerifier(address newVerifier) external onlyOwner {
        if (newVerifier == address(0)) revert ZeroAddress();

        registVerifier = IRegistContentVerifier(newVerifier);

        emit VerifierUpdated(1, newVerifier);
    }

    function setPurchaseVerifier(address newVerifier) external onlyOwner {
        if (newVerifier == address(0)) revert ZeroAddress();

        purchaseVerifier = IPurchaseVerifier(newVerifier);

        emit VerifierUpdated(2, newVerifier);
    }

    function setApproveTradeVerifier(address newVerifier) external onlyOwner {
        if (newVerifier == address(0)) revert ZeroAddress();

        approveTradeVerifier = IApproveTradeVerifier(newVerifier);

        emit VerifierUpdated(3, newVerifier);
    }
}
