
#!/usr/bin/env bash
set -euo pipefail

# .env 파일 로드
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
set -a
source "$SCRIPT_DIR/../.env"
set +a

: "${DEPLOYER_PRIVATE_KEY:?DEPLOYER_PRIVATE_KEY is required}"

RPC_URL="${BLOCKCHAIN_RPC_URL:-http://127.0.0.1:8545}"

# Anvil RPC가 준비될 때까지 대기
for i in $(seq 1 30); do
  if cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then
    break
  fi

  if [ "$i" -eq 30 ]; then
    echo "Error: Anvil RPC is not available: $RPC_URL"
    exit 1
  fi

  sleep 1
done

# 개발용 개인키에서 주소 계산
WALLET_ADDRESS=$(
  cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY"
)

echo "Development wallet: $WALLET_ADDRESS"

# 현재 잔액 확인
BALANCE=$(
  cast balance "$WALLET_ADDRESS" \
    --ether \
    --rpc-url "$RPC_URL"
)

echo "Current balance: $BALANCE ETH"

# 잔액이 10 ETH 미만일 때 100 ETH 지급
if awk -v balance="$BALANCE" 'BEGIN { exit !(balance < 10) }'; then
  echo "Funding development wallet..."

  cast send "$WALLET_ADDRESS" \
    --value 100ether \
    --private-key "$ANVIL_FUNDER_PRIVATE_KEY" \
    --rpc-url "$RPC_URL"

  echo "Funding completed."
else
  echo "Sufficient balance. Skipping funding."
fi