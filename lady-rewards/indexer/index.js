import 'dotenv/config';
import { DatabaseSync } from 'node:sqlite';
import { createPublicClient, createWalletClient, http, parseAbi, parseAbiItem, keccak256, encodePacked } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// ── SQLite setup (built into Node v22+, no compilation needed) ────────────────
const db = new DatabaseSync('lady-rewards.db');
db.exec('PRAGMA journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS buys (
    tx_hash    TEXT NOT NULL,
    log_index  INTEGER NOT NULL,
    week       INTEGER NOT NULL,
    buyer      TEXT NOT NULL,
    lrp_amount TEXT NOT NULL,
    block_ts   INTEGER NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
  )
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS state (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

const stmtInsertBuy = db.prepare(
  'INSERT OR IGNORE INTO buys (tx_hash, log_index, week, buyer, lrp_amount, block_ts) VALUES (?, ?, ?, ?, ?, ?)'
);
const stmtGetState = db.prepare('SELECT value FROM state WHERE key = ?');
const stmtSetState = db.prepare('INSERT OR REPLACE INTO state (key, value) VALUES (?, ?)');

function getLastBlock() {
  const row = stmtGetState.get('last_block');
  return row ? BigInt(row.value) : null;
}
function setLastBlock(blockNumber) {
  stmtSetState.run('last_block', blockNumber.toString());
}

// ── Chain config ──────────────────────────────────────────────────────────────
const ladyChain = {
  id: Number(process.env.CHAIN_ID || 589),
  name: 'LadyChain',
  nativeCurrency: { name: 'Lady', symbol: 'LADY', decimals: 18 },
  rpcUrls: { default: { http: [process.env.LADYCHAIN_RPC || 'https://ladyrpc.us'] } },
};

const client = createPublicClient({ chain: ladyChain, transport: http() });
const signerAccount = privateKeyToAccount(process.env.SIGNER_PRIVATE_KEY);

// ── ABI ───────────────────────────────────────────────────────────────────────
const pairAbi = parseAbi([
  'event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
]);

const swapEvent = parseAbiItem(
  'event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)'
);

// ── In-memory state ───────────────────────────────────────────────────────────
// weekNumber => Map<address, { totalBought: BigInt, largestSingleBuy: BigInt }>
const weeklyData = new Map();

// ── Week window logic ─────────────────────────────────────────────────────────
// Active window: Sunday 05:00 UTC → Saturday 04:59 UTC
// (= Saturday 9pm PST start → Friday 9pm PST end)
// Dead zone:     Saturday 05:00 UTC → Sunday 04:59 UTC

function isInActiveWindow(timestamp) {
  const d = new Date(Number(timestamp) * 1000);
  const day = d.getUTCDay();
  const hour = d.getUTCHours();
  if (day === 6 && hour >= 5) return false; // Sat ≥ 05:00 UTC
  if (day === 0 && hour < 5)  return false; // Sun < 05:00 UTC
  return true;
}

// Week ID = unix timestamp of the Sunday 05:00 UTC that opened the window
function getWeekNumber(timestamp) {
  const ts = Number(timestamp);
  const d = new Date(ts * 1000);
  const day = d.getUTCDay();
  const hour = d.getUTCHours();
  const secsSinceWindowOpen =
    day * 86400 + hour * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds() - 5 * 3600;
  return Math.floor((ts - ((secsSinceWindowOpen % 604800) + 604800) % 604800) / 604800);
}

function getCurrentWeek() {
  return getWeekNumber(Math.floor(Date.now() / 1000));
}

function getOrCreateWeek(week) {
  if (!weeklyData.has(week)) weeklyData.set(week, new Map());
  return weeklyData.get(week);
}

// ── Buy direction helpers ─────────────────────────────────────────────────────
let token0 = null;

function isLrpBuy(args) {
  const { amount0In, amount1In, amount0Out, amount1Out } = args;
  const lrpIsToken0 = token0.toLowerCase() === process.env.LRP_ADDRESS.toLowerCase();
  return lrpIsToken0
    ? amount0Out > 0n && amount1In > 0n
    : amount1Out > 0n && amount0In > 0n;
}

function getLrpAmountOut(args) {
  const { amount0Out, amount1Out } = args;
  const lrpIsToken0 = token0.toLowerCase() === process.env.LRP_ADDRESS.toLowerCase();
  return lrpIsToken0 ? amount0Out : amount1Out;
}

// ── Apply a validated buy to in-memory state ──────────────────────────────────
function applyBuy(week, buyer, lrpAmount) {
  const weekMap = getOrCreateWeek(week);
  const existing = weekMap.get(buyer) || { totalBought: 0n, largestSingleBuy: 0n };
  weekMap.set(buyer, {
    totalBought: existing.totalBought + lrpAmount,
    largestSingleBuy: lrpAmount > existing.largestSingleBuy ? lrpAmount : existing.largestSingleBuy,
  });
}

// ── Process a single swap log ─────────────────────────────────────────────────
async function processSwap(log, blockTimestamp) {
  if (!isLrpBuy(log.args)) return;
  if (!isInActiveWindow(blockTimestamp)) {
    console.log(`[DEAD ZONE] Buy ignored at ${new Date(Number(blockTimestamp) * 1000).toUTCString()}`);
    return;
  }

  const buyer = log.args.to;
  const lrpAmount = getLrpAmountOut(log.args);
  const week = getWeekNumber(blockTimestamp);

  // Persist first — INSERT OR IGNORE deduplicates automatically
  stmtInsertBuy.run(
    log.transactionHash,
    log.logIndex,
    week,
    buyer,
    lrpAmount.toString(),
    Number(blockTimestamp)
  );

  applyBuy(week, buyer, lrpAmount);

  console.log(`[Week ${week}] Buy: ${buyer} +${(lrpAmount / 10n ** 18n).toLocaleString()} LRP`);
}

// ── Load persisted buys into memory ──────────────────────────────────────────
function loadFromDb() {
  const rows = db.prepare('SELECT week, buyer, lrp_amount FROM buys').all();
  for (const row of rows) {
    applyBuy(row.week, row.buyer, BigInt(row.lrp_amount));
  }
  console.log(`[DB] Loaded ${rows.length} buys from database`);
}

// ── Catch up any blocks missed while the indexer was offline ──────────────────
const CHUNK_SIZE = 2000n;

async function catchUp(fromBlock, toBlock) {
  if (fromBlock > toBlock) return;
  console.log(`[CATCH-UP] Replaying blocks ${fromBlock} → ${toBlock}`);

  const blockCache = new Map();
  let processed = 0;

  for (let from = fromBlock; from <= toBlock; from += CHUNK_SIZE) {
    const to = from + CHUNK_SIZE - 1n < toBlock ? from + CHUNK_SIZE - 1n : toBlock;

    const logs = await client.getLogs({
      address: process.env.PAIR_ADDRESS,
      event: swapEvent,
      fromBlock: from,
      toBlock: to,
    });

    for (const log of logs) {
      if (!blockCache.has(log.blockNumber)) {
        const block = await client.getBlock({ blockNumber: log.blockNumber });
        blockCache.set(log.blockNumber, block.timestamp);
      }
      await processSwap(log, blockCache.get(log.blockNumber));
      processed++;
    }
  }

  console.log(`[CATCH-UP] Done — ${processed} swap events replayed`);
}

// ── Leaderboard builder ───────────────────────────────────────────────────────
function buildLeaderboard(week) {
  const weekMap = weeklyData.get(week);
  if (!weekMap) return { leaderboard: [], crown: null };

  const entries = [...weekMap.entries()].map(([address, data]) => ({
    address,
    totalBought: data.totalBought.toString(),
    largestSingleBuy: data.largestSingleBuy.toString(),
  }));

  entries.sort((a, b) => (BigInt(b.totalBought) > BigInt(a.totalBought) ? 1 : -1));

  const top10 = entries.slice(0, 10);

  const crown = entries.reduce(
    (best, e) =>
      BigInt(e.largestSingleBuy) > BigInt(best?.largestSingleBuy || '0') ? e : best,
    null
  );

  return { leaderboard: top10, crown };
}

// ── Sign a claim ──────────────────────────────────────────────────────────────
async function signClaim(week, address, amount, isCrown, buyAmount) {
  const hash = keccak256(
    encodePacked(
      ['uint256', 'address', 'uint256', 'bool', 'uint256'],
      [BigInt(week), address, BigInt(amount), isCrown, BigInt(buyAmount)]
    )
  );
  const walletClient = createWalletClient({ account: signerAccount, chain: ladyChain, transport: http() });
  return walletClient.signMessage({ message: { raw: hash } });
}

// ── Reward computation ────────────────────────────────────────────────────────
const WEEKLY_REWARD_POOL = BigInt(process.env.WEEKLY_REWARD || '250000') * 10n ** 18n;

async function computeRewards(week) {
  const { leaderboard, crown } = buildLeaderboard(week);
  if (!leaderboard.length) return [];

  const crownReward = (WEEKLY_REWARD_POOL * 30n) / 100n;
  const top10Pool = WEEKLY_REWARD_POOL - crownReward;
  const totalVolume = leaderboard.reduce((s, e) => s + BigInt(e.totalBought), 0n);

  return Promise.all(
    leaderboard.map(async (entry, i) => {
      const share = (BigInt(entry.totalBought) * top10Pool) / totalVolume;
      const isCrown = crown && entry.address.toLowerCase() === crown.address.toLowerCase();
      const total = share + (isCrown ? crownReward : 0n);
      const sig = await signClaim(week, entry.address, total, isCrown, entry.largestSingleBuy);
      return {
        rank: i + 1,
        address: entry.address,
        totalBought: entry.totalBought,
        reward: total.toString(),
        isCrown,
        signature: sig,
      };
    })
  );
}

// ── Startup + live watcher ────────────────────────────────────────────────────
async function start() {
  // 1. Resolve token0 so buy-direction logic works
  token0 = await client.readContract({
    address: process.env.PAIR_ADDRESS,
    abi: pairAbi,
    functionName: 'token0',
  });
  console.log(`Pair: ${process.env.PAIR_ADDRESS} | token0=${token0}`);

  // 2. Rebuild in-memory state from persisted buys
  loadFromDb();

  // 3. Catch up any blocks missed while offline
  const currentBlock = await client.getBlockNumber();
  const lastBlock = getLastBlock();
  if (lastBlock !== null) {
    await catchUp(lastBlock + 1n, currentBlock);
  } else {
    console.log('[CATCH-UP] No prior state — watching from current block only');
  }
  setLastBlock(currentBlock);

  // 4. Watch live events from current block forward
  console.log(`[LIVE] Watching from block ${currentBlock}`);
  client.watchContractEvent({
    address: process.env.PAIR_ADDRESS,
    abi: pairAbi,
    eventName: 'Swap',
    onLogs: async (logs) => {
      for (const log of logs) {
        const block = await client.getBlock({ blockNumber: log.blockNumber });
        await processSwap(log, block.timestamp);
        setLastBlock(log.blockNumber);
      }
    },
  });
}

// ── REST API ──────────────────────────────────────────────────────────────────
const app = express();

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: FRONTEND_ORIGIN }));

