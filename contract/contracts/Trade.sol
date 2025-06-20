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

    address public owner;

    // h_ct list
    mapping(uint256 => bool) internal _hCT_list;
    // order number -> order
    mapping(bytes32 => Order) _order;
    // waitting for accept
    mapping(uint256 => bool) waitTradeList;
    
    //  SNARK vk
    uint256[] private registContent_vk;
    uint256[] private orderContent_vk;
    uint256[] private acceptOrder_vk;

    constructor(
        uint256[] memory _registContent_vk,
        uint256[] memory _orderContent_vk,
        uint256[] memory _acceptOrder_vk
    ){
        owner = msg.sender;
        registContent_vk = _registContent_vk;
        orderContent_vk  = _orderContent_vk;
        acceptOrder_vk = _acceptOrder_vk;
    }

    function registContent() public {

    }

    function orderContent() public {

    }

    function acceptOrder() public {

    }

}