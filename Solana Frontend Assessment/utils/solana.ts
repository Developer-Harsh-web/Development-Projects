import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  Keypair,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  transfer,
  getAccount,
  getMint,
  TokenAccountNotFoundError,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

// Function to get SOL balance
export async function getSolanaBalance(connection: Connection, publicKey: PublicKey): Promise<number> {
  try {
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('Error getting balance:', error);
    throw error;
  }
}

// Function to create a new token
export async function createNewToken(
  connection: Connection,
  payer: any, // WalletContextState
  decimals: number = 9
): Promise<{ tokenMint: PublicKey; txSignature: string }> {
  try {
    if (!payer.publicKey || !payer.signTransaction) {
      throw new Error("Wallet not connected properly");
    }

    // Generate a new keypair for the token mint
    const mintKeypair = Keypair.generate();
    
    // Get minimum lamports for rent exemption
    const lamports = await connection.getMinimumBalanceForRentExemption(
      82 // Minimum size of a mint account
    );

    // Create account instruction
    const createAccountInstruction = SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: 82,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    });

    // Initialize mint instruction from spl-token
    const initializeMintInstruction = await createInitializeMintInstruction(
      mintKeypair.publicKey,
      decimals,
      payer.publicKey,
      payer.publicKey
    );

    // Add both instructions to a transaction
    const transaction = new Transaction().add(
      createAccountInstruction,
      initializeMintInstruction
    );

    // Set recent blockhash and fee payer
    transaction.feePayer = payer.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    // Sign with the mint account first
    transaction.partialSign(mintKeypair);

    // Request wallet signature
    const signedTransaction = await payer.signTransaction(transaction);

    // Send and confirm transaction
    const txSignature = await connection.sendRawTransaction(signedTransaction.serialize());
    await connection.confirmTransaction(txSignature);

    return {
      tokenMint: mintKeypair.publicKey,
      txSignature,
    };
  } catch (error) {
    console.error('Error creating token:', error);
    throw error;
  }
}

// Helper function for initializing a mint
function createInitializeMintInstruction(
  mint: PublicKey,
  decimals: number,
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey
) {
  const keys = [
    { pubkey: mint, isSigner: false, isWritable: true },
    { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false }
  ];
  
  const dataLayout = {
    index: 0,
    decimals: decimals,
    mintAuthority: mintAuthority.toBuffer(),
    freezeAuthorityOption: 1, // 0 = None, 1 = Some
    freezeAuthority: freezeAuthority.toBuffer()
  };
  
  const data = Buffer.alloc(1 + 1 + 32 + 1 + 32);
  data.writeUInt8(0, 0); // Initialize instruction
  data.writeUInt8(dataLayout.decimals, 1);
  dataLayout.mintAuthority.copy(data, 2);
  data.writeUInt8(dataLayout.freezeAuthorityOption, 34);
  dataLayout.freezeAuthority.copy(data, 35);
  
  return {
    keys,
    programId: TOKEN_PROGRAM_ID,
    data
  };
}

// Function to mint tokens
export async function mintTokens(
  connection: Connection,
  payer: any, // WalletContextState
  mint: PublicKey,
  amount: number,
  destinationWallet?: PublicKey
): Promise<{ txSignature: string }> {
  try {
    if (!payer.publicKey || !payer.signTransaction) {
      throw new Error("Wallet not connected properly");
    }

    // Get the destination wallet, default to payer if not provided
    const destination = destinationWallet || payer.publicKey;
    
    // Build transaction for creating token account if it doesn't exist and minting tokens
    const transaction = new Transaction();
    
    // Get or create an associated token account for the recipient
    const associatedTokenAddress = await getOrCreateAssociatedTokenAccountInstruction(
      connection,
      payer.publicKey,
      mint,
      destination,
      transaction
    );
    
    // Add mint instruction
    const mintInstruction = createMintToInstruction(
      mint,
      associatedTokenAddress,
      payer.publicKey, // Mint authority
      amount
    );
    
    transaction.add(mintInstruction);
    
    // Set recent blockhash and fee payer
    transaction.feePayer = payer.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    // Request wallet signature
    const signedTransaction = await payer.signTransaction(transaction);
    
    // Send and confirm transaction
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    await connection.confirmTransaction(signature);
    
    return {
      txSignature: signature,
    };
  } catch (error) {
    console.error('Error minting tokens:', error);
    throw error;
  }
}

