// SPDX-License-Identifier: MIT
pragma solidity ^0.5.16;

interface IRegistry {
  function registry(bytes32 _name) external view returns (address);

  function requireAndGetAddress(bytes32 _name) external view returns (address);

  function getAddress(bytes32 _bytes) external view returns (address);

  function getAddressByString(string calldata _name) external view returns (address);

  function stringToBytes32(string calldata _string) external pure returns (bytes32);
}
