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
    default: { name: 'LadyScan', url: 'https://ladyscan.us' },
  },
};

export const LRP_ADDRESS = '0x0F7418A346D88E12eC93337998EE0e9d2365fd12';
export const WLADY_ADDRESS = '0x1bb40d060eC9252fb8b0188F74Ed026a66A703D4';
export const LADY_REWARDS_ADDRESS = '0x92d7e7d72CCe3616D13509cb31711890AD264438';

export const INDEXER_URL = 'https://ladyripple-website-production.up.railway.app';


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

export const LADYSWAP_ROUTER_ADDRESS = '0xde4b9879b56187d13b2c41da24c72ff100a5ac9a';

export const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
];

export const LADYSWAP_ROUTER_ABI = [
  {
    name: 'getAmountsOut',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    name: 'swapExactETHForTokens',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    name: 'swapExactTokensForETH',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
];

