// ── Fill these in before deploying ────────────────────────────────────────────

export const CHAIN_ID = 589;

export const LADYCHAIN = {
  id: CHAIN_ID,
  name: 'LadyChain',
  nativeCurrency: { name: 'Lady', symbol: 'LADY', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://ladyrpc.us'] },
  },
  blockExplorers: {
    default: { name: 'LadyScan', url: 'https://scan.ladychain.io' }, // Update if different
  },
};

export const LRP_ADDRESS = '0x0F7418A346D88E12eC93337998EE0e9d2365fd12';
export const LADY_REWARDS_ADDRESS = '0x92d7e7d72CCe3616D13509cb31711890AD264438';

export const INDEXER_URL = 'http://localhost:3001'; // Replace with deployed indexer URL

export const LADY_REWARDS_ABI = [
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'week', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'isCrown', type: 'bool' },
      { name: 'buyAmount', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'claimed',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'week', type: 'uint256' },
      { name: 'address', type: 'address' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'currentCrown',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'holder', type: 'address' },
      { name: 'week', type: 'uint256' },
      { name: 'buyAmount', type: 'uint256' },
    ],
  },
  {
    name: 'rewardPoolBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
];
