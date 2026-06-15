import React, { useState, useEffect } from 'react';
import { 
  useAccount, 
  useConnect, 
  useDisconnect, 
  useReadContract, 
  useChainId, 
  useSwitchChain 
} from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
import { INDEXER_URL, LADY_REWARDS_ADDRESS, LADY_REWARDS_ABI, CHAIN_ID } from './config.js';
import CrownHolder from './components/CrownHolder.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import ClaimButton from './components/ClaimButton.jsx';
import Swap from './components/Swap.jsx';

export default function App() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const onWrongChain = isConnected && chainId !== CHAIN_ID;

  // Lógica de enrutamiento simple basada en el pathname
  const isSwapPage = window.location.pathname.startsWith('/swap');
  const swapHref = '/swap';
  const rewardsHref = '/rewards';

  const [leaderboardData, setLeaderboardData] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(null);
  const [refreshAt, setRefreshAt] = useState(Date.now());
  const [showDropdown, setShowDropdown] = useState(false);



  useEffect(() => {
    // Solo cargamos el leaderboard si no estamos en la página de Swap
    if (!isSwapPage) {
      fetch(`${INDEXER_URL}/leaderboard`)
        .then((r) => r.json())
        .then((data) => {
          setLeaderboardData(data);
          setCurrentWeek(data.week);
        })
        .catch(() => {});
    }
  }, [refreshAt, isSwapPage]);

  // Refrescar automáticamente cada 60s
  useEffect(() => {
    const id = setInterval(() => setRefreshAt(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const fmt = (addr) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  const lrp = (n) => n != null ? (BigInt(n.toString()) / 10n ** 18n).toLocaleString() : '—';

  // Configuración de wallets fijas para el menú desplegable con sus targets y RDNS (EIP-6963)
  const wallets = [
    {
      name: 'MetaMask',
      rdns: 'io.metamask',
      target: 'metaMask'
    },
    {
      name: 'Trust Wallet',
      rdns: 'com.trustwallet.app',
      target: 'trust'
    },
    {
      name: 'SafePal',
      rdns: 'io.safepal',
      target: 'safePal'
    },
    {
      name: 'Zerion',
      rdns: 'io.zerion',
      target: 'zerion'
    },
    {
      name: 'Bitget Wallet',
      rdns: 'com.bitkeep.wallet',
      target: 'tokenPocket' // O fallback a injected genérico
    },
    {
      name: 'WalletConnect',
      target: 'walletConnect'
    }
  ];

  const handleWalletSelect = (wallet) => {
    setShowDropdown(false);
    
    if (wallet.target === 'walletConnect') {
      const wcProjectId = import.meta.env.VITE_WC_PROJECT_ID;
      const wcConnector = connectors.find(c => c.id === 'walletConnect');
      if (wcConnector) {
        connect({ connector: wcConnector });
      } else if (wcProjectId) {
        connect({ connector: walletConnect({ projectId: wcProjectId }) });
      } else {
        alert('WalletConnect Project ID is not configured in .env. Falling back to default injected wallet.');
        connect({ connector: connectors.find(c => c.id === 'injected') || injected() });
      }
    } else {
      // Intentar buscar el conector exacto anunciado por EIP-6963
      const exactConnector = connectors.find(c => 
        c.id === wallet.rdns || 
        c.id === wallet.target || 
        c.name.toLowerCase().replace(/\s+/g, '') === wallet.name.toLowerCase().replace(/\s+/g, '')
      );

      if (exactConnector) {
        // Conectar usando el proveedor aislado por EIP-6963
        connect({ connector: exactConnector });
      } else {
        // Fallback: conexión directa al target específico
        connect(
          { connector: injected({ target: wallet.target }) },
          {
            onError: (err) => {
              console.warn(`Specific target connection failed for ${wallet.name}, falling back to generic injected connector...`, err);
              const genericInjected = connectors.find(c => c.id === 'injected');
              if (genericInjected) {
                connect({ connector: genericInjected });
              } else {
                try {
                  connect({ connector: injected() });
                } catch (fallbackErr) {
                  console.error(fallbackErr);
                }
              }
            }
          }
        );
      }
    }
  };

  return (
    <div style={styles.root}>
      <div style={styles.bg} />

      {/* Backdrop invisible para cerrar el menú desplegable al hacer clic fuera */}
      {showDropdown && (
        <div 
          onClick={() => setShowDropdown(false)} 
          style={styles.dropdownBackdrop} 
        />
      )}

      {/* Header */}
      <header style={styles.header} className="header-container">
        <div style={styles.headerLeft}>
          <a href="https://ladyripple.xyz" style={styles.logo}>
            <img
              src={`${import.meta.env.BASE_URL}LadyRipple.jpg`}
              alt="LadyRipple"
              style={styles.logoImg}
            />
            <span style={styles.logoText} className="logo-text">LadyRipple</span>
          </a>
          <nav style={styles.nav}>
            <a 
              href={rewardsHref} 
              style={{ ...styles.navLink, ...(!isSwapPage ? styles.navLinkActive : {}) }}
            >
              <span className="nav-icon">🏆</span>
              <span className="nav-text">REWARDS</span>
            </a>
            <a 
              href={swapHref} 
              style={{ ...styles.navLink, ...(isSwapPage ? styles.navLinkActive : {}) }}
            >
              <span className="nav-icon">🔄</span>
              <span className="nav-text">SWAP</span>
            </a>
          </nav>
        </div>
        
        <div style={styles.headerRight}>

          {isConnected ? (
            <button onClick={() => disconnect()} style={styles.walletBtn}>
              {fmt(address)} ✕
            </button>
          ) : (
            <div style={styles.walletBtnContainer}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                style={{ ...styles.walletBtn, ...styles.connectBtn }}
                className="wallet-btn-highlight"
              >
                Connect Wallet
              </button>
              
              {showDropdown && (
                <div style={styles.dropdownMenu}>
                  {wallets.map((wallet) => (
                    <button
                      key={wallet.name}
                      onClick={() => handleWalletSelect(wallet)}
                      style={styles.dropdownItem}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(192, 132, 252, 0.15)';
                        e.currentTarget.style.color = '#f0abfc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#e2e8f0';
                      }}
                    >
                      <span>{wallet.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Banner de red incorrecta */}
      {onWrongChain && (
        <div style={styles.networkBanner}>
          Wrong network — you need to be on LadyChain to trade or claim rewards.
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
        <div style={styles.heroEyebrow}>
          {isSwapPage ? 'LADYSWAP · LADYCHAIN' : '$LRP · LADYCHAIN'}
        </div>
        <h1 style={styles.heroTitle}>
          {isSwapPage ? (
            <>Instant Token Swap<br />Simple &amp; Secure.</>
          ) : (
            <>She doesn't follow waves.<br />She starts them.</>
          )}
        </h1>
        <p style={styles.heroSub}>
          {isSwapPage ? (
            'Trade your LADY and LRP tokens instantly on LadyChain with decentralized liquidity.'
          ) : (
            'Buy $LRP to climb the weekly leaderboard. Top 10 buyers and the Lady Crown winner earn LRP rewards every week.'
          )}
        </p>
      </div>

      {/* Contenido principal */}
      <main style={styles.main}>
        {isSwapPage ? (
          <Swap onConnectClick={() => {
            setShowDropdown(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }} />
        ) : (
          <>
            {/* Sección de reclamos */}
            {isConnected && currentWeek != null && <ClaimButton week={currentWeek} />}

            {/* Titular de la corona */}
            <CrownHolder
              crown={leaderboardData?.crown}
              week={currentWeek}
            />

            {/* Tabla de clasificación */}
            <Leaderboard
              entries={leaderboardData?.leaderboard}
              week={currentWeek}
            />

            {/* Reglas de participación */}
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
          </>
        )}
      </main>

      <footer style={styles.footer}>
        <a href="https://ladyripple.xyz/" target="_blank" rel="noreferrer" style={styles.link}>
          ladyripple.xyz
        </a>
        {' · '}
        <a href="/swap" style={styles.link}>
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
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 32px',
    borderBottom: '1px solid rgba(192,132,252,0.15)',
    backdropFilter: 'blur(12px)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' },
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
  nav: {
    display: 'flex',
    gap: '20px',
    marginLeft: '32px',
  },
  navLink: {
    color: '#94a3b8',
    textDecoration: 'none',
    fontFamily: 'Orbitron, sans-serif',
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '1px',
    transition: 'color 0.2s',
  },
  navLinkActive: {
    color: '#f0abfc',
    textShadow: '0 0 10px rgba(240, 171, 252, 0.4)',
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
  walletBtnContainer: {
    position: 'relative',
    display: 'inline-block',
  },
  walletBtn: {
    background: 'rgba(192, 132, 252, 0.1)',
    border: '1px solid rgba(192, 132, 252, 0.4)',
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
  dropdownBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 999,
    background: 'transparent',
  },
  dropdownMenu: {
    position: 'absolute',
    right: 0,
    top: '100%',
    marginTop: '12px',
    background: 'rgba(13, 5, 30, 0.95)',
    border: '1px solid rgba(192, 132, 252, 0.25)',
    borderRadius: '16px',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    width: '220px',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(12px)',
    zIndex: 1000,
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'transparent',
    border: 'none',
    color: '#e2e8f0',
    padding: '10px 16px',
    fontSize: '13px',
    fontFamily: 'Orbitron, sans-serif',
    borderRadius: '8px',
    textAlign: 'left',
    width: '100%',
    cursor: 'pointer',
    transition: 'all 0.2s',
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
    marginTop: 24,
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