// Limit claim signing to 10 requests per IP per minute
const claimLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false });

app.get('/leaderboard', (req, res) => {
  const week = Number(req.query.week) || getCurrentWeek();
  const { leaderboard, crown } = buildLeaderboard(week);
  res.json({ week, leaderboard, crown });
});

app.get('/claim/:week/:address', claimLimiter, async (req, res) => {
  try {
    const week = Number(req.params.week);
    const address = req.params.address;

    const nowTs = Math.floor(Date.now() / 1000);

    // Block claims during dead zone (Friday 9pm PST → Saturday 9pm PST)
    // and block claims for weeks that haven't ended yet.
    // Claims only open once the new week begins (Saturday 9pm PST = Sunday 05:00 UTC).
    if (!isInActiveWindow(nowTs)) {
      return res.status(400).json({ error: 'Claims open Saturday 9pm PST when the new week begins' });
    }
    if (week >= getCurrentWeek()) {
      return res.status(400).json({ error: 'Week not finished yet' });
    }

    const { leaderboard } = buildLeaderboard(week);
    const entry = leaderboard.find((e) => e.address.toLowerCase() === address.toLowerCase());
    if (!entry) return res.status(404).json({ error: 'Not a winner this week' });

    const rewards = await computeRewards(week);
    const reward = rewards.find((r) => r.address.toLowerCase() === address.toLowerCase());
    if (!reward) return res.status(404).json({ error: 'No reward found' });

    res.json(reward);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.get('/crown', (req, res) => {
  const week = getCurrentWeek();
  const { crown } = buildLeaderboard(week);
  res.json({ week, crown });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Lady Rewards indexer on :${PORT}`));
start().catch(console.error);
