// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity >=0.7.0 <0.9.0;

contract GenerateTradeVerifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 5900800843891941697359327619982424971088189675754691525997817085873167399881;
    uint256 constant alphay  = 20592081585210308495784949749856532888922490021654464468830977801858887286083;
    uint256 constant betax1  = 16690786764718658597468901121455977752497261479656499012386787421109234330701;
    uint256 constant betax2  = 19645295497785241868520651139927205840652721907830231869139399685683763629222;
    uint256 constant betay1  = 7522713343191254645882681396942219764632410168308786102397769214323884708975;
    uint256 constant betay2  = 18816686513098083256866390637213766080357313178674256392063160913979766643999;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 13427474585830821374805281150938070992210706554280031322454160116022902012876;
    uint256 constant deltax2 = 14726494246042683980750190325382985437441297551829944765762186639818237795039;
    uint256 constant deltay1 = 8024820033679808083193263009797194199718545638474403818396031977466215514272;
    uint256 constant deltay2 = 6614283617911203109933941245748912111288156780575929817520850820566596376363;

    
    uint256 constant IC0x = 13340960775006242589010821211887673734936258862753307196922721758319791621888;
    uint256 constant IC0y = 5923285033098884015281526715024989066340739431622239710734521427590754848427;
    
    uint256 constant IC1x = 5674865952389754167175058244030890553544142488950978727130996043167697292669;
    uint256 constant IC1y = 21323979773613549916859059758316351294155147241920102154690823569348605078196;
    
    uint256 constant IC2x = 19869314253719466830164386126871812851175386653570876422660809127780284765154;
    uint256 constant IC2y = 1013667217286892783185309656552171222622881271820790881870695935771117089419;
    
    uint256 constant IC3x = 20525215291158827775300555246632980281345569145471512880527623524821768267637;
    uint256 constant IC3y = 16692884792628435797661759825175161078469762959892054077452590948210832326321;
    
    uint256 constant IC4x = 21341642052273104964318487987068123654325863951278864646477124326256724850962;
    uint256 constant IC4y = 10887749190691311768306722371947563707837583167169013787732264648257284258084;
    
    uint256 constant IC5x = 17688313303040957604163888444502839969994467065185655371690836915366794035654;
    uint256 constant IC5y = 1275004082573645571777351895581047814075825682402866730196978773528052783037;
    
    uint256 constant IC6x = 4549756126296314380177588070949364368279633022910411552370886390518881570215;
    uint256 constant IC6y = 7036479798086402243999377139762719050171815220367404531487922635548157600081;
    
    uint256 constant IC7x = 19676793846817754729080009047329746075655067469070363988318582214502053285288;
    uint256 constant IC7y = 19457434675014573030278968832678613234662865847233603180953414262741110184313;
    
    uint256 constant IC8x = 17275063652994098411671031021302356024325258324693142579025892754099537196694;
    uint256 constant IC8y = 20842862951487166537145840408327272814141200549389455433053602953028448039518;
    
    uint256 constant IC9x = 8028643673522673846852957198314127348966164665698727382383951400775168271590;
    uint256 constant IC9y = 5418306908845623009811142496375611823399430690050828015650930822381560947043;
    
    uint256 constant IC10x = 20626972332936217664485701043313729631978885412831478755483966075010491083635;
    uint256 constant IC10y = 11378766021811632347182314228020624724085790193365649388456468691440364854584;
    
    uint256 constant IC11x = 19274010243195780035849648530848467013061507738519074522981879572973836761180;
    uint256 constant IC11y = 8530512304839163030681441698702934771892009213531096283107213948064208942088;
    
    uint256 constant IC12x = 8214078495841479787173815054385482813808383856068886775825092926414302485567;
    uint256 constant IC12y = 1173457445933283283460697464761264352826462755665405444468314880559699621263;
    
    uint256 constant IC13x = 16993311374490082756465935230432962492195904533889569248175348367490737541034;
    uint256 constant IC13y = 4470259634959696540906107177133574174022562211527106276147481623977308297607;
    
    uint256 constant IC14x = 7939438051664587884504636748332684031195549403492008586872817639752569044324;
    uint256 constant IC14y = 1532680615900665241145133147402678736647510644652331271737269357787847698208;
    
    uint256 constant IC15x = 18310722616618778707205798391769012656388985459173007642787137938157562751556;
    uint256 constant IC15y = 11643163595333557126073093830906305780373181196378488872732218047458367941298;
    
    uint256 constant IC16x = 6344009388609307415239959448015274811116496487207707610690599903300126809083;
    uint256 constant IC16y = 18698231229460872826938703645484742913300313407313452008232274418115545363753;
    
    uint256 constant IC17x = 16157213854657184738327746376776300424814054732751994951448111320732219917709;
    uint256 constant IC17y = 8510819686079022925642714749367506562650025217331783579853087198238362396822;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[17] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            
            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x
                
                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))
                
                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))
                
                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))
                
                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))
                
                g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))
                
                g1_mulAccC(_pVk, IC6x, IC6y, calldataload(add(pubSignals, 160)))
                
                g1_mulAccC(_pVk, IC7x, IC7y, calldataload(add(pubSignals, 192)))
                
                g1_mulAccC(_pVk, IC8x, IC8y, calldataload(add(pubSignals, 224)))
                
                g1_mulAccC(_pVk, IC9x, IC9y, calldataload(add(pubSignals, 256)))
                
                g1_mulAccC(_pVk, IC10x, IC10y, calldataload(add(pubSignals, 288)))
                
                g1_mulAccC(_pVk, IC11x, IC11y, calldataload(add(pubSignals, 320)))
                
                g1_mulAccC(_pVk, IC12x, IC12y, calldataload(add(pubSignals, 352)))
                
                g1_mulAccC(_pVk, IC13x, IC13y, calldataload(add(pubSignals, 384)))
                
                g1_mulAccC(_pVk, IC14x, IC14y, calldataload(add(pubSignals, 416)))
                
                g1_mulAccC(_pVk, IC15x, IC15y, calldataload(add(pubSignals, 448)))
                
                g1_mulAccC(_pVk, IC16x, IC16y, calldataload(add(pubSignals, 480)))
                
                g1_mulAccC(_pVk, IC17x, IC17y, calldataload(add(pubSignals, 512)))
                

                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations ∈ F
            
            checkField(calldataload(add(_pubSignals, 0)))
            
            checkField(calldataload(add(_pubSignals, 32)))
            
            checkField(calldataload(add(_pubSignals, 64)))
            
            checkField(calldataload(add(_pubSignals, 96)))
            
            checkField(calldataload(add(_pubSignals, 128)))
            
            checkField(calldataload(add(_pubSignals, 160)))
            
            checkField(calldataload(add(_pubSignals, 192)))
            
            checkField(calldataload(add(_pubSignals, 224)))
            
            checkField(calldataload(add(_pubSignals, 256)))
            
            checkField(calldataload(add(_pubSignals, 288)))
            
            checkField(calldataload(add(_pubSignals, 320)))
            
            checkField(calldataload(add(_pubSignals, 352)))
            
            checkField(calldataload(add(_pubSignals, 384)))
            
            checkField(calldataload(add(_pubSignals, 416)))
            
            checkField(calldataload(add(_pubSignals, 448)))
            
            checkField(calldataload(add(_pubSignals, 480)))
            
            checkField(calldataload(add(_pubSignals, 512)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
