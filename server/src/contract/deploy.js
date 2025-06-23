import fs from "fs";
import Web3 from "web3";
import {contractsBuildPath,ganacheNetwork} from "../config/config";

// 1. Ganache-CLI 연결
const ContractJson = JSON.parse(fs.readFileSync(contractsBuildPath + 'Trade.json', 'utf-8'));
const abi = ContractJson.abi;
const bytecode = ContractJson.bytecode;

export const web3 = new Web3(ganacheNetwork.testProvider);
export const contractInstance = new web3.eth.Contract(abi);
export let tradeContract = undefined;

// 3. 배포 함수
export async function deploy() {
    try {
        const accounts = await web3.eth.getAccounts();
        const deployedContract = await contractInstance
            .deploy({ 
                data: "0x" + bytecode,
                // arguments : [
                //     getContractFormatVk('RegistData'), 
                //     getContractFormatVk('GenTrade'),
                //     getContractFormatVk('AcceptTrade')
                // ]
             })
            .send({
                from: accounts[0],
                gas: 3000000,
                gasPrice: 1
            });
        
        tradeContract = deployedContract;
        console.log("✅ contract 배포 완료! 주소:", deployedContract.options.address);
    } catch (error) {
        console.log("deploy:", error);
    }
}
