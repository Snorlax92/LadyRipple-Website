import React from 'react';

const RANK_COLORS = ['#fbbf24', '#94a3b8', '#c2763a', '#a78bfa', '#a78bfa'];
const RANK_LABELS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];

function formatWeek(week) {
  if (week == null) return '';
  const start = new Date(week * 604800 * 1000);
  const end = new Date((week + 1) * 604800 * 1000 - 1);
  const opts = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}

export default function Leaderboard({ entries, week }) {
  const fmt = (addr) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  const lrp = (n) => (BigInt(n) / 10n ** 18n).toLocaleString();

  if (!entries || entries.length === 0) {
    return (
      <div style={styles.empty}>
        No buys recorded yet this week. Be the first on the board! 🌊
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerTitle}>WEEKLY BUY LEADERBOARD</span>
        <span style={styles.weekBadge}>{formatWeek(week)}</span>
      </div>
      <div style={styles.list}>
        {entries.map((entry, i) => (
          <div key={entry.address} style={{ ...styles.row, ...(i < 3 ? styles.topRow : {}) }}>
            <span style={{ ...styles.rank, color: RANK_COLORS[i] ?? '#6b7280' }}>
              {RANK_LABELS[i]}
            </span>
            <span style={styles.address}>{fmt(entry.address)}</span>
            <span style={styles.amount}>{lrp(entry.totalBought)} LRP</span>
            {i === 0 && <span style={styles.waveBadge}>🌊 Top Buyer</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: 'rgba(13, 5, 30, 0.8)',
    border: '1px solid rgba(192,132,252,0.3)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 32,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid rgba(192,132,252,0.2)',
    background: 'rgba(45,10,92,0.5)',
  },
  headerTitle: {
    fontFamily: 'Orbitron, sans-serif',
    fontSize: 14,
    fontWeight: 700,
    color: '#c084fc',
    letterSpacing: 3,
  },
  weekBadge: {
    background: 'rgba(192,132,252,0.15)',
    border: '1px solid rgba(192,132,252,0.4)',
    borderRadius: 12,
    padding: '2px 12px',
    color: '#a78bfa',
    fontSize: 12,
  },
  list: { padding: '8px 0' },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '12px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    transition: 'background 0.2s',
  },
  topRow: { background: 'rgba(192,132,252,0.05)' },
  rank: {
    fontFamily: 'Orbitron, sans-serif',
    fontWeight: 700,
    fontSize: 13,
    width: 36,
    flexShrink: 0,
  },
  address: {
    fontFamily: 'monospace',
    color: '#e2e8f0',
    fontSize: 14,
    flex: 1,
  },
  amount: {
    fontFamily: 'Orbitron, sans-serif',
    fontSize: 14,
    fontWeight: 700,
    color: '#fbbf24',
  },
  waveBadge: {
    fontSize: 11,
    color: '#60a5fa',
    background: 'rgba(96,165,250,0.1)',
    border: '1px solid rgba(96,165,250,0.3)',
    borderRadius: 10,
    padding: '2px 8px',
  },
  empty: {
    textAlign: 'center',
    color: '#6b7280',
    padding: '48px 24px',
    fontSize: 15,
    fontStyle: 'italic',
  },
};
