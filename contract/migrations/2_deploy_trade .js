var fs = require('fs');

const Trade = artifacts.require("Trade");
const MiMC7 = artifacts.require('MiMC7');
const Groth16AltBN128 = artifacts.require('Groth16AltBN128');

function hexToDex(hexStr){
  if(hexStr.slice(0,2) !== '0x'){
      return BigInt('0x' + hexStr).toString();
  }
  return BigInt(hexStr).toString();
}

// const crsPath= process.cwd()+'/../../crs/'

// const RegistDataVkJson = JSON.parse(fs.readFileSync(crsPath+'RegistData_crs_vk.json'));
// const GenTradeVkJson   = JSON.parse(fs.readFileSync(crsPath+'GenTrade_crs_vk.json'));
// const AcceptTradeVKJson= JSON.parse(fs.readFileSync(crsPath + 'AcceptTrade_crs_vk.json'));

// let vk_RegistData = [];
// let vk_GenTrade   = [];
// let vk_AcceptTrade= [];
// for (let i = 0; i < 2; i++) {
//     vk_RegistData.push(hexToDex(RegistDataVkJson['alpha'][i]))
//     vk_GenTrade.push(hexToDex(GenTradeVkJson['alpha'][i]))
//     vk_AcceptTrade.push(hexToDex(AcceptTradeVKJson['alpha'][i]))
// }

// // reversed
// for (let i = 0; i < 4; i++) {
//     vk_RegistData.push(hexToDex(RegistDataVkJson['beta'][Number.parseInt(i / 2)][(i+1) % 2]))
//     vk_GenTrade.push(hexToDex(GenTradeVkJson['beta'][Number.parseInt(i / 2)][(i+1) % 2]))
//     vk_AcceptTrade.push(hexToDex(AcceptTradeVKJson['beta'][Number.parseInt(i / 2)][(i+1) % 2]))
// }

// // reversed
// for (let i = 0; i < 4; i++) {
//     vk_RegistData.push(hexToDex(RegistDataVkJson['delta'][Number.parseInt(i / 2)][(i+1) % 2]))
//     vk_GenTrade.push(hexToDex(GenTradeVkJson['delta'][Number.parseInt(i / 2)][(i+1) % 2]))
//     vk_AcceptTrade.push(hexToDex(AcceptTradeVKJson['delta'][Number.parseInt(i / 2)][(i+1) % 2]))
// }

// // console.log("ABC len : ", vkJson['ABC'].length)
// for (let i = 0; i < RegistDataVkJson['ABC'].length*2; i++) {
//     vk_RegistData.push(hexToDex(RegistDataVkJson['ABC'][Number.parseInt(i / 2)][i % 2]))
// }

// for (let i=0; i < GenTradeVkJson['ABC'].length*2; i++){
//     vk_GenTrade.push(hexToDex(GenTradeVkJson['ABC'][Number.parseInt(i / 2)][i % 2]))
// }

// for (let i=0; i < AcceptTradeVKJson['ABC'].length*2; i++){
//     vk_AcceptTrade.push(hexToDex(AcceptTradeVKJson['ABC'][Number.parseInt(i / 2)][i % 2]))
// }

// console.log('vk_GenTrade : ', vk_GenTrade)
// console.log('vk_RegistData : ', vk_RegistData)

module.exports = function (deployer) {
  deployer.deploy(Groth16AltBN128);
  deployer.deploy(MiMC7);
  deployer.link(Groth16AltBN128, Trade);
  deployer.link(MiMC7, Trade);

  deployer.deploy(Trade);
};