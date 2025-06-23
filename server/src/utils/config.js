/* global BigInt */

const GANACHE = 0
const SEPOLIA = 1

var Config = {
    dataBlockNum    : '530',
    dataMaxBlockNum : '530',
    maxIdLen        : 32,

    serializeFormat : 3,
    EC_TYPE         : 'EC_ALT_BN128',
    R1CS_GG         : 1,
    R1CS_ROM_SE     : 2,

    EC_ALT_BN128    : 1,
    EC_BLS12_381    : 2,

    keys            : {
        sk_enc          : undefined,
        pk_enc          : undefined,
        sk_own          : undefined,
        pk_own          : undefined,
        addr            : undefined
    }
    
}

export default Config;