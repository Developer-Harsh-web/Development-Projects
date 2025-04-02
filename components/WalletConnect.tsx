import { FC, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getSolanaBalance } from '@/utils/solana';

const WalletConnect: FC = () => {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);

  // Update balance when wallet is connected
  useEffect(() => {
    if (connected && publicKey) {
      fetchBalance();
    } else {
      setBalance(null);
    }
  }, [connected, publicKey, connection]);

  const fetchBalance = async () => {
    if (!publicKey) return;
    try {
      const solBalance = await getSolanaBalance(connection, publicKey);
      setBalance(solBalance);
    } catch (error) {
      console.error('Error fetching SOL balance:', error);
      setBalance(null);
    }
  };

  return (
    <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
      <WalletMultiButton className="btn btn-primary" />
      
      {connected && publicKey && (
        <div className="flex flex-col items-center md:items-start">
          <div className="text-sm text-gray-400">Connected Wallet</div>
          <div className="font-mono text-xs md:text-sm truncate max-w-[200px]">
            {publicKey.toString()}
          </div>
          
          <div className="mt-1 text-sm text-gray-400">Balance</div>
          <div className="font-semibold">
            {balance !== null ? `${balance.toFixed(4)} SOL` : 'Loading...'}
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletConnect; 