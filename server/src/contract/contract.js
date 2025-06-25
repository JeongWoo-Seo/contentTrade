import { web3, tradeContract, serverAccountAddress } from "./deploy";
import { ganacheNetwork } from "../config/config"

export async function registData(proof, inputs) {
    if (proof.length != 8) {
        console.log('invalid proof length');
        return { flag: false };
    }
    if (inputs.length != 5) {
        console.log('invalid inputs length');
        return { flag: false };
    }
    try {
        const receipt = await tradeContract.methods.registContent(proof, inputs).send({
            from: serverAccountAddress,
            gas: 3000000,
            gasPrice: ganacheNetwork.gasPrice
        });

        if (!receipt) {
            return { flag: false };
        }

        return { flag: true, receipt: receipt };
    } catch (error) {
        console.log("registData 오류: ", error);
        return { flag: false };
    }
}

export async function genTrade(proof, inputs) {
    if (proof.length != 8) {
        console.log('invalid proof length');
        return { flag: false };
    }
    if (inputs.length != 17) {
        console.log('invalid inputs length');
        return { flag: false };
    }

    try {
        const receipt = await tradeContract.methods.orderContent(proof, inputs).send({
            from: serverAccountAddress,
            gas: 3000000,
            gasPrice: ganacheNetwork.gasPrice
        });

        if (!receipt) {
            return { flag: false };
        }

        return { flag: true, receipt: receipt };
    } catch (error) {
        console.log("genTrade 오류: ", error);
        return { flag: false };
    }
}

export async function acceptTrade(proof, inputs) {
    if (proof.length != 8) {
        console.log('invalid proof length');
        return { flag: false };
    }
    if (inputs.length != 6) {
        console.log('invalid inputs length');
        return { flag: false };
    }

    try {
        const receipt = await tradeContract.methods.acceptOrder(proof, inputs).send({
            from: serverAccountAddress,
            gas: 3000000,
            gasPrice: ganacheNetwork.gasPrice
        });

        if (!receipt) {
            return { flag: false };
        }

        return { flag: true, receipt: receipt };
    } catch (error) {
        console.log("acceptTrade 오류: ", error);
        return { flag: false };
    }
}