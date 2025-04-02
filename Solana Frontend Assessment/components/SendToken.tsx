import { FC, useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { transferTokens, getTokenBalance } from '@/utils/solana';
import toast from 'react-hot-toast';

interface SendTokenProps {
  tokenMint: PublicKey | null;
}

const SendToken: FC<SendTokenProps> = ({ tokenMint }) => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [amount, setAmount] = useState<number>(10);
  const [receiverAddress, setReceiverAddress] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  // Fetch balance when token changes or wallet connects
  useEffect(() => {
    if (wallet.connected && wallet.publicKey && tokenMint) {
      fetchTokenBalance();
    } else {
      setBalance(null);
    }
  }, [wallet.publicKey, tokenMint, wallet.connected]);

  const fetchTokenBalance = async () => {
    if (!wallet.publicKey || !tokenMint) return;
    
    try {
      setIsLoadingBalance(true);
      const result = await getTokenBalance(connection, tokenMint, wallet.publicKey);
      setBalance(result.balance);
    } catch (error) {
      console.error('Error fetching token balance:', error);
      setBalance(null);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const handleSendToken = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!wallet.connected || !wallet.publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!tokenMint) {
      toast.error('Please create or select a token first');
      return;
    }

    if (!receiverAddress) {
      toast.error('Please enter a receiver address');
      return;
    }
    
    if (!wallet.signTransaction || !wallet.signAllTransactions) {
      toast.error('Your wallet does not support the required signing methods');
      return;
    }
    
    try {
      setIsLoading(true);
      const loadingToast = toast.loading('Sending tokens...');
      
      let destination: PublicKey;
      try {
        destination = new PublicKey(receiverAddress);
      } catch (error) {
        toast.dismiss(loadingToast);
        toast.error('Invalid receiver address');
        setIsLoading(false);
        return;
      }
      
      if (destination.equals(wallet.publicKey)) {
        toast.dismiss(loadingToast);
        toast.error('You cannot send tokens to yourself');
        setIsLoading(false);
        return;
      }
      
      // Convert amount to token units based on decimals (default to 9 decimals)
      const adjustedAmount = Math.floor(amount * Math.pow(10, 9));
      
      if (adjustedAmount <= 0) {
        toast.dismiss(loadingToast);
        toast.error('Amount must be greater than 0');
        setIsLoading(false);
        return;
      }
      
      // Check if user has enough balance
      if (balance !== null && amount > balance) {
        toast.dismiss(loadingToast);
        toast.error(`Insufficient token balance. You have ${balance} tokens`);
        setIsLoading(false);
        return;
      }
      
      const result = await transferTokens(
        connection,
        wallet,
        tokenMint,
        destination,
        adjustedAmount
      );
      
      toast.dismiss(loadingToast);
      toast.success(
        <div>
          <p>Successfully sent {amount} tokens!</p>
          <p className="text-xs font-mono break-all mt-1">
            To: {destination.toString().substring(0, 8)}...
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
      
      // Refresh balance after sending
      fetchTokenBalance();
      
      // Clear the form
      setReceiverAddress('');
      setAmount(10);
    } catch (error: any) {
      console.error('Error sending tokens:', error);
      toast.error(
        <div>
          <p>Failed to send tokens</p>
          <p className="text-xs mt-1">{error?.message || 'Unknown error'}</p>
        </div>
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">Send Tokens</h2>
      
      {!tokenMint ? (
        <div className="text-amber-400 mb-4">
          Please create a token first using the form above.
        </div>
      ) : (
        <div className="flex flex-col gap-2 mb-4">
          <div>
            <div className="text-sm text-gray-400">Token Mint Address</div>
            <div className="font-mono text-xs break-all">
              {tokenMint.toString()}
            </div>
          </div>
          
          <div className="bg-gray-700 rounded p-2">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-400">Your Token Balance</div>
              <button 
                onClick={fetchTokenBalance}
                className="text-xs text-solana-green hover:underline"
                disabled={isLoadingBalance || !wallet.connected || !tokenMint}
              >
                {isLoadingBalance ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            <div className="font-semibold">
              {isLoadingBalance 
                ? 'Loading...' 
                : balance !== null 
                  ? balance.toString() 
                  : 'Not available'}
            </div>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSendToken}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Receiver Address
          </label>
          <input
            type="text"
            value={receiverAddress}
            onChange={(e) => setReceiverAddress(e.target.value)}
            className="input"
            placeholder="Receiver's wallet address"
            disabled={isLoading || !wallet.connected || !tokenMint}
            required
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Amount to Send
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value))}
            min={0}
            step="0.1"
            className="input"
            disabled={isLoading || !wallet.connected || !tokenMint}
            required
          />
          {balance !== null && (
            <div className="flex justify-end mt-1">
              <button
                type="button"
                className="text-xs text-solana-green hover:underline"
                onClick={() => setAmount(balance)}
                disabled={isLoading || balance === 0}
              >
                Max: {balance}
              </button>
            </div>
          )}
        </div>
        
        <button
          type="submit"
          className="btn btn-secondary w-full"
          disabled={isLoading || !wallet.connected || !tokenMint || (balance !== null && balance === 0)}
        >
          {isLoading ? 'Sending...' : 'Send Tokens'}
        </button>
      </form>
    </div>
  );
};

export default SendToken; 