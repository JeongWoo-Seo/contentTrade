# contentTrade Contracts (Foundry)

콘텐츠 거래 플랫폼의 스마트 컨트랙트. ZK(Groth16) 증명 검증기와 콘텐츠 등록 레지스트리를 배포한다.

## 구성

```
contract/
├── src/
│   ├── Trade.sol                  # ContentTrade + verifier 인터페이스
│   └── RegistContentVerifier.sol  # Groth16 verifier (snarkjs 생성)
├── script/
│   └── Deploy.s.sol               # 배포 스크립트
├── test/
│   └── RegistContent.t.sol        # 등록 로직 테스트
├── deployments/                   # 배포 결과 (chainId 별 JSON)
├── lib/                           # forge-std
└── foundry.toml
```

## 요구 사항

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`, `anvil`)
- Solidity `0.8.24`

```bash
# forge-std 설치 (서브모듈로 관리되는 경우)
forge install foundry-rs/forge-std
```

## 빌드 / 테스트

```bash
forge build
forge test
```

## 컨트랙트

### RegistContentVerifier

`RegistContentVerifier`는 콘텐츠 등록 회로(`circuits/circuits/regist_content.circom`)의 Groth16 검증기다.
snarkjs로 생성된 코드를 사용하며, 생성 위치와 명령은 아래 "verifier 생성"을 참고한다.

**공개 입력(public signals) 순서** — 4개:

```
[pk_own, h_k, h_ct, h_data]
```

**ABI**:

```json
[{
  "name": "verifyProof",
  "type": "function",
  "stateMutability": "view",
  "inputs": [
    { "name": "a",     "type": "uint256[2]" },
    { "name": "b",     "type": "uint256[2][2]" },
    { "name": "c",     "type": "uint256[2]" },
    { "name": "input", "type": "uint256[4]" }
  ],
  "outputs": [{ "name": "", "type": "bool" }]
}]
```

### ContentTrade

`ContentTrade`는 검증기를 참조하며, 유효한 증명을 제시한 콘텐츠를 `h_ct`(publicSignals[3])를 키로 등록한다.

**생성자**: `ContentTrade(address _registVerifier)`

- `_registVerifier`: `RegistContentVerifier` 주소 (address(0) 금지)
- `owner`는 배포자가 된다.

## verifier 생성

`RegistContentVerifier.sol`은 회로의 trusted setup(zkey)에서 생성한다:

```bash
cd circuits
snarkjs zkey export solidityverifier builds/regist_content_final.zkey \
  ../contract/src/RegistContentVerifier.sol
```

> **중요**: 회로(`regist_content.circom`)가 변경되면 `r1cs`/`wasm`/`zkey`를 다시 컴파일·생성하고,
> 위 명령으로 verifier를 재생성해야 한다. 현재 회로의 공개 입력은 4개이며,
> `verification_key.json`의 `nPublic` 값과 일치해야 한다.

## 로컬 배포

```bash
# 1. 로컬 체인
anvil

# 2. 배포 (다른 터미널)
export DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

**배포 순서**:

1. `RegistContentVerifier` 배포
2. `ContentTrade(registVerifier)` 배포

**배포 결과**: `deployments/<chainId>.json` 에 체인 ID와 컨트랙트 주소가 저장된다.

```json
{
  "chainId": 31337,
  "registContentVerifier": "0x...",
  "contentTrade": "0x...",
  "deployedAt": 1791532471
}
```

**재배포 방지**: 동일 체인 ID의 `deployments/<chainId>.json`에 기록된 주소에
코드가 존재하면 해당 컨트랙트는 재배포하지 않는다.

## 환경 변수

| 이름 | 설명 |
|---|---|
| `DEPLOYER_PRIVATE_KEY` | 배포자 EOA 개인 키 (0x prefix 없이 64 hex). 코드에 하드코딩 금지. |

## 보안

- `.env`, 개인 키, 빌드 산출물(`out/`), 캐시(`cache/`), 트랜잭션(`broadcast/`)은 `.gitignore`로 제외한다.
- 개인 키는 반드시 환경 변수(`DEPLOYER_PRIVATE_KEY`)로 주입한다.
