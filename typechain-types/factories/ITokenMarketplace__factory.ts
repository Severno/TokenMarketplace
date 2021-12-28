/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import { Provider } from "@ethersproject/providers";
import type {
  ITokenMarketplace,
  ITokenMarketplaceInterface,
} from "../ITokenMarketplace";

const _abi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "_msgSender",
        type: "address",
      },
    ],
    name: "AllBidsCanceled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "_msgSender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_index",
        type: "uint256",
      },
    ],
    name: "BidCanceled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "_msgSender",
        type: "address",
      },
    ],
    name: "BidClosed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "_msgSender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_price",
        type: "uint256",
      },
    ],
    name: "BidCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "_msgSender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_price",
        type: "uint256",
      },
    ],
    name: "BuyToken",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint8",
        name: "_round",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_tradeAmount",
        type: "uint256",
      },
    ],
    name: "EndSaleRound",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint8",
        name: "_round",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_tradeAmount",
        type: "uint256",
      },
    ],
    name: "EndTradeRound",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "_msgSender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "referral",
        type: "address",
      },
    ],
    name: "Registered",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint8",
        name: "_round",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_minted",
        type: "uint256",
      },
    ],
    name: "StartSaleRound",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "_msgSender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "_seller",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_price",
        type: "uint256",
      },
    ],
    name: "Trade",
    type: "event",
  },
];

export class ITokenMarketplace__factory {
  static readonly abi = _abi;
  static createInterface(): ITokenMarketplaceInterface {
    return new utils.Interface(_abi) as ITokenMarketplaceInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): ITokenMarketplace {
    return new Contract(address, _abi, signerOrProvider) as ITokenMarketplace;
  }
}