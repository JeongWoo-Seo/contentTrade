import { web3, tradeContract,serverAccountAddress } from "./deploy";
import { ganacheNetwork } from "../config/config"

export async function contractRegistData(proof, inputs) {
    if (proof.length != 8) {
        console.log('invalid proof length');
        return null;
    }
    if (inputs.length != 5) {
        console.log('invalid inputs length');
        return null;
    }
    try {
        const receipt = await tradeContract.methods.registContent(proof, inputs).send({
            from: serverAccountAddress,
            gas: 3000000,
            gasPrice: ganacheNetwork.gasPrice
        });

        if (!receipt) {
            throw new Error('No receipt returned from contract call');
        }

        return receipt;
    } catch (error) {
        console.log("registData 오류: ", error);
        throw error;
    }
}

export async function contractGenTrade(proof, inputs) {
    if (proof.length != 8) {
        console.log('invalid proof length');
        return null;
    }
    if (inputs.length != 17) {
        console.log('invalid inputs length');
        return null;
    }

    try {
        const receipt = await tradeContract.methods.orderContent(proof, inputs).send({
            from: serverAccountAddress,
            gas: 3000000,
            gasPrice: ganacheNetwork.gasPrice
        });

        if (!receipt) {
            throw new Error('No receipt returned from contract call');
        }

        return receipt;
    } catch (error) {
        console.log("genTrade 오류: ", error);
        throw error;
    }
}

export async function contractAcceptTrade(proof, inputs) {
    if (proof.length != 8) {
        console.log('invalid proof length');
        return null;
    }
    if (inputs.length != 6) {
        console.log('invalid inputs length');
        return null;
    }

    try {
        const receipt = await tradeContract.methods.acceptOrder(proof, inputs).send({
            from: serverAccountAddress,
            gas: 3000000,
            gasPrice: ganacheNetwork.gasPrice
        });

        if (!receipt) {
            throw new Error('No receipt returned from contract call');
        }

        return receipt;
    } catch (error) {
        console.log("acceptTrade 오류: ", error);
        throw error;
    }
}

export async function getTransaction(tx_hash) {
    try {
        const transaction = await web3.eth.getTransaction(tx_hash);

        if (!transaction) {
            return null;
        }

        return transaction;
    } catch (error) {
        console.error("getTransaction 오류:", error);
        throw error;
    }
}
