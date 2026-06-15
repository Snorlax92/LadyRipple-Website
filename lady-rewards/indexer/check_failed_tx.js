import { createPublicClient, http } from 'viem';

const client = createPublicClient({
  chain: {
    id: 589,
    name: 'LadyChain',
    nativeCurrency: { name: 'Lady', symbol: 'LADY', decimals: 18 },
    rpcUrls: { default: { http: ['https://ladyrpc.us'] } },
  },
  transport: http(),
});

const txHash = '0xf40b3bc2956e53f44d26d2dcf500bc96619c2225aa1c5f829320fe65491d4565';

async function main() {
  const receipt = await client.getTransactionReceipt({ hash: txHash });
  console.log('Transaction Receipt:');
  console.log('  Status:', receipt.status);
  console.log('  Gas Used:', receipt.gasUsed.toString());
  console.log('  Block Number:', receipt.blockNumber.toString());
  
  const tx = await client.getTransaction({ hash: txHash });
  console.log('Transaction Data:');
  console.log('  To:', tx.to);
  console.log('  Value:', tx.value.toString());
  console.log('  Input:', tx.input);

  // Simulate
  try {
    console.log('Simulating transaction...');
    await client.call({
      account: tx.from,
      to: tx.to,
      data: tx.input,
      value: tx.value,
      gasPrice: tx.gasPrice,
      blockNumber: receipt.blockNumber - 1n,
    });
    console.log('Simulation succeeded?!');
  } catch (err) {
    console.log('Simulation reverted with error:', err.message);
  }
}

main().catch(console.error);
