import { JsonRpcProvider, Contract } from 'ethers';

class ContractInstance {
    constructor(contractInstance) {
        this.contract = contractInstance;
    }

    async genOder() {
        if (!this.contract) {
            console.error("Contract is not initialized.");
            return null;
        }
        return await this.contract.get();
    }
}

async function createContractInstance(GANACHE_URL, contractJson, walletAccount) {
    try {
        // Provider 설정 (Ganache CLI에 연결)
        const provider = new JsonRpcProvider(GANACHE_URL);

        // signer 설정
        const signer = await provider.getSigner(walletAccount); 

        // 네트워크 ID 및 배포된 컨트랙트 주소 확인
        const { chainId } = await provider.getNetwork();
        const deployedNetwork = contractJson.networks[chainId];

        if (!deployedNetwork || !deployedNetwork.address) {
            console.error(`컨트랙트가 현재 네트워크 (Chain ID: ${chainId})에 배포되지 않았습니다.`);
            console.log("트러플 마이그레이션이 필요합니다:");
            throw new Error("Contract not deployed on current network.");
        }

        // Contract 인스턴스 생성
        const contract = new Contract(
            deployedNetwork.address,
            contractJson.abi,
            signer
        );

        // 완전히 초기화된 ContractInstance 객체 반환
        return new ContractInstance(contract);

    } catch (error) {
        console.error("ContractInstance 생성 중 오류 발생:", error);
        throw error; // 오류를 다시 던져서 호출자가 처리하도록 함
    }
}

export { createContractInstance };