import { ReactNode } from 'react';
import { createNetworkConfig, SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Import SUI dApp Kit styles
import '@mysten/dapp-kit/dist/index.css';

// Configure supported networks
const { networkConfig } = createNetworkConfig({
  mainnet: { url: getJsonRpcFullnodeUrl('mainnet'), network: 'mainnet' },
  testnet: { url: getJsonRpcFullnodeUrl('testnet'), network: 'testnet' },
  devnet: { url: getJsonRpcFullnodeUrl('devnet'), network: 'devnet' },
});

// Create a separate query client for SUI (isolated from the main app's React Query)
const suiQueryClient = new QueryClient();

interface SuiProviderProps {
  children: ReactNode;
}

export function SuiProvider({ children }: SuiProviderProps) {
  return (
    <QueryClientProvider client={suiQueryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="mainnet">
        <WalletProvider autoConnect>
          {children}
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
