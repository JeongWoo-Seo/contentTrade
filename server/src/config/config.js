export const homePath = '/Users/sjw/project/contentTrade';

//crs
export const crsPath = homePath + `/crs`;

//server
export const fileStorePath = homePath + `/server/fileDb/`;
export const snarkPath = fileStorePath;

//contract
export const contractsBuildPath = homePath + `/contract/build/contracts/`;
export const ganacheAccountKeyPath = homePath + `/contract/keys.json`;

export const accountAddressList = [];

//ganache
export const ganacheNetwork ={
    networkId       : '1337',
    testProvider    : 'http://127.0.0.1:7545', // ganache link
    gasPrice        : 1,
    gas             : 3000000
}