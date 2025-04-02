import { FC, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { createNewToken } from '@/utils/solana';
import toast from 'react-hot-toast';

interface CreateTokenProps {
  onTokenCreated: (tokenMint: PublicKey) => void;
}

const CreateToken: FC<CreateTokenProps> = ({ onTokenCreated }) => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [decimals, setDecimals] = useState<number>(9);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!wallet.connected || !wallet.publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }
    
    if (!wallet.signTransaction || !wallet.signAllTransactions) {
      toast.error('Your wallet does not support the required signing methods');
      return;
    }
    
    try {
      setIsLoading(true);
      const loadingToast = toast.loading('Creating new token...');
      
      const result = await createNewToken(connection, wallet, decimals);
      
      toast.dismiss(loadingToast);
      toast.success(
        <div>
          <p>Token created successfully!</p>
          <p className="text-xs font-mono break-all mt-1">
            Mint: {result.tokenMint.toString()}
          </p>
          <p className="text-xs font-mono break-all mt-1">
            Tx: {result.txSignature.substring(0, 8)}...
          </p>
        </div>
      );
      
      // Notify parent component about the new token
      onTokenCreated(result.tokenMint);
    } catch (error: any) {
      console.error('Error creating token:', error);
      toast.error(
        <div>
          <p>Failed to create token</p>
          <p className="text-xs mt-1">{error?.message || 'Unknown error'}</p>
        </div>
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">Create Token</h2>
      
      <form onSubmit={handleCreateToken}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Token Decimals
          </label>
          <input
            type="number"
            value={decimals}
            onChange={(e) => setDecimals(parseInt(e.target.value))}
            min={0}
            max={9}
            className="input"
            disabled={isLoading || !wallet.connected}
          />
          <p className="text-xs text-gray-500 mt-1">
            Number of decimal places (0-9). Standard is 9.
          </p>
        </div>
        
        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={isLoading || !wallet.connected}
        >
          {isLoading ? 'Creating...' : 'Create Token'}
        </button>
        
        {wallet.connected && (
          <div className="mt-2 text-xs text-gray-400">
            Make sure you have enough SOL in your wallet to cover the transaction fees.
          </div>
        )}
      </form>
    </div>
  );
};

export default CreateToken; 