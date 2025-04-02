import { useState } from 'react';
import Head from 'next/head';
import { PublicKey } from '@solana/web3.js';
import WalletConnect from '@/components/WalletConnect';
import CreateToken from '@/components/CreateToken';
import MintToken from '@/components/MintToken';
import SendToken from '@/components/SendToken';
import TokenHistory from '@/components/TokenHistory';

export default function Home() {
  const [currentTokenMint, setCurrentTokenMint] = useState<PublicKey | null>(null);
  
  const handleTokenCreated = (tokenMint: PublicKey) => {
    setCurrentTokenMint(tokenMint);
  };
  
  return (
    <div>
      <Head>
        <title>Solana Token App</title>
        <meta name="description" content="Create, mint and send Solana tokens" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <div className="min-h-screen">
        <header className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-4 md:mb-0">
              <span className="text-solana-green">Solana</span> Token App
            </h1>
            <WalletConnect />
          </div>
        </header>
        
        <main className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="flex flex-col gap-8">
              <CreateToken onTokenCreated={handleTokenCreated} />
              <MintToken tokenMint={currentTokenMint} />
            </div>
            
            <div className="flex flex-col gap-8">
              <SendToken tokenMint={currentTokenMint} />
              <TokenHistory tokenMint={currentTokenMint} />
            </div>
          </div>
        </main>
        
        <footer className="container mx-auto px-4 py-6 border-t border-gray-800 mt-12">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              Built for Solana Token Management
            </p>
            <p className="text-gray-400 text-sm">
              Connected to Solana Devnet
            </p>
          </div>
          <div className="mt-4 text-center text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} - Developed by <span className="font-semibold text-solana-purple">Harsh Kumar</span>
          </div>
        </footer>
      </div>
    </div>
  );
} 