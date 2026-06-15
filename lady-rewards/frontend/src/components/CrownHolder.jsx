import React from 'react';

function formatWeek(week) {
  if (week == null) return '';
  // Week opens Saturday 9pm PST = Sunday 05:00 UTC (epoch offset = 3 days + 5 hrs = 277200s)
  const weekOpenUtc = week * 604800 + 277200;
  const weekCloseUtc = weekOpenUtc + 604800;
  // Shift back 8h (PST = UTC-8) so display dates reflect Saturday→Friday PST window
  const start = new Date((weekOpenUtc - 8 * 3600) * 1000);
  const end = new Date((weekCloseUtc - 8 * 3600 - 1) * 1000);
  const opts = { month: 'short', day: 'numeric', timeZone: 'UTC' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}

export default function CrownHolder({ crown, week }) {
  const fmt = (addr) => addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '—';
  const lrp = (n) => n ? (BigInt(n) / 10n ** 18n).toLocaleString() : '0';

  return (
    <div style={styles.card}>
      <div style={styles.crownIcon}>👑</div>
      <div style={styles.title}>LADY CROWN</div>
      <div style={styles.subtitle}>Biggest Single Buy — {formatWeek(week)}</div>
      {crown ? (
        <>
          <div style={styles.address}>{fmt(crown.address)}</div>
          <div style={styles.amount}>{lrp(crown.largestSingleBuy)} LRP</div>
          <div style={styles.badge}>Current Crown Holder</div>
        </>
      ) : (
        <div style={styles.empty}>No buys recorded yet this week</div>
      )}
    </div>
  );
}

const styles = {
  card: {
    background: 'linear-gradient(135deg, #1a0533 0%, #2d0a5c 50%, #1a0533 100%)',
    border: '2px solid #c084fc',
    borderRadius: 16,
    padding: '32px 24px',
    textAlign: 'center',
    boxShadow: '0 0 40px rgba(192,132,252,0.3)',
    marginBottom: 32,
  },
  crownIcon: { fontSize: 48, marginBottom: 8 },
  title: {
    fontFamily: 'Orbitron, sans-serif',
    fontSize: 22,
    fontWeight: 900,
    color: '#e879f9',
    letterSpacing: 4,
    marginBottom: 4,
  },
  subtitle: { color: '#a78bfa', fontSize: 13, marginBottom: 20 },
  address: {
    fontFamily: 'monospace',
    fontSize: 18,
    color: '#f0abfc',
    marginBottom: 8,
  },
  amount: {
    fontFamily: 'Orbitron, sans-serif',
    fontSize: 28,
    fontWeight: 700,
    color: '#fbbf24',
    marginBottom: 12,
  },
  badge: {
    display: 'inline-block',
    background: 'rgba(192,132,252,0.2)',
    border: '1px solid #c084fc',
    borderRadius: 20,
    padding: '4px 16px',
    color: '#e879f9',
    fontSize: 12,
    letterSpacing: 2,
  },
  empty: { color: '#6b7280', fontSize: 14, fontStyle: 'italic' },
};
