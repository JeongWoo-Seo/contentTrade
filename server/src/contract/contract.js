import {web3,tradeContract,serverAccountAddress} from "./deploy";
import {ganacheNetwork} from "../config/config"

export async function registData(proof,inputs) {
    if (proof.length != 8) {
        console.log('invalid proof length');
        return false;
    }
    if (inputs.length != 5) {
        console.log('invalid inputs length');
        return false;
    }
    const receipt = await tradeContract.methods.registContent(proof, inputs).send({
                    from: serverAccountAddress,
                    gas: 3000000,
                    gasPrice: ganacheNetwork.gasPrice
                });
    
    return receipt;
}

export async function genTrade(proof,inputs) {
    if (proof.length != 8) {
        console.log('invalid proof length');
        return false;
    }
    if (inputs.length != 17) {
        console.log('invalid inputs length');
        return false;
    }

    const receipt = await tradeContract.methods.orderContent(proof,inputs).send({
        from: serverAccountAddress,
        gas: 3000000,
        gasPrice: ganacheNetwork.gasPrice
    });

    return receipt;
}

export async function acceptTrade(proof,inputs) {
    if (proof.length != 8) {
        console.log('invalid proof length');
        return false;
    }
    if (inputs.length != 6) {
        console.log('invalid inputs length');
        return false;
    }

    const receipt = await tradeContract.methods.acceptOrder(proof,inputs).send({
        from: serverAccountAddress,
        gas: 3000000,
        gasPrice: ganacheNetwork.gasPrice
    });

    return receipt;
}