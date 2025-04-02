import { FC, useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, ConfirmedSignatureInfo } from '@solana/web3.js';

interface TokenHistoryProps {
  tokenMint: PublicKey | null;
}

interface Transaction {
  signature: string;
  blockTime: number | null;
  type: string;
}

const TokenHistory: FC<TokenHistoryProps> = ({ tokenMint }) => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (wallet.publicKey && tokenMint) {
      fetchTransactions();
    } else {
      setTransactions([]);
    }
  }, [wallet.publicKey, tokenMint, connection]);

  const fetchTransactions = async () => {
    if (!wallet.publicKey || !tokenMint) return;
    
    try {
      setIsLoading(true);
      
      // Get signature history for the connected wallet
      const signatures = await connection.getSignaturesForAddress(wallet.publicKey, {
        limit: 10
      });
      
      // Filter and process transactions
      const txs = await Promise.all(
        signatures.map(async (sig) => {
          try {
            const tx = await connection.getTransaction(sig.signature, {
              maxSupportedTransactionVersion: 0,
            });
            
            // Basic transaction classification, could be improved
            let type = 'Unknown';
            if (tx && tx.meta) {
              if (tx.meta.logMessages?.some(log => log.includes('initialize mint'))) {
                type = 'Create Token';
              } else if (tx.meta.logMessages?.some(log => log.includes('mint to'))) {
                type = 'Mint Token';
              } else if (tx.meta.logMessages?.some(log => log.includes('transfer'))) {
                type = 'Transfer Token';
              }
            }
            
            return {
              signature: sig.signature,
              blockTime: sig.blockTime,
              type
            };
          } catch (error) {
            console.error('Error processing transaction:', error);
            return {
              signature: sig.signature,
              blockTime: sig.blockTime,
              type: 'Error Loading'
            };
          }
        })
      );
      
      setTransactions(txs);
    } catch (error) {
      console.error('Error fetching transaction history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'Unknown time';
    return new Date(timestamp * 1000).toLocaleString();
  };

  const shortenSignature = (signature: string) => {
    return `${signature.slice(0, 6)}...${signature.slice(-6)}`;
  };

  const getExplorerLink = (signature: string) => {
    return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
  };

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">Transaction History</h2>
      
      {!wallet.connected ? (
        <div className="text-amber-400">
          Please connect your wallet to view transactions.
        </div>
      ) : !tokenMint ? (
        <div className="text-amber-400">
          Please create a token first to view related transactions.
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-4">
          <div className="animate-pulse">Loading transactions...</div>
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-gray-400 py-4 text-center">
          No transactions found for this wallet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 text-sm text-gray-400">Type</th>
                <th className="text-left py-2 text-sm text-gray-400">Signature</th>
                <th className="text-left py-2 text-sm text-gray-400">Time</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.signature} className="border-b border-gray-700 hover:bg-gray-700">
                  <td className="py-2">{tx.type}</td>
                  <td className="py-2">
                    <a 
                      href={getExplorerLink(tx.signature)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-solana-green hover:underline"
                    >
                      {shortenSignature(tx.signature)}
                    </a>
                  </td>
                  <td className="py-2 text-sm">{formatDate(tx.blockTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {wallet.connected && tokenMint && (
        <button 
          onClick={fetchTransactions}
          className="btn btn-outline w-full mt-4"
          disabled={isLoading}
        >
          Refresh Transactions
        </button>
      )}
    </div>
  );
};

export default TokenHistory; 