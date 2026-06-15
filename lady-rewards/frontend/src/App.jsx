import React, { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useReadContract, useChainId, useSwitchChain } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { INDEXER_URL, LADY_REWARDS_ADDRESS, LADY_REWARDS_ABI, CHAIN_ID } from './config.js';
import CrownHolder from './components/CrownHolder.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import ClaimButton from './components/ClaimButton.jsx';

export default function App() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const onWrongChain = isConnected && chainId !== CHAIN_ID;

  const [leaderboardData, setLeaderboardData] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(null);
  const [refreshAt, setRefreshAt] = useState(Date.now());

  const { data: poolBalance } = useReadContract({
    address: LADY_REWARDS_ADDRESS,
    abi: LADY_REWARDS_ABI,
    functionName: 'rewardPoolBalance',
  });

  useEffect(() => {
    // Let the server resolve the canonical week using its PST boundary logic
    fetch(`${INDEXER_URL}/leaderboard`)
      .then((r) => r.json())
      .then((data) => {
        setLeaderboardData(data);
        setCurrentWeek(data.week); // authoritative week from server
      })
      .catch(() => {});
  }, [refreshAt]);

  // Auto-refresh every 60s
  useEffect(() => {
    const id = setInterval(() => setRefreshAt(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const fmt = (addr) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  const lrp = (n) => n != null ? (BigInt(n.toString()) / 10n ** 18n).toLocaleString() : '—';

  return (
    <div style={styles.root}>
      <div style={styles.bg} />

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <img
            src={`${import.meta.env.BASE_URL}LadyRipple.jpg`}
            alt="LadyRipple"
            style={styles.logoImg}
          />
          <span style={styles.logoText}>LadyRipple</span>
        </div>
        <div style={styles.headerRight}>
          {poolBalance != null && (
            <div style={styles.poolBadge}>
              Pool: {lrp(poolBalance)} LRP
            </div>
          )}
          {isConnected ? (
            <button onClick={() => disconnect()} style={styles.walletBtn}>
              {fmt(address)} ✕
            </button>
          ) : (
            <button
              onClick={() => connect({ connector: injected() })}
              style={{ ...styles.walletBtn, ...styles.connectBtn }}
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* Wrong network banner */}
      {onWrongChain && (
        <div style={styles.networkBanner}>
          Wrong network — you need to be on LadyChain to claim rewards.
          <button
            style={styles.networkBtn}
            onClick={() => switchChain({ chainId: CHAIN_ID })}
          >
            Switch to LadyChain
          </button>
        </div>
      )}

      {/* Hero */}
      <div style={styles.hero}>
        <div style={styles.heroEyebrow}>$LRP · LADYCHAIN</div>
        <h1 style={styles.heroTitle}>She doesn't follow waves.<br />She starts them.</h1>
        <p style={styles.heroSub}>
          Buy $LRP to climb the weekly leaderboard. Top 10 buyers and the Lady Crown winner
          earn LRP rewards every week.
        </p>
      </div>

      {/* Main content */}
      <main style={styles.main}>
        {/* Claim section — only shown when connected and week is resolved */}
        {isConnected && currentWeek != null && <ClaimButton week={currentWeek} />}

        {/* Crown */}
        <CrownHolder
          crown={leaderboardData?.crown}
          week={currentWeek}
        />

        {/* Leaderboard */}
        <Leaderboard
          entries={leaderboardData?.leaderboard}
          week={currentWeek}
        />

        {/* Rules */}
        <div style={styles.rules}>
          <div style={styles.rulesTitle}>HOW IT WORKS</div>
          <div style={styles.rulesList}>
            <div style={styles.rule}>
              <span style={styles.ruleIcon}>🌊</span>
              <span>Buy $LRP on LadySwap — every buy is tracked automatically</span>
            </div>
            <div style={styles.rule}>
              <span style={styles.ruleIcon}>📊</span>
              <span>Top 10 buyers by weekly volume split 70% of the prize pool</span>
            </div>
            <div style={styles.rule}>
              <span style={styles.ruleIcon}>👑</span>
              <span>Biggest single buy earns the Lady Crown + 30% bonus reward</span>
            </div>
            <div style={styles.rule}>
              <span style={styles.ruleIcon}>💎</span>
              <span>Connect your wallet after week ends to claim your LRP rewards</span>
            </div>
          </div>
        </div>
      </main>

      <footer style={styles.footer}>
        <a href="https://ladyripple.xyz/" target="_blank" rel="noreferrer" style={styles.link}>
          ladyripple.xyz
        </a>
        {' · '}
        <a href="https://ladyswap.us/swap" target="_blank" rel="noreferrer" style={styles.link}>
          LadySwap
        </a>
        {' · '}
        <a href="https://ladycharts.online/#/token/0x0f7418a346d88e12ec93337998ee0e9d2365fd12" target="_blank" rel="noreferrer" style={styles.link}>
          LadyCharts
        </a>
      </footer>
    </div>
  );
}

const styles = {
  root: {
    minHeight: '100vh',
    background: '#050011',
    color: '#e2e8f0',
    fontFamily: 'Inter, sans-serif',
    position: 'relative',
    overflowX: 'hidden',
  },
  bg: {
    position: 'fixed',
    inset: 0,
    background:
      'radial-gradient(ellipse at 20% 20%, rgba(124,58,237,0.15) 0%, transparent 60%), ' +
      'radial-gradient(ellipse at 80% 80%, rgba(192,132,252,0.1) 0%, transparent 60%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  header: {
    position: 'relative',
    zIndex: 10,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 32px',
    borderBottom: '1px solid rgba(192,132,252,0.15)',
    backdropFilter: 'blur(12px)',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 12 },
  logoImg: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    objectFit: 'cover',
    boxShadow: '0 0 14px rgba(255,45,155,0.6)',
  },
  logoText: {
    fontFamily: "'Dancing Script', cursive",
    fontSize: 26,
    background: 'linear-gradient(90deg, #ff2d9b, #00d4ff)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  poolBadge: {
    background: 'rgba(251,191,36,0.1)',
    border: '1px solid rgba(251,191,36,0.3)',
    borderRadius: 12,
    padding: '6px 14px',
    fontSize: 12,
    color: '#fbbf24',
    fontFamily: 'Orbitron, sans-serif',
  },
  walletBtn: {
    background: 'rgba(192,132,252,0.1)',
    border: '1px solid rgba(192,132,252,0.4)',
    borderRadius: 12,
    padding: '8px 18px',
    color: '#c084fc',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  connectBtn: {
    background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(162,28,175,0.3))',
    color: '#e879f9',
    fontFamily: 'Orbitron, sans-serif',
    fontSize: 12,
    letterSpacing: 1,
  },
  hero: {
    position: 'relative',
    zIndex: 10,
    textAlign: 'center',
    padding: '64px 24px 48px',
  },
  heroEyebrow: {
    fontFamily: 'Orbitron, sans-serif',
    fontSize: 11,
    letterSpacing: 6,
    color: '#a78bfa',
    marginBottom: 16,
  },
  heroTitle: {
    fontFamily: 'Orbitron, sans-serif',
    fontSize: 'clamp(24px, 5vw, 48px)',
    fontWeight: 900,
    lineHeight: 1.2,
    color: '#f0abfc',
    marginBottom: 20,
    margin: '0 auto 20px',
  },
  heroSub: {
    color: '#94a3b8',
    fontSize: 16,
    maxWidth: 500,
    margin: '0 auto',
    lineHeight: 1.6,
  },
  main: {
    position: 'relative',
    zIndex: 10,
    maxWidth: 720,
    margin: '0 auto',
    padding: '0 24px 64px',
  },
  rules: {
    background: 'rgba(13,5,30,0.6)',
    border: '1px solid rgba(192,132,252,0.15)',
    borderRadius: 16,
    padding: 24,
  },
  rulesTitle: {
    fontFamily: 'Orbitron, sans-serif',
    fontSize: 12,
    letterSpacing: 4,
    color: '#7c3aed',
    marginBottom: 16,
  },
  rulesList: { display: 'flex', flexDirection: 'column', gap: 12 },
  rule: { display: 'flex', gap: 12, alignItems: 'flex-start', color: '#94a3b8', fontSize: 14 },
  ruleIcon: { fontSize: 18, flexShrink: 0 },
  footer: {
    position: 'relative',
    zIndex: 10,
    textAlign: 'center',
    padding: '24px',
    color: '#4b5563',
    fontSize: 13,
    borderTop: '1px solid rgba(255,255,255,0.05)',
  },
  link: { color: '#7c3aed', textDecoration: 'none' },
  networkBanner: {
    position: 'relative',
    zIndex: 10,
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.4)',
    color: '#fca5a5',
    textAlign: 'center',
    padding: '12px 24px',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  networkBtn: {
    background: 'rgba(239,68,68,0.2)',
    border: '1px solid rgba(239,68,68,0.5)',
    borderRadius: 8,
    color: '#fca5a5',
    padding: '6px 16px',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'Orbitron, sans-serif',
    letterSpacing: 1,
  },
};
