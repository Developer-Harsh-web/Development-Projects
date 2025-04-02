import { FC, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { mintTokens } from '@/utils/solana';
import toast from 'react-hot-toast';

interface MintTokenProps {
  tokenMint: PublicKey | null;
}

const MintToken: FC<MintTokenProps> = ({ tokenMint }) => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [amount, setAmount] = useState<number>(100);
  const [destinationAddress, setDestinationAddress] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleMintToken = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!wallet.connected || !wallet.publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!tokenMint) {
      toast.error('Please create or select a token first');
      return;
    }
    
    if (!wallet.signTransaction || !wallet.signAllTransactions) {
      toast.error('Your wallet does not support the required signing methods');
      return;
    }
    
    try {
      setIsLoading(true);
      const loadingToast = toast.loading('Minting tokens...');
      
      let destination: PublicKey | undefined;
      if (destinationAddress) {
        try {
          destination = new PublicKey(destinationAddress);
        } catch (error) {
          toast.dismiss(loadingToast);
          toast.error('Invalid destination address');
          setIsLoading(false);
          return;
        }
      }
      
      // Convert amount to token units based on decimals (default to 9 decimals)
      const adjustedAmount = Math.floor(amount * Math.pow(10, 9)); // Adjust for decimals and ensure integer
      
      if (adjustedAmount <= 0) {
        toast.dismiss(loadingToast);
        toast.error('Amount must be greater than 0');
        setIsLoading(false);
        return;
      }
      
      const result = await mintTokens(
        connection,
        wallet,
        tokenMint,
        adjustedAmount,
        destination
      );
      
      toast.dismiss(loadingToast);
      toast.success(
        <div>
          <p>Successfully minted {amount} tokens!</p>
          <p className="text-xs font-mono break-all mt-1">
            Tx: {result.txSignature.substring(0, 8)}...
          </p>
          <a 
            href={`https://explorer.solana.com/tx/${result.txSignature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-solana-green hover:underline"
          >
            View on explorer
          </a>
        </div>
      );
    } catch (error: any) {
      console.error('Error minting tokens:', error);
      toast.error(
        <div>
          <p>Failed to mint tokens</p>
          <p className="text-xs mt-1">{error?.message || 'Unknown error'}</p>
        </div>
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">Mint Tokens</h2>
      
      {!tokenMint ? (
        <div className="text-amber-400 mb-4">
          Please create a token first using the form above.
        </div>
      ) : (
        <div className="mb-4">
          <div className="text-sm text-gray-400">Token Mint Address</div>
          <div className="font-mono text-xs break-all">
            {tokenMint.toString()}
          </div>
        </div>
      )}
      
      <form onSubmit={handleMintToken}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Amount to Mint
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value))}
            min={0}
            step="0.1"
            className="input"
            disabled={isLoading || !wallet.connected || !tokenMint}
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Destination Address (Optional)
          </label>
          <input
            type="text"
            value={destinationAddress}
            onChange={(e) => setDestinationAddress(e.target.value)}
            className="input"
            placeholder="Leave empty to mint to your wallet"
            disabled={isLoading || !wallet.connected || !tokenMint}
          />
          <p className="text-xs text-gray-500 mt-1">
            If left empty, tokens will be minted to your wallet.
          </p>
        </div>
        
        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={isLoading || !wallet.connected || !tokenMint}
        >
          {isLoading ? 'Minting...' : 'Mint Tokens'}
        </button>
        
        {wallet.connected && tokenMint && (
          <div className="mt-2 text-xs text-gray-400">
            You must be the mint authority to mint tokens.
          </div>
        )}
      </form>
    </div>
  );
};

export default MintToken; 