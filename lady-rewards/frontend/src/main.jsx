import React from 'react';
import ReactDOM from 'react-dom/client';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LADYCHAIN } from './config.js';
import App from './App.jsx';

const connectors = [injected()];

// WalletConnect enables mobile wallets (MetaMask mobile, SafePal app, Trust Wallet, etc.)
// Get a free project ID at https://cloud.walletconnect.com
const wcProjectId = import.meta.env.VITE_WC_PROJECT_ID;
if (wcProjectId) {
  connectors.push(walletConnect({ projectId: wcProjectId }));
}

const wagmiConfig = createConfig({
  chains: [LADYCHAIN],
  connectors,
  transports: { [LADYCHAIN.id]: http() },
});

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
