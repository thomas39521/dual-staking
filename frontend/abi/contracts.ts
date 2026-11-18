// frontend/abi/contracts.ts
export const STAKE_TOKEN_ADDRESS = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
export const REWARD_TOKEN_ADDRESS = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
export const STAKING_POOL_ADDRESS = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";

export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ type: "bool" }]
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ type: "uint256" }]
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }]
  }
] as const;

export const STAKING_POOL_ABI = [
  {
    name: "stake",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_amount", type: "uint256" },
      { name: "_sMode", type: "uint8" },
      { name: "_rMode", type: "uint8" }
    ],
    outputs: []
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_wMode", type: "uint8" }],
    outputs: []
  },
  {
    name: "calculateReward",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_user", type: "address" }],
    outputs: [{ type: "uint256" }]
  },
  {
    name: "positions",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "amount", type: "uint256" },
      { name: "startTime", type: "uint256" },
      { name: "lastClaimTime", type: "uint256" },
      { name: "stakeMode", type: "uint8" },
      { name: "rewardMode", type: "uint8" },
      { name: "active", type: "bool" }
    ]
  }
] as const;