import fs from "fs";
import Web3 from "web3";
import { contractsBuildPath, ganacheNetwork,accountAddressList} from "../config/config";
import {getContractFormatVk} from "./utils";

const ContractJson = JSON.parse(fs.readFileSync(contractsBuildPath + 'Trade.json', 'utf-8'));
const { abi, bytecode } = ContractJson;

export const web3 = new Web3(ganacheNetwork.testProvider);
export let tradeContract = undefined;
export let serverAccountAddress = undefined;

export async function initContract() {
    try {
        const contractAddress = await deployContract();
        tradeContract = new web3.eth.Contract(abi, contractAddress);
        console.log("✅ contract 인스턴스 초기화 완료!");
    } catch (err) {
        console.error("initContract 실패:", err);
    }
}

async function deployContract() {
    try {
        const accounts = await web3.eth.getAccounts();

        const contractInstance = new web3.eth.Contract(abi);

        const deployed = await contractInstance
            .deploy({
                data: "0x" + bytecode,
                // arguments: [
                //   getContractFormatVk("RegistData"),
                //   getContractFormatVk("GenTrade"),
                //   getContractFormatVk("AcceptTrade"),
                // ],
            })
            .send({
                from: accounts[0],
                gas: 3000000,
                gasPrice: ganacheNetwork.gasPrice
            });
            
            accountAddressList.splice(0, accountAddressList.length, ...accounts);
            serverAccountAddress = deployed.options.address;
        console.log("✅ contract 배포 완료! 주소:", deployed.options.address);
        return deployed.options.address;
    } catch (error) {
        console.error("❌ deploy 실패:", error);
        throw error;
    }
}