import { JsonRpcProvider, Contract } from 'ethers';

class ContractInstance {
    constructor(contractInstance) {
        
        if (!contractInstance) {
            throw new Error("Contract instance cannot be null or undefined.");
        }
        this.contract = contractInstance;
    }

    async genTrade(proof, inputs) {
        
        if (!Array.isArray(proof) || proof.length !== 8) {
            throw new Error('Invalid proof: Must be an array of length 8.');
        }
        if (!Array.isArray(inputs) || inputs.length !== 17) {
            throw new Error('Invalid inputs: Must be an array of length 17.');
        }

        
        if (!this.contract) {
            throw new Error("Contract has not been initialized");
        }

        try {
            // 컨트랙트 함수 호출 및 트랜잭션 전송
            // .send()는 Ethers.js v5에서 트랜잭션을 보내는 메서드였으나,
            // Ethers.js v6에서는 write 함수를 직접 호출하고 await 합니다.
            // 따라서 '.send()'를 제거하고, 'orderContent'가 컨트랙트의 쓰기 함수(상태 변경)라면 직접 호출합니다.
            // 만약 'orderContent'가 읽기 함수(상태 변경 없음)라면 '.call()' 또는 그냥 호출합니다.
            // 여기서는 'orderContent'가 상태를 변경하는 함수라고 가정하고, v6 문법으로 수정합니다.
            const txResponse = await this.contract.orderContent(proof, inputs);

            // 트랜잭션 영수증 대기 (트랜잭션이 블록에 포함될 때까지 기다림)
            const receipt = await txResponse.wait();

            if (!receipt) {
                throw new Error('Transaction sent, but no receipt returned.');
            }

            // if (receipt.status === 0) { // Ethers v5
            if (receipt.status !== 1) { // Ethers v6: status 1은 성공, 0은 실패
                throw new Error(`Transaction failed with status: ${receipt.status}. Transaction hash: ${receipt.transactionHash}`);
            }

            return receipt;
        } catch (error) {
            console.error("Error during contractGenTrade (orderContent call):", error);
            throw error;
        }
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