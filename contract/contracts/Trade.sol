// SPDX-License-Identifier: LGPL-3.0+
pragma solidity ^0.8.2;

import "./Groth16AltBN128.sol";
import "./MiMC7.sol";

contract Trade {

    struct Order {
        address orderer;
        uint256 cm_pear;
        uint256 cm_del;
    }

    event orderLog(address sender,uint256 c0,uint256 c1,uint256[] c2);

    address public owner;

    // h_ct list
    mapping(uint256 => bool) private h_ct_list;
    // order number -> order
    mapping(bytes32 => Order) orderList;
    // waitting for accept
    mapping(uint256 => bool) waitTradeList;
    
    //  SNARK vk
    uint256[] private registContent_vk;
    uint256[] private orderContent_vk;
    uint256[] private acceptOrder_vk;

    // registData SNARK Proof verify input num
    uint256 private constant REGISTDATA_NUM_INPUTS = 5;
    // GenTrade SNARK Proof verify input num
    uint256 private constant ORDER_NUM_INPUTS = 17;
    // AcceptTrade SNARK Proof verify input num
    uint256 private constant ACCEPT_NUM_INPUTS = 6;

    constructor(
//        uint256[] memory _registContent_vk,
//        uint256[] memory _orderContent_vk,
//        uint256[] memory _acceptOrder_vk
    ){
        owner = msg.sender;
        //registContent_vk = _registContent_vk;
        //orderContent_vk  = _orderContent_vk;
        //acceptOrder_vk = _acceptOrder_vk;
    }

    //function registContent( uint256[REGISTDATA_NUM_INPUTS] memory inputs)
    function registContent( uint256[] memory proof, uint256[REGISTDATA_NUM_INPUTS] memory inputs)  
        public  
        returns(bool)
    {   
        // check input length
        require( inputs.length == REGISTDATA_NUM_INPUTS, "invalid Input length");
        
        // check hct
        require( !h_ct_list[inputs[3]], "already registered h_ct");

        // uint256[] memory input_values = new uint256[](REGISTDATA_NUM_INPUTS);
        // for (uint256 i = 0 ; i < REGISTDATA_NUM_INPUTS; i++) {
        //     input_values[i] = inputs[i];
        // }
        // require( Groth16AltBN128._verify(registContent_vk, proof, input_values), "invalid proof");

        h_ct_list[inputs[3]] = true;
        return h_ct_list[inputs[3]];
    }
    
    // function orderContent( uint256[ORDER_NUM_INPUTS] memory inputs)
    function orderContent( uint256[] memory proof, uint256[ORDER_NUM_INPUTS] memory inputs)
        public
        returns(bool)
    {

        require( inputs.length == ORDER_NUM_INPUTS, "invalid Input length");

        require( !waitTradeList[inputs[3]], "already exist cm_own");
        require( !waitTradeList[inputs[4]], "already exist cm_del");

        // uint256[] memory input_values = new uint256[](ORDER_NUM_INPUTS);
        // for (uint256 i = 0 ; i < ORDER_NUM_INPUTS; i++) {
        //     input_values[i] = inputs[i];
        // }
        // require( Groth16AltBN128._verify(orderContent_vk, proof, input_values), "invalid proof");
        
        // order number
        bytes32 orderNumber = MiMC7._hash(bytes32(inputs[3]), bytes32(inputs[4]));
        orderList[orderNumber].orderer = msg.sender;

        // insert cm to waitTradeList
        waitTradeList[inputs[3]] = true;
        waitTradeList[inputs[4]] = true;
        orderList[orderNumber].cm_pear = inputs[3];
        orderList[orderNumber].cm_del = inputs[4];
        
        // emit log
        uint256[] memory c2 = new uint256[](6);
        for (uint256 i=0; i<6; i++){
            c2[i] = inputs[i+11];
        } 

        emit orderLog(msg.sender,inputs[1],inputs[2],c2);

        return true;
    }

    // function acceptOrder(uint256[ACCEPT_NUM_INPUTS] memory inputs)
    function acceptOrder(uint256[] memory proof,uint256[ACCEPT_NUM_INPUTS] memory inputs)
        public
        returns(bool)
    {
        require(inputs.length == ACCEPT_NUM_INPUTS, "invalid Inputs length");

        // check cm
        require(waitTradeList[inputs[1]], "cm0 no exist");
        require(waitTradeList[inputs[2]], "cm1 no exist");

        // uint256[] memory input_values = new uint256[](ACCEPT_NUM_INPUTS);
        // for (uint256 i = 0 ; i < ACCEPT_NUM_INPUTS; i++) {
        //     input_values[i] = inputs[i];
        // }
        // require( Groth16AltBN128._verify(acceptOrder_vk, proof, input_values), "invalid proof");

        waitTradeList[inputs[1]] = false;
        waitTradeList[inputs[2]] = false;

        return true;
    }

    function checkCmValidation(bytes32 orderNumber)public view returns (bool,bool){
        return (waitTradeList[orderList[orderNumber].cm_pear], waitTradeList[orderList[orderNumber].cm_del]);
    }
}