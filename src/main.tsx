import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Web3Provider } from './providers/Web3Provider';
import { SolanaProvider } from './providers/SolanaProvider';
import { SuiProvider } from './providers/SuiProvider';
import './i18n'; // Initialize i18n
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Web3Provider>
      <SolanaProvider>
        <SuiProvider>
          <App />
        </SuiProvider>
      </SolanaProvider>
    </Web3Provider>
  </React.StrictMode>,
);
