import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { LADY_REWARDS_ADDRESS, LADY_REWARDS_ABI, INDEXER_URL } from '../config.js';

export default function ClaimButton({ week }) {
  const { address, isConnected } = useAccount();
  const [claimData, setClaimData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const prevWeek = week - 1;

  const { data: alreadyClaimed } = useReadContract({
    address: LADY_REWARDS_ADDRESS,
    abi: LADY_REWARDS_ABI,
    functionName: 'claimed',
    args: [BigInt(prevWeek), address],
    query: { enabled: isConnected && !!address },
  });

  const { writeContract, isPending, isSuccess, error: writeError } = useWriteContract();

  useEffect(() => {
    if (!isConnected || !address) return;
    setLoading(true);
    setError(null);
    fetch(`${INDEXER_URL}/claim/${prevWeek}/${address}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setClaimData)
      .catch(() => setClaimData(null))
      .finally(() => setLoading(false));
  }, [address, isConnected, prevWeek]);

  const handleClaim = () => {
    if (!claimData) return;
    writeContract({
      address: LADY_REWARDS_ADDRESS,
      abi: LADY_REWARDS_ABI,
      functionName: 'claim',
      args: [
        BigInt(prevWeek),
        BigInt(claimData.reward),
        claimData.isCrown,
        BigInt(claimData.largestSingleBuy ?? '0'),
        claimData.signature,
      ],
    });
  };

  const lrp = (n) => n ? (BigInt(n) / 10n ** 18n).toLocaleString() : '0';

  if (!isConnected) return null;
  if (loading) return <div style={styles.status}>Checking rewards…</div>;

  if (alreadyClaimed) {
    return <div style={styles.claimed}>Reward for week {prevWeek} already claimed ✓</div>;
  }

  if (!claimData) {
    return (
      <div style={styles.noReward}>
        No reward to claim for last week. Keep buying to rank up! 🌊
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div style={styles.success}>
        {claimData.isCrown && <div style={styles.crownWin}>👑 Lady Crown Claimed!</div>}
        <div>Claimed {lrp(claimData.reward)} LRP successfully!</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.rewardInfo}>
        {claimData.isCrown && <div style={styles.crownTag}>👑 Lady Crown Winner</div>}
        <div style={styles.rewardAmount}>{lrp(claimData.reward)} LRP</div>
        <div style={styles.rewardLabel}>Available to claim from Week {prevWeek}</div>
      </div>
      <button onClick={handleClaim} disabled={isPending} style={styles.button}>
        {isPending ? 'Claiming…' : 'Claim Reward'}
      </button>
      {writeError && <div style={styles.error}>{writeError.shortMessage ?? 'Transaction failed'}</div>}
    </div>
  );
}

const styles = {
  container: {
    background: 'linear-gradient(135deg, rgba(251,191,36,0.1), rgba(192,132,252,0.1))',
    border: '1px solid rgba(251,191,36,0.4)',
    borderRadius: 16,
    padding: 24,
    textAlign: 'center',
    marginBottom: 32,
  },
  rewardInfo: { marginBottom: 16 },
  crownTag: {
    fontSize: 13,
    color: '#fbbf24',
    letterSpacing: 2,
    marginBottom: 8,
    fontFamily: 'Orbitron, sans-serif',
  },
  rewardAmount: {
    fontFamily: 'Orbitron, sans-serif',
    fontSize: 32,
    fontWeight: 900,
    color: '#fbbf24',
    marginBottom: 4,
  },
  rewardLabel: { color: '#a78bfa', fontSize: 13 },
  button: {
    background: 'linear-gradient(135deg, #7c3aed, #a21caf)',
    border: 'none',
    borderRadius: 12,
    padding: '14px 40px',
    color: '#fff',
    fontFamily: 'Orbitron, sans-serif',
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: 2,
    cursor: 'pointer',
    boxShadow: '0 0 20px rgba(124,58,237,0.5)',
  },
  status: { color: '#6b7280', textAlign: 'center', padding: 16, fontSize: 13 },
  claimed: { color: '#34d399', textAlign: 'center', padding: 16, fontSize: 14 },
  noReward: { color: '#6b7280', textAlign: 'center', padding: 16, fontSize: 14 },
  success: {
    color: '#34d399',
    textAlign: 'center',
    padding: 24,
    fontSize: 16,
    fontWeight: 600,
  },
  crownWin: { fontSize: 24, marginBottom: 8 },
  error: { color: '#f87171', marginTop: 12, fontSize: 13 },
};
