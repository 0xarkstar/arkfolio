import { http, createConfig } from 'wagmi';
import { mainnet, arbitrum, optimism, base, polygon, bsc, avalanche } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

// Define chains
const chains = [mainnet, arbitrum, optimism, base, polygon, bsc, avalanche] as const;

// Build connectors - always include injected (MetaMask, etc.)
// Only add WalletConnect if projectId is provided
const connectors = projectId
  ? [
      injected(),
      walletConnect({ projectId, showQrModal: false }),
    ]
  : [injected()];

export const wagmiConfig = createConfig({
  chains,
  connectors,
  transports: {
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [base.id]: http(),
    [polygon.id]: http(),
    [bsc.id]: http(),
    [avalanche.id]: http(),
  },
});

// Export whether WalletConnect is available
export const isWalletConnectEnabled = !!projectId;
