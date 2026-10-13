
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice 콘텐츠 등록용 Groth16 검증기
interface IRegistContentVerifier {
    function verifyProof(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[4] calldata input
    ) external view returns (bool);
}

/// @notice 구매용 검증기 인터페이스
/// 실제 구매 회로의 공개 입력 개수에 맞게 수정해야 함
interface IPurchaseVerifier {
    function verifyProof(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[4] calldata input
    ) external view returns (bool);
}

/// @notice 세 번째 ZK 검증기 인터페이스
/// 실제 회로의 공개 입력 개수에 맞게 수정해야 함
interface IThirdVerifier {
    function verifyProof(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[4] calldata input
    ) external view returns (bool);
}

contract ContentTrade {
    // ─────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────

    error ZeroAddress();
    error NotOwner();
    error InvalidProof();
    error InvalidContentId();
    error ContentAlreadyRegistered();
    error ContentNotFound();
    error InvalidPrice();
    error InvalidVerifier();

    // ─────────────────────────────────────────
    // State
    // ─────────────────────────────────────────

    address public immutable owner;

    IRegistContentVerifier public registVerifier;
    IPurchaseVerifier public purchaseVerifier;
    IThirdVerifier public thirdVerifier;

    struct Content {
        bool active;
    }

    mapping(uint256 => Content) public contents;

    // ─────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────

    event ContentRegistered(uint256 indexed h_ct);

    event ContentPurchased(

    );

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
        address _registVerifier
        //address _purchaseVerifier,
        //address _thirdVerifier
    ) {
        if (
            _registVerifier == address(0)
            //_purchaseVerifier == address(0) ||
            //_thirdVerifier == address(0)
        ) {
            revert ZeroAddress();
        }

        owner = msg.sender;

        registVerifier = IRegistContentVerifier(_registVerifier);
        //purchaseVerifier = IPurchaseVerifier(_purchaseVerifier);
        //thirdVerifier = IThirdVerifier(_thirdVerifier);
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
    ) external {
        if (contents[publicSignals[3]].active == true) {
            revert ContentAlreadyRegistered();
        }

        if (
            !registVerifier.verifyProof(
                a,
                b,
                c,
                publicSignals
            )
        ) {
            revert InvalidProof();
        }

        contents[publicSignals[3]] = Content({
            active: true
        });

        emit ContentRegistered(publicSignals[3]);
    }

    // ─────────────────────────────────────────
    // Content Purchase
    // ─────────────────────────────────────────

    /// @notice 구매 증명을 검증한 뒤 결제를 처리하는 예시
    /// @dev 현재 예시는 ETH 결제 및 구매 증명 인터페이스를 가정함.
    /// 실제 회로의 공개 입력 의미에 맞게 수정해야 함.
    function purchaseContent(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[4] calldata publicSignals
    ) external  {
       

        if (
            !purchaseVerifier.verifyProof(
                a,
                b,
                c,
                publicSignals
            )
        ) {
            revert InvalidProof();
        }

        // 결제 대금은 컨트랙트에 보관한다.
        // 실제 운영에서는 출금/정산 정책을 별도로 구현해야 한다.
        emit ContentPurchased(
           
        );
    }

    // ─────────────────────────────────────────
    // Third Verification Example
    // ─────────────────────────────────────────

    /// @notice 세 번째 검증기를 사용하는 예시
    /// 실제 기능 및 공개 입력 정의에 맞게 수정해야 함
    function verifyThirdProof(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[4] calldata publicSignals
    ) external view returns (bool) {
        return thirdVerifier.verifyProof(
            a,
            b,
            c,
            publicSignals
        );
    }

    // ─────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────

    /// @notice 검증기 주소 변경
    /// immutable이 아닌 verifier 참조를 교체함
    function setRegistVerifier(
        address newVerifier
    ) external onlyOwner {
        if (newVerifier == address(0)) revert ZeroAddress();

        registVerifier = IRegistContentVerifier(newVerifier);

        emit VerifierUpdated(1, newVerifier);
    }

    function setPurchaseVerifier(
        address newVerifier
    ) external onlyOwner {
        if (newVerifier == address(0)) revert ZeroAddress();

        purchaseVerifier = IPurchaseVerifier(newVerifier);

        emit VerifierUpdated(2, newVerifier);
    }

    function setThirdVerifier(
        address newVerifier
    ) external onlyOwner {
        if (newVerifier == address(0)) revert ZeroAddress();

        thirdVerifier = IThirdVerifier(newVerifier);

        emit VerifierUpdated(3, newVerifier);
    }
}