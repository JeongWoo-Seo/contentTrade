export let homePath = '/Users/sjw/project/contentTrade';

//server
export let fileStorePath = homePath + `/server/fileDb/`;

//contract
export let contractsBuildPath = homePath + `/contract/build/contracts/`;
export let ganacheAccountKeyPath = homePath + `/contract/keys.json`;

//ganache
export let ganacheNetwork ={
    networkId       : '1234',
    testProvider    : 'http://127.0.0.1:7545', // ganache link
    gasPrice        : 1,
    gas             : 3000000
}