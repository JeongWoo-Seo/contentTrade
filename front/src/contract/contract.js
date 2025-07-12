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

async function createContractInstance(GANACHE_URL, contractJson,contractAddress,walletAccount) {
    try {
        // Provider 설정 (Ganache CLI에 연결)
        const provider = new JsonRpcProvider(GANACHE_URL);

        // signer 설정
        const signer = await provider.getSigner(walletAccount); 
    
        if (!signer) {
            throw new Error("can't get signer");
        }
        console.log()
        // Contract 인스턴스 생성
        const contract = new Contract(
            contractAddress,
            contractJson,
            signer
        );

        // 완전히 초기화된 ContractInstance 객체 반환
        return new ContractInstance(contract);

    } catch (error) {
        console.error("ContractInstance 생성 중 오류 발생:", error);
        throw error;
    }
}

export { createContractInstance };