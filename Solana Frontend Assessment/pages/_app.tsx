import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { WalletContextProvider } from '@/contexts/WalletContextProvider';
import { Toaster } from 'react-hot-toast';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <WalletContextProvider>
      <Component {...pageProps} />
      <Toaster position="bottom-right" />
    </WalletContextProvider>
  );
} 