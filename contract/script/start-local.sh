
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

set -a
source .env
set +a

# 1. 개발용 지갑에 ETH 지급
bash script/fund-local-wallet.sh

# 2. 컨트랙트 배포
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$BLOCKCHAIN_RPC_URL" \
  --broadcast

echo "Local blockchain initialization completed."