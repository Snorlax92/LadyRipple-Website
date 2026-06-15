import React, { useState, useEffect } from 'react';
import { 
  useAccount, 
  useBalance, 
  useReadContract, 
  useWriteContract, 
  useConnect,
  useChainId,
  useSwitchChain
} from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
import { formatUnits, parseUnits } from 'viem';
import { 
  LRP_ADDRESS, 
  WLADY_ADDRESS,
  LADYSWAP_ROUTER_ADDRESS, 
  LADYSWAP_ROUTER_ABI, 
  ERC20_ABI, 
  CHAIN_ID 
} from '../config.js';

export default function Swap({ onConnectClick }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const [fromToken, setFromToken] = useState('LADY'); // 'LADY' o 'LRP'
  const [toToken, setToToken] = useState('LRP');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [isEstimating, setIsEstimating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successTx, setSuccessTx] = useState('');

  // Tolerancia de deslizamiento (slippage) - por defecto 1.0%
  const [slippage, setSlippage] = useState(1.0);
  const [customSlippage, setCustomSlippage] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  // Balances
  const { data: ladyBalance, refetch: refetchLadyBalance } = useBalance({
    address,
  });

  const { data: lrpBalanceRaw, refetch: refetchLrpBalance } = useReadContract({
    address: LRP_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  });

  // Aprobación (allowance) de LRP
  const { data: lrpAllowanceRaw, refetch: refetchLrpAllowance } = useReadContract({
    address: LRP_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, LADYSWAP_ROUTER_ADDRESS] : undefined,
    query: { enabled: !!address }
  });

  // Operaciones de escritura de contratos
  const { writeContractAsync } = useWriteContract();

  const lrpBalance = lrpBalanceRaw ? BigInt(lrpBalanceRaw.toString()) : 0n;
  const lrpAllowance = lrpAllowanceRaw ? BigInt(lrpAllowanceRaw.toString()) : 0n;
  const ladyBalanceVal = ladyBalance ? BigInt(ladyBalance.value.toString()) : 0n;

  // Intercambiar dirección
  const handleSwitchDirection = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount('');
    setToAmount('');
    setErrorMessage('');
    setSuccessTx('');
  };

  // Rutas para Uniswap V2 Router
  const getPath = () => {
    return fromToken === 'LADY' 
      ? [WLADY_ADDRESS, LRP_ADDRESS] 
      : [LRP_ADDRESS, WLADY_ADDRESS];
  };

  // Obtener cotización
  const { data: amountsOut } = useReadContract({
    address: LADYSWAP_ROUTER_ADDRESS,
    abi: LADYSWAP_ROUTER_ABI,
    functionName: 'getAmountsOut',
    args: fromAmount && parseFloat(fromAmount) > 0
      ? [parseUnits(fromAmount, 18), getPath()]
      : undefined,
    query: {
      enabled: !!(fromAmount && parseFloat(fromAmount) > 0),
    }
  });

  useEffect(() => {
    if (amountsOut && amountsOut.length > 1) {
      const estimated = formatUnits(amountsOut[1], 18);
      setToAmount(parseFloat(estimated).toFixed(6));
      setErrorMessage('');
    } else {
      setToAmount('');
    }
  }, [amountsOut]);

  // Manejar cambio en el input
  const handleFromAmountChange = (val) => {
    setFromAmount(val);
    setSuccessTx('');
    if (!val || parseFloat(val) <= 0) {
      setToAmount('');
    }
  };

  // Configurar monto máximo
  const handleMaxClick = () => {
    if (fromToken === 'LADY') {
      // Dejamos un margen para el gas
      const maxLady = ladyBalanceVal > parseUnits('0.1', 18) 
        ? ladyBalanceVal - parseUnits('0.1', 18) 
        : 0n;
      setFromAmount(formatUnits(maxLady, 18));
    } else {
      setFromAmount(formatUnits(lrpBalance, 18));
    }
  };

  // Manejar cambio en slippage preestablecido
  const handlePresetSlippage = (val) => {
    setSlippage(val);
    setShowCustom(false);
  };

  // Manejar cambio en slippage personalizado
  const handleCustomSlippageChange = (val) => {
    setCustomSlippage(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 50) {
      setSlippage(parsed);
    }
  };

  // Ejecutar Swap
  const handleSwap = async () => {
    if (!isConnected) {
      if (onConnectClick) onConnectClick();
      return;
    }
    if (chainId !== CHAIN_ID) {
      switchChain({ chainId: CHAIN_ID });
      return;
    }
    if (!fromAmount || parseFloat(fromAmount) <= 0) return;

    setIsEstimating(true);
    setErrorMessage('');
    setSuccessTx('');

    try {
      const amountIn = parseUnits(fromAmount, 18);
      
      // Validar que la cotización se haya cargado
      if (!amountsOut || amountsOut.length < 2) {
        throw new Error('Cotización no disponible. Espera un momento o introduce otro importe.');
      }

      // Aplicar slippage en puntos básicos (e.g. 1.0% -> 100 bps)
      const slippageBps = BigInt(Math.floor(slippage * 100));
      const expectedOut = amountsOut[1];
      
      // Ajuste de impuestos por transferencia del token LRP (2% compra, 5% venta)
      let expectedOutNet = expectedOut;
      if (fromToken === 'LRP') {
        expectedOutNet = (expectedOut * 95n) / 100n; // 5% venta
      } else if (toToken === 'LRP') {
        expectedOutNet = (expectedOut * 98n) / 100n; // 2% compra
      }

      const amountOutMin = (expectedOutNet * (10000n - slippageBps)) / 10000n;
      const path = getPath();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutos de límite

      if (fromToken === 'LADY') {
        // Swap LADY -> LRP
        const tx = await writeContractAsync({
          address: LADYSWAP_ROUTER_ADDRESS,
          abi: LADYSWAP_ROUTER_ABI,
          functionName: 'swapExactETHForTokensSupportingFeeOnTransferTokens',
          args: [amountOutMin, path, address, deadline],
          value: amountIn,
          gas: 1000000n,
        });
        setSuccessTx(tx);
      } else {
        // Swap LRP -> LADY
        // Primero verificar aprobación
        if (lrpAllowance < amountIn) {
          const maxUint = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;
          const approveTx = await writeContractAsync({
            address: LRP_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [LADYSWAP_ROUTER_ADDRESS, maxUint],
            gas: 150000n,
          });
          // Esperamos o solicitamos refetch
          await new Promise((resolve) => setTimeout(resolve, 3000));
          await refetchLrpAllowance();
        }

        const tx = await writeContractAsync({
          address: LADYSWAP_ROUTER_ADDRESS,
          abi: LADYSWAP_ROUTER_ABI,
          functionName: 'swapExactTokensForETHSupportingFeeOnTransferTokens',
          args: [amountIn, amountOutMin, path, address, deadline],
          gas: 1000000n,
        });
        setSuccessTx(tx);
      }

      setFromAmount('');
      setToAmount('');
      // Refrescar balances
      setTimeout(() => {
        refetchLadyBalance();
        refetchLrpBalance();
        refetchLrpAllowance();
      }, 3000);
    } catch (err) {
      console.error(err);
      setErrorMessage(err.shortMessage || err.message || 'Error al procesar la transacción');
    } finally {
      setIsEstimating(false);
    }
  };

  // Validaciones
  const hasInsufficientBalance = () => {
    if (!fromAmount) return false;
    const amountIn = parseUnits(fromAmount, 18);
    if (fromToken === 'LADY') {
      return ladyBalanceVal < amountIn;
    } else {
      return lrpBalance < amountIn;
    }
  };

  const getButtonText = () => {
    if (!isConnected) return 'Connect Wallet';
    if (chainId !== CHAIN_ID) return 'Switch to LadyChain';
    if (isEstimating) return 'Processing...';
    if (!fromAmount || parseFloat(fromAmount) <= 0) return 'Enter an amount';
    if (hasInsufficientBalance()) return `Insufficient ${fromToken} balance`;
    if (fromToken === 'LRP' && lrpAllowance < parseUnits(fromAmount, 18)) {
      return 'Approve LRP';
    }
    return 'Swap';
  };

  const formattedLadyBalance = ladyBalance ? parseFloat(ladyBalance.formatted).toFixed(4) : '0';
  const formattedLrpBalance = lrpBalanceRaw ? parseFloat(formatUnits(lrpBalanceRaw, 18)).toFixed(2) : '0';

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>LadySwap</h2>
          <span style={styles.networkBadge}>LadyChain</span>
        </div>

        {/* Input From */}
        <div style={styles.inputGroup}>
          <div style={styles.inputLabelRow}>
            <span>From</span>
            <span>Balance: {fromToken === 'LADY' ? formattedLadyBalance : formattedLrpBalance}</span>
          </div>
          <div style={styles.inputRow}>
            <input
              type="number"
              placeholder="0.0"
              value={fromAmount}
              onChange={(e) => handleFromAmountChange(e.target.value)}
              style={styles.input}
              disabled={isEstimating}
            />
            <button onClick={handleMaxClick} style={styles.maxBtn} disabled={isEstimating}>
              MAX
            </button>
            <span style={styles.tokenBadge}>{fromToken}</span>
          </div>
        </div>

        {/* Switch Arrow */}
        <div style={styles.switchRow}>
          <button onClick={handleSwitchDirection} style={styles.switchBtn} disabled={isEstimating}>
            ↓
          </button>
        </div>

        {/* Input To */}
        <div style={styles.inputGroup}>
          <div style={styles.inputLabelRow}>
            <span>To</span>
            <span>Balance: {toToken === 'LADY' ? formattedLadyBalance : formattedLrpBalance}</span>
          </div>
          <div style={styles.inputRow}>
            <input
              type="text"
              placeholder="0.0"
              value={toAmount}
              readOnly
              style={{ ...styles.input, color: '#a78bfa' }}
            />
            <span style={styles.tokenBadge}>{toToken}</span>
          </div>
        </div>

        {/* Detalles del swap */}
        {fromAmount && toAmount && (
          <div style={styles.details}>
            <div style={styles.detailRow}>
              <span>Rate:</span>
              <span>
                1 {fromToken} = {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)} {toToken}
              </span>
            </div>
            <div style={styles.detailRow}>
              <span>Slippage Tolerance:</span>
              <span>{slippage.toFixed(1)}%</span>
            </div>
            <div style={styles.detailRow}>
              <span style={{ color: '#fca5a5' }}>
                LRP Tax ({toToken === 'LRP' ? '2.0%' : '5.0%'}):
              </span>
              <span style={{ color: '#fca5a5' }}>
                -{(parseFloat(toAmount) * (toToken === 'LRP' ? 0.02 : 0.05)).toFixed(4)} {toToken}
              </span>
            </div>
            <div style={styles.detailRow}>
              <span>Est. Net Received:</span>
              <span style={{ color: '#86efac', fontWeight: 'bold' }}>
                {(parseFloat(toAmount) * (toToken === 'LRP' ? 0.98 : 0.95)).toFixed(4)} {toToken}
              </span>
            </div>
          </div>
        )}

        {/* Panel de Configuración de Slippage */}
        <div style={styles.slippagePanel}>
          <div style={styles.slippageHeader}>Slippage Tolerance</div>
          <div style={styles.slippageOptions}>
            <button
              onClick={() => handlePresetSlippage(0.5)}
              style={{
                ...styles.slippageBtn,
                ...(!showCustom && slippage === 0.5 ? styles.slippageBtnActive : {}),
              }}
            >
              0.5%
            </button>
            <button
              onClick={() => handlePresetSlippage(1.0)}
              style={{
                ...styles.slippageBtn,
                ...(!showCustom && slippage === 1.0 ? styles.slippageBtnActive : {}),
              }}
            >
              1.0%
            </button>
            <button
              onClick={() => handlePresetSlippage(2.0)}
              style={{
                ...styles.slippageBtn,
                ...(!showCustom && slippage === 2.0 ? styles.slippageBtnActive : {}),
              }}
            >
              2.0%
            </button>
            <button
              onClick={() => setShowCustom(true)}
              style={{
                ...styles.slippageBtn,
                ...(showCustom ? styles.slippageBtnActive : {}),
              }}
            >
              Custom
            </button>
            {showCustom && (
              <div style={styles.customInputWrapper}>
                <input
                  type="number"
                  placeholder="1.0"
                  value={customSlippage}
                  onChange={(e) => handleCustomSlippageChange(e.target.value)}
                  style={styles.slippageInput}
                />
                <span style={styles.percentSymbol}>%</span>
              </div>
            )}
          </div>
        </div>

        {/* Mensajes de feedback */}
        {errorMessage && <div style={styles.errorText}>{errorMessage}</div>}
        {successTx && (
          <div style={styles.successText}>
            ✓ Swap completed successfully!
            <a 
              href={`https://ladyscan.us/tx/${successTx}`} 
              target="_blank" 
              rel="noreferrer" 
              style={styles.txLink}
            >
              View on LadyScan
            </a>
          </div>
        )}

        {/* Botón Principal */}
        <button
          onClick={handleSwap}
          style={{
            ...styles.actionBtn,
            ...(getButtonText() === 'Swap' || getButtonText() === 'Approve LRP' || !isConnected ? styles.actionBtnActive : {}),
          }}
          disabled={
            isEstimating || 
            (isConnected && chainId === CHAIN_ID && (!fromAmount || parseFloat(fromAmount) <= 0 || hasInsufficientBalance()))
          }
        >
          {getButtonText()}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    padding: '40px 0',
  },
  card: {
    background: 'rgba(13, 5, 30, 0.75)',
    border: '1px solid rgba(192, 132, 252, 0.25)',
    borderRadius: '24px',
    padding: '24px',
    width: '100%',
    maxWidth: '440px',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(12px)',
    position: 'relative',
    zIndex: 10,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  cardTitle: {
    fontFamily: 'Orbitron, sans-serif',
    fontSize: '22px',
    fontWeight: '700',
    color: '#f0abfc',
    margin: 0,
  },
  networkBadge: {
    background: 'rgba(124, 58, 237, 0.2)',
    border: '1px solid rgba(124, 58, 237, 0.4)',
    color: '#c084fc',
    borderRadius: '8px',
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.5px',
  },
  inputGroup: {
    background: 'rgba(5, 0, 17, 0.6)',
    border: '1px solid rgba(192, 132, 252, 0.1)',
    borderRadius: '16px',
    padding: '16px',
    marginBottom: '8px',
  },
  inputLabelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#94a3b8',
    fontSize: '12px',
    marginBottom: '8px',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  input: {
    background: 'transparent',
    border: 'none',
    color: '#f8fafc',
    fontSize: '24px',
    width: '100%',
    outline: 'none',
    fontFamily: 'monospace',
  },
  maxBtn: {
    background: 'rgba(255, 45, 155, 0.15)',
    border: '1px solid rgba(255, 45, 155, 0.3)',
    borderRadius: '8px',
    color: '#ff2d9b',
    fontSize: '11px',
    fontWeight: '700',
    padding: '4px 8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  tokenBadge: {
    fontFamily: 'Orbitron, sans-serif',
    fontSize: '16px',
    fontWeight: '700',
    color: '#e2e8f0',
    padding: '4px 8px',
  },
  switchRow: {
    display: 'flex',
    justifyContent: 'center',
    margin: '4px 0',
  },
  switchBtn: {
    background: 'rgba(192, 132, 252, 0.1)',
    border: '1px solid rgba(192, 132, 252, 0.25)',
    borderRadius: '50%',
    color: '#c084fc',
    width: '36px',
    height: '36px',
    fontSize: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  details: {
    padding: '12px',
    background: 'rgba(5, 0, 17, 0.3)',
    borderRadius: '12px',
    marginBottom: '12px',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#94a3b8',
    fontSize: '12px',
    marginBottom: '6px',
  },
  slippagePanel: {
    background: 'rgba(5, 0, 17, 0.3)',
    border: '1px solid rgba(192, 132, 252, 0.1)',
    borderRadius: '12px',
    padding: '12px',
    marginBottom: '16px',
  },
  slippageHeader: {
    color: '#94a3b8',
    fontSize: '12px',
    marginBottom: '8px',
  },
  slippageOptions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  slippageBtn: {
    background: 'rgba(13, 5, 30, 0.6)',
    border: '1px solid rgba(192, 132, 252, 0.15)',
    borderRadius: '8px',
    color: '#94a3b8',
    padding: '6px 12px',
    fontSize: '11px',
    cursor: 'pointer',
    fontFamily: 'Orbitron, sans-serif',
    transition: 'all 0.2s',
  },
  slippageBtnActive: {
    background: 'rgba(255, 45, 155, 0.15)',
    border: '1px solid rgba(255, 45, 155, 0.4)',
    color: '#ff2d9b',
    fontWeight: '700',
  },
  customInputWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  slippageInput: {
    background: 'rgba(5, 0, 17, 0.8)',
    border: '1px solid rgba(192, 132, 252, 0.2)',
    borderRadius: '8px',
    color: '#f8fafc',
    fontSize: '11px',
    width: '50px',
    padding: '4px 8px',
    outline: 'none',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  percentSymbol: {
    color: '#94a3b8',
    fontSize: '12px',
  },
  errorText: {
    color: '#fca5a5',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '12px',
    padding: '12px',
    fontSize: '12px',
    marginBottom: '16px',
    wordBreak: 'break-word',
  },
  successText: {
    color: '#86efac',
    background: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid rgba(34, 197, 94, 0.2)',
    borderRadius: '12px',
    padding: '12px',
    fontSize: '12px',
    marginBottom: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  txLink: {
    color: '#00d4ff',
    textDecoration: 'underline',
    cursor: 'pointer',
  },
  actionBtn: {
    width: '100%',
    background: 'rgba(192, 132, 252, 0.1)',
    border: '1px solid rgba(192, 132, 252, 0.25)',
    color: '#94a3b8',
    borderRadius: '16px',
    padding: '16px',
    fontFamily: 'Orbitron, sans-serif',
    fontSize: '15px',
    fontWeight: '700',
    letterSpacing: '1px',
    cursor: 'not-allowed',
    transition: 'all 0.3s',
  },
  actionBtnActive: {
    background: 'linear-gradient(135deg, #ff2d9b, #7c3aed)',
    border: 'none',
    color: '#ffffff',
    cursor: 'pointer',
    boxShadow: '0 0 16px rgba(255, 45, 155, 0.4)',
  },
  walletBtnContainer: {
    position: 'relative',
    width: '100%',
  },
  dropdownMenu: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '100%',
    marginBottom: '12px',
    background: 'rgba(13, 5, 30, 0.98)',
    border: '1px solid rgba(192, 132, 252, 0.3)',
    borderRadius: '16px',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.8)',
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
    padding: '12px 16px',
    fontSize: '14px',
    fontFamily: 'Orbitron, sans-serif',
    borderRadius: '8px',
    textAlign: 'left',
    width: '100%',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
};
