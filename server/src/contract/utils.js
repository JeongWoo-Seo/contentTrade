/* global BigInt */
import {crsPath, fileStorePath} from "../config/config";
import fs from 'fs';

export function getVk(circuitName='RegistData'){
    return JSON.parse(
        fs.readFileSync(crsPath + circuitName + '_crs_vk.json', 'utf-8')
    );
}

export function getProof(hCt, circuitType){
    const proofJson = JSON.parse(
        fs.readFileSync(fileStorePath+circuitType+'_' + hCt + '_proof.json', 'utf-8')
    )
    return proofFlat(proofJson);
}

export function getContractProof(proofId, circuitType){
    const proofJson = JSON.parse(
        fs.readFileSync(fileStorePath+circuitType+'_' + proofId + '_proof.json', 'utf-8')
    )
    return proofFlat(proofJson);
}

export function getContractFormatVk(circuitName='RegistData'){
    const vkJson = getVk(circuitName);
    let tmp = [];
    for (let i = 0; i < 2; i++) {
      tmp.push(hexToDec(vkJson['alpha'][i]))
    }
    
    // reversed
    for (let i = 0; i < 4; i++) {
      tmp.push(hexToDec(vkJson['beta'][Number.parseInt(i / 2)][(i+1) % 2]))
    }
    
    // reversed
    for (let i = 0; i < 4; i++) {
      tmp.push(hexToDec(vkJson['delta'][Number.parseInt(i / 2)][(i+1) % 2]))
    }
    
    // console.log("ABC len : ", vkJson['ABC'].length)
    for (let i = 0; i < vkJson['ABC'].length*2; i++) {
      tmp.push(hexToDec(vkJson['ABC'][Number.parseInt(i / 2)][i % 2]))
    }
    const vk = tmp;
    console.log(circuitName, 'vk len : ', vk.length);
    return vk;
}

/**
 * 
 * @param {String} hexStr 
 * @returns {String}  hex to Dec
 * 
 */
export function hexToDec(hexStr) {
    if (hexStr.slice(0, 2) !== '0x') {
        return BigInt('0x' + hexStr).toString();
    }
    return BigInt(hexStr).toString();
}

/**
 * 
 * @param {JSON} proofJson 
 * @returns {Array}
 * 
 */
export function proofFlat(proofJson) {
    let tmp = []
    try{
        for (let i = 0; i < 2; i++) {
            tmp.push(hexToDec(proofJson['a'][i]));
        }
        for (let i = 0; i < 4; i++) {
            tmp.push(hexToDec(proofJson['b'][Number.parseInt(i / 2)][(i + 1) % 2]));
        }
        for (let i = 0; i < 2; i++) {
            tmp.push(hexToDec(proofJson['c'][i]));
        }
        return tmp;
    }
    catch(err){
        console.log(err.message);
        return null;
    } 
}


export function registDataInputJsonToContractFormat(inputJson) {
    let tmp = ['1']
    tmp.push(hexToDec(inputJson['pk_own']));
    tmp.push(hexToDec(inputJson['h_k']));
    tmp.push(hexToDec(inputJson['h_ct']));
    tmp.push(hexToDec(inputJson['id_data']));
    const contractInput = tmp;

    return contractInput
}

export function acceptTradeInputJsonToContractFormat(inputJson) {
    let tmp = ['1']
    tmp.push(hexToDec(_.get(inputJson, 'cm_del')))
    tmp.push(hexToDec(_.get(inputJson, 'cm_own')))

    const ecryptedDataEncKey = _.get(inputJson, 'ecryptedDataEncKey')
    for(let i=0; i<3; i++)
        tmp.push(hexToDec(ecryptedDataEncKey[i]))
    
    return tmp
}

const contractUtils = {
    hexToDec,
    proofFlat,
    getContractFormatVk,
};

export default contractUtils;