// Helper function to get or create an associated token account
async function getOrCreateAssociatedTokenAccountInstruction(
  connection: Connection,
  payer: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  transaction: Transaction
): Promise<PublicKey> {
  // Find the associated token address
  const associatedToken = await findAssociatedTokenAddress(owner, mint);
  
  // Check if the account exists
  const accountInfo = await connection.getAccountInfo(associatedToken);
  
  // If account doesn't exist, add instruction to create it
  if (!accountInfo) {
    const createATAInstruction = createAssociatedTokenAccountInstruction(
      payer,
      associatedToken,
      owner,
      mint
    );
    transaction.add(createATAInstruction);
  }
  
  return associatedToken;
}

// Helper function to find associated token address
async function findAssociatedTokenAddress(
  walletAddress: PublicKey,
  tokenMintAddress: PublicKey
): Promise<PublicKey> {
  return (await PublicKey.findProgramAddress(
    [
      walletAddress.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      tokenMintAddress.toBuffer(),
    ],
    new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL') // Associated Token Program ID
  ))[0];
}

// Helper function to create an associated token account
function createAssociatedTokenAccountInstruction(
  payer: PublicKey,
  associatedToken: PublicKey,
  owner: PublicKey,
  mint: PublicKey
) {
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: associatedToken, isSigner: false, isWritable: true },
    { pubkey: owner, isSigner: false, isWritable: false },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
  ];
  
  return {
    keys,
    programId: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
    data: Buffer.from([])
  };
}

// Helper function for minting tokens
function createMintToInstruction(
  mint: PublicKey,
  destination: PublicKey,
  authority: PublicKey,
  amount: number
) {
  const keys = [
    { pubkey: mint, isSigner: false, isWritable: true },
    { pubkey: destination, isSigner: false, isWritable: true },
    { pubkey: authority, isSigner: true, isWritable: false },
  ];
  
  const data = Buffer.alloc(9);
  data.writeUInt8(7, 0); // Mint instruction
  data.writeBigUInt64LE(BigInt(amount), 1);
  
  return {
    keys,
    programId: TOKEN_PROGRAM_ID,
    data
  };
}

// Function to transfer tokens
export async function transferTokens(
  connection: Connection,
  payer: any, // WalletContextState
  mint: PublicKey,
  destinationWallet: PublicKey,
  amount: number
): Promise<{ txSignature: string }> {
  try {
    if (!payer.publicKey || !payer.signTransaction) {
      throw new Error("Wallet not connected properly");
    }

    // Build transaction for transferring tokens
    const transaction = new Transaction();
    
    // Get source token account
    const sourceTokenAccount = await findAssociatedTokenAddress(
      payer.publicKey,
      mint
    );
    
    // Ensure destination has a token account
    const destinationTokenAccount = await getOrCreateAssociatedTokenAccountInstruction(
      connection,
      payer.publicKey,
      mint,
      destinationWallet,
      transaction
    );
    
    // Add transfer instruction
    const transferInstruction = createTransferInstruction(
      sourceTokenAccount, 
      destinationTokenAccount,
      payer.publicKey,
      amount
    );
    
    transaction.add(transferInstruction);
    
    // Set recent blockhash and fee payer
    transaction.feePayer = payer.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    // Request wallet signature
    const signedTransaction = await payer.signTransaction(transaction);
    
    // Send and confirm transaction
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    await connection.confirmTransaction(signature);
    
    return {
      txSignature: signature,
    };
  } catch (error) {
    console.error('Error transferring tokens:', error);
    throw error;
  }
}

// Helper function for transferring tokens
function createTransferInstruction(
  source: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
  amount: number
) {
  const keys = [
    { pubkey: source, isSigner: false, isWritable: true },
    { pubkey: destination, isSigner: false, isWritable: true },
    { pubkey: owner, isSigner: true, isWritable: false },
  ];
  
  const data = Buffer.alloc(9);
  data.writeUInt8(3, 0); // Transfer instruction
  data.writeBigUInt64LE(BigInt(amount), 1);
  
  return {
    keys,
    programId: TOKEN_PROGRAM_ID,
    data
  };
}

// Function to get token balance
export async function getTokenBalance(
  connection: Connection,
  mint: PublicKey,
  wallet: PublicKey
): Promise<{ balance: number; decimals: number }> {
  try {
    // Get the associated token account
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      { publicKey: wallet } as any, // Just for querying, no signing needed
      mint,
      wallet
    );

    // Get the token account info
    const accountInfo = await getAccount(connection, tokenAccount.address);
    
    // Get the mint info to get decimals
    const mintInfo = await getMint(connection, mint);
    
    // Calculate actual balance based on decimals
    const balance = Number(accountInfo.amount) / Math.pow(10, mintInfo.decimals);
    
    return {
      balance,
      decimals: mintInfo.decimals,
    };
  } catch (error) {
    if (error instanceof TokenAccountNotFoundError) {
      return {
        balance: 0,
        decimals: 0,
      };
    }
    console.error('Error getting token balance:', error);
    throw error;
  }
} 