import { createPublicClient, http, parseAbiItem } from 'viem';

const client = createPublicClient({
  chain: {
    id: 589,
    name: 'LadyChain',
    nativeCurrency: { name: 'Lady', symbol: 'LADY', decimals: 18 },
    rpcUrls: { default: { http: ['https://ladyrpc.us'] } },
  },
  transport: http(),
});

const pairAddress = '0xe1afb1fdd81196a6ffb4217d99981484d4903fac';

async function main() {
  const currentBlock = await client.getBlockNumber();
  console.log('Current block:', currentBlock.toString());

  // Search logs in blocks going backward in chunks
  const CHUNK_SIZE = 2000n;
  let toBlock = currentBlock;
  let txHashes = [];

  for (let i = 0; i < 50; i++) {
    const fromBlock = toBlock - CHUNK_SIZE + 1n;
    try {
      const logs = await client.getLogs({
        address: pairAddress,
        event: parseAbiItem('event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)'),
        fromBlock,
        toBlock,
      });

      if (logs.length > 0) {
        for (const log of logs) {
          txHashes.push(log.transactionHash);
          if (txHashes.length >= 10) break;
        }
      }
    } catch (err) {
      // ignore range errors
    }
    if (txHashes.length >= 10) break;
    toBlock = fromBlock - 1n;
  }

  console.log(`Found ${txHashes.length} recent swap transaction hashes.`);
  for (const hash of txHashes) {
    const tx = await client.getTransaction({ hash });
    console.log(`TX Hash: ${hash}`);
    console.log(`  Gas Price: ${tx.gasPrice ? (Number(tx.gasPrice) / 1e9).toString() + ' Gwei' : 'N/A'}`);
    console.log(`  Type: ${tx.type}`);
    if (tx.maxFeePerGas) {
      console.log(`  Max Fee Per Gas: ${(Number(tx.maxFeePerGas) / 1e9).toString()} Gwei`);
    }
    if (tx.maxPriorityFeePerGas) {
      console.log(`  Max Priority Fee Per Gas: ${(Number(tx.maxPriorityFeePerGas) / 1e9).toString()} Gwei`);
    }
  }
}

main().catch(console.error);
