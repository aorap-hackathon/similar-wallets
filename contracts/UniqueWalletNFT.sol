// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";


contract UniqueWalletNFT is ERC721, Ownable {
    using Counters for Counters.Counter;
    using ECDSA for bytes32;

    Counters.Counter private _tokenIds;
    address public signerAddress;
    mapping(address => bool) public hasMinted;

    // Update the constructor to pass `msg.sender` to Ownable
    constructor(string memory name, string memory symbol) 
        ERC721(name, symbol) 
        Ownable(msg.sender) // Pass `msg.sender` as initial owner implicitly
    {
        signerAddress = msg.sender;
    }

    function mintNFT(address recipient, bytes memory signature) public {
        require(!hasMinted[recipient], "Address has already minted an NFT");
        
        bytes32 messageHash = keccak256(abi.encodePacked(recipient));

        address recoveredSigner = ECDSA.recover(MessageHashUtils.toEthSignedMessageHash(messageHash), signature);
        
        require(recoveredSigner == signerAddress, "Invalid signature");

        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();
        _safeMint(recipient, newItemId);
        
        hasMinted[recipient] = true;
    }

    function setSignerAddress(address _signerAddress) public onlyOwner {
        signerAddress = _signerAddress;
    }
}
