// Global state
let wallet = null;
let connection = null;
let currentMint = null;
let tokenAccounts = new Map();
let tokenBalances = new Map();

// Constants
const NETWORK = 'devnet';
const DEVNET_ENDPOINT = 'https://api.devnet.solana.com';
const LAMPORTS_PER_SOL = 1000000000;
const TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const MINT_SIZE = 82;

// Data Layout Helpers
const struct = (fields) => {
    const fieldNames = Object.keys(fields);
    const fieldTypes = Object.values(fields);
    
    return {
        layout: {
            span: fieldTypes.reduce((acc, type) => acc + type.span, 0),
            fields: fieldNames.map((name, i) => ({ name, type: fieldTypes[i] }))
        },
        encode: (values, buffer) => {
            let offset = 0;
            fieldNames.forEach((name, i) => {
                const type = fieldTypes[i];
                type.encode(values[name], buffer, offset);
                offset += type.span;
            });
        }
    };
};

const u8 = {
    span: 1,
    encode: (value, buffer, offset) => {
        buffer.writeUInt8(value, offset);
    }
};

const uint64 = {
    span: 8,
    encode: (value, buffer, offset) => {
        buffer.writeBigUInt64LE(value, offset);
    }
};

const publicKey = {
    span: 32,
    encode: (value, buffer, offset) => {
        const bytes = value instanceof Buffer ? value : value.toBuffer();
        bytes.copy(buffer, offset);
    }
};

// Initialize connection
connection = new solanaWeb3.Connection(DEVNET_ENDPOINT, 'confirmed');

// DOM Elements
const connectWalletBtn = document.getElementById('connectWalletBtn');
const disconnectWalletBtn = document.getElementById('disconnectWalletBtn');
const walletDetails = document.getElementById('walletDetails');
const walletAddress = document.getElementById('walletAddress');
const walletBalance = document.getElementById('walletBalance');
const tokenOperations = document.getElementById('tokenOperations');
const createTokenBtn = document.getElementById('createTokenBtn');
const mintTokensBtn = document.getElementById('mintTokensBtn');
const sendTokensBtn = document.getElementById('sendTokensBtn');
const mintAddress = document.getElementById('mintAddress');
const notification = document.getElementById('notification');
const transactionHistory = document.getElementById('transactionHistory');
const transactionList = document.getElementById('transactionList');

// Helper Functions
function showNotification(message, type = 'success') {
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.remove('hidden');
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 5000);
}

function addToTransactionHistory(type, signature, details = {}) {
    const item = document.createElement('div');
    item.className = 'transaction-item';
    
    let detailsHtml = '';
    if (Object.keys(details).length > 0) {
        detailsHtml = '<div class="transaction-details">';
        for (const [key, value] of Object.entries(details)) {
            detailsHtml += `<p><strong>${key}:</strong> ${value}</p>`;
        }
        detailsHtml += '</div>';
    }

    item.innerHTML = `
        <p><strong>${type}</strong></p>
        <p>Signature: <a href="https://explorer.solana.com/tx/${signature}?cluster=devnet" target="_blank">${signature.slice(0, 8)}...${signature.slice(-8)}</a></p>
        <p>Time: ${new Date().toLocaleString()}</p>
        ${detailsHtml}
    `;
    transactionList.insertBefore(item, transactionList.firstChild);
    transactionHistory.classList.remove('hidden');
}

async function updateWalletBalance() {
    if (wallet && wallet.publicKey) {
        try {
            const balance = await connection.getBalance(wallet.publicKey);
            walletBalance.textContent = (balance / LAMPORTS_PER_SOL).toFixed(4);
        } catch (error) {
            console.error('Error fetching balance:', error);
            showNotification('Failed to update wallet balance', 'error');
        }
    }
}

async function getTokenAccountBalance(mint, owner) {
    try {
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, {
            mint: mint
        });
        
        if (tokenAccounts.value.length > 0) {
            const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
            return balance;
        }
        return 0;
    } catch (error) {
        console.error('Error fetching token balance:', error);
        return 0;
    }
}

async function updateTokenBalances() {
    if (!wallet || !wallet.publicKey || !currentMint) return;

    try {
        const balance = await getTokenAccountBalance(currentMint.publicKey, wallet.publicKey);
        tokenBalances.set(currentMint.publicKey.toString(), balance);
        
        // Update UI with token balance
        const tokenBalanceElement = document.getElementById('tokenBalance');
        if (!tokenBalanceElement) {
            const walletContent = document.querySelector('.wallet-content');
            const balanceElement = document.createElement('p');
            balanceElement.id = 'tokenBalance';
            balanceElement.innerHTML = `<i class="fas fa-token"></i> Token Balance: <span>${balance}</span>`;
            walletContent.appendChild(balanceElement);
        } else {
            tokenBalanceElement.querySelector('span').textContent = balance;
        }
    } catch (error) {
        console.error('Error updating token balances:', error);
    }
}

async function fetchTransactionHistory() {
    if (!wallet || !wallet.publicKey) return;

    try {
        const signatures = await connection.getSignaturesForAddress(wallet.publicKey, {
            limit: 10
        });

        for (const sig of signatures) {
            const tx = await connection.getTransaction(sig.signature, {
                maxSupportedTransactionVersion: 0
            });

            if (tx) {
                const type = determineTransactionType(tx);
                if (type) {
                    const details = extractTransactionDetails(tx);
                    addToTransactionHistory(type, sig.signature, details);
                }
            }
        }
    } catch (error) {
        console.error('Error fetching transaction history:', error);
    }
}

function determineTransactionType(transaction) {
    if (!transaction.meta || !transaction.meta.postBalances) return null;

    const instructions = transaction.transaction.message.instructions;
    for (const ix of instructions) {
        if (ix.programId.toString() === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
            if (ix.data.includes('mintTo')) return 'Mint Tokens';
            if (ix.data.includes('transfer')) return 'Transfer Tokens';
        }
    }
    return null;
}

function extractTransactionDetails(transaction) {
    const details = {};
    
    // Extract token amounts
    if (transaction.meta && transaction.meta.postTokenBalances) {
        const tokenBalances = transaction.meta.postTokenBalances;
        if (tokenBalances.length > 0) {
            details['Token Amount'] = tokenBalances[0].uiTokenAmount.uiAmount;
        }
    }

    // Extract recipient if it's a transfer
    if (transaction.meta && transaction.meta.postBalances) {
        const accounts = transaction.transaction.message.accountKeys;
        if (accounts.length > 1) {
            details['Recipient'] = accounts[1].toString();
        }
    }

    return details;
}

// Check if Phantom is installed
function getProvider() {
    if ('phantom' in window) {
        const provider = window.phantom?.solana;
        if (provider?.isPhantom) {
            return provider;
        }
    }
    window.open('https://phantom.app/', '_blank');
    return null;
}

// Wallet Connection
async function connectWallet() {
    try {
        const provider = getProvider();
        if (!provider) {
            throw new Error('Please install Phantom wallet');
        }

        wallet = provider;
        const resp = await wallet.connect();
        
        walletAddress.textContent = resp.publicKey.toString();
        await updateWalletBalance();
        
        walletDetails.classList.remove('hidden');
        tokenOperations.classList.remove('hidden');
        connectWalletBtn.classList.add('hidden');
        
        showNotification('Wallet connected successfully');

        // Listen for account changes
        wallet.on('accountChanged', async (publicKey) => {
            if (publicKey) {
                walletAddress.textContent = publicKey.toString();
                await updateWalletBalance();
                await updateTokenBalances();
                await fetchTransactionHistory();
            } else {
                disconnectWallet();
            }
        });

        // Listen for network changes
        wallet.on('networkChanged', async (network) => {
            if (network !== 'devnet') {
                showNotification('Please switch to Devnet network', 'error');
                disconnectWallet();
            }
        });

        // Initial data fetch
        await fetchTransactionHistory();
        await updateTokenBalances();

    } catch (error) {
        console.error('Connection error:', error);
        showNotification(error.message, 'error');
    }
}

async function disconnectWallet() {
    try {
        if (wallet) {
            await wallet.disconnect();
            wallet = null;
        }
        
        walletDetails.classList.add('hidden');
        tokenOperations.classList.add('hidden');
        connectWalletBtn.classList.remove('hidden');
        transactionHistory.classList.add('hidden');
        
        // Clear token balance display
        const tokenBalanceElement = document.getElementById('tokenBalance');
        if (tokenBalanceElement) {
            tokenBalanceElement.remove();
        }
        
        showNotification('Wallet disconnected');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Token Operations
async function createAssociatedTokenAccount(mint, owner, payer) {
    const associatedToken = await findAssociatedTokenAddress(owner, mint);
    
    const transaction = new solanaWeb3.Transaction().add(
        createAssociatedTokenAccountInstruction(
            payer.publicKey,
            associatedToken,
            owner,
            mint
        )
    );
    
    const signature = await wallet.signAndSendTransaction(transaction);
    await connection.confirmTransaction(signature.signature);
    
    return associatedToken;
}

async function findAssociatedTokenAddress(walletAddress, tokenMintAddress) {
    return (await solanaWeb3.PublicKey.findProgramAddress(
        [
            walletAddress.toBuffer(),
            TOKEN_PROGRAM_ID.toBuffer(),
            tokenMintAddress.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
    ))[0];
}

function createAssociatedTokenAccountInstruction(
    payer,
    associatedToken,
    owner,
    mint
) {
    const keys = [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: associatedToken, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: false, isWritable: false },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: solanaWeb3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];

    return new solanaWeb3.TransactionInstruction({
        keys,
        programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    });
}

async function createToken() {
    if (!wallet || !wallet.publicKey) {
        showNotification('Please connect your wallet first', 'error');
        return;
    }

    try {
        createTokenBtn.classList.add('loading');
        createTokenBtn.disabled = true;

        // Calculate rent-exempt lamports
        const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
        
        // Generate a new mint keypair
        const mintKeypair = solanaWeb3.Keypair.generate();
        
        // Create transaction for token mint account
        const transaction = new solanaWeb3.Transaction().add(
            solanaWeb3.SystemProgram.createAccount({
                fromPubkey: wallet.publicKey,
                newAccountPubkey: mintKeypair.publicKey,
                space: MINT_SIZE,
                lamports,
                programId: TOKEN_PROGRAM_ID,
            }),
            createInitializeMintInstruction(
                mintKeypair.publicKey,
                9,
                wallet.publicKey,
                wallet.publicKey
            )
        );

        const signature = await wallet.signAndSendTransaction(transaction);
        await connection.confirmTransaction(signature.signature);

        currentMint = mintKeypair.publicKey;
        mintAddress.textContent = `Mint Address: ${currentMint.toString()}`;
        mintAddress.classList.remove('hidden');

        // Create associated token account
        const associatedTokenAccount = await createAssociatedTokenAccount(
            currentMint,
            wallet.publicKey,
            wallet
        );

        tokenAccounts.set(currentMint.toString(), associatedTokenAccount);

        showNotification('Token created successfully');
        addToTransactionHistory('Create Token', signature.signature, {
            'Mint Address': currentMint.toString(),
            'Decimals': '9',
            'Authority': wallet.publicKey.toString()
        });

        await updateTokenBalances();
    } catch (error) {
        console.error('Create token error:', error);
        showNotification(error.message, 'error');
    } finally {
        createTokenBtn.classList.remove('loading');
        createTokenBtn.disabled = false;
    }
}

function createInitializeMintInstruction(
    mint,
    decimals,
    mintAuthority,
    freezeAuthority
) {
    const keys = [
        { pubkey: mint, isSigner: false, isWritable: true },
        { pubkey: solanaWeb3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }
    ];

    const dataLayout = struct([
        u8('instruction'),
        u8('decimals'),
        publicKey('mintAuthority'),
        u8('freezeAuthorityOption'),
        publicKey('freezeAuthority')
    ]);

    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode(
        {
            instruction: 0, // InitializeMint instruction
            decimals,
            mintAuthority: mintAuthority.toBuffer(),
            freezeAuthorityOption: 1,
            freezeAuthority: freezeAuthority.toBuffer()
        },
        data
    );

    return new solanaWeb3.TransactionInstruction({
        keys,
        programId: TOKEN_PROGRAM_ID,
        data
    });
}

async function mintTokens() {
    if (!currentMint) {
        showNotification('Please create a token first', 'error');
        return;
    }

    const amount = document.getElementById('mintAmount').value;
    if (!amount || amount <= 0) {
        showNotification('Please enter a valid amount', 'error');
        return;
    }

    try {
        mintTokensBtn.classList.add('loading');
        mintTokensBtn.disabled = true;

        const associatedTokenAccount = await findAssociatedTokenAddress(
            wallet.publicKey,
            currentMint
        );

        const transaction = new solanaWeb3.Transaction().add(
            createMintToInstruction(
                currentMint,
                associatedTokenAccount,
                wallet.publicKey,
                BigInt(amount * Math.pow(10, 9))
            )
        );

        const signature = await wallet.signAndSendTransaction(transaction);
        await connection.confirmTransaction(signature.signature);

        const tokenBalance = await getTokenAccountBalance(currentMint, wallet.publicKey);

        showNotification(`Successfully minted ${amount} tokens`);
        addToTransactionHistory('Mint Tokens', signature.signature, {
            'Amount': amount,
            'New Balance': tokenBalance,
            'Mint Address': currentMint.toString()
        });

        await updateTokenBalances();
    } catch (error) {
        console.error('Mint tokens error:', error);
        showNotification(error.message, 'error');
    } finally {
        mintTokensBtn.classList.remove('loading');
        mintTokensBtn.disabled = false;
    }
}

function createMintToInstruction(
    mint,
    destination,
    authority,
    amount
) {
    const keys = [
        { pubkey: mint, isSigner: false, isWritable: true },
        { pubkey: destination, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: false }
    ];

    const dataLayout = struct([
        u8('instruction'),
        uint64('amount')
    ]);

    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode(
        {
            instruction: 7, // MintTo instruction
            amount
        },
        data
    );

    return new solanaWeb3.TransactionInstruction({
        keys,
        programId: TOKEN_PROGRAM_ID,
        data
    });
}

async function sendTokens() {
    if (!currentMint) {
        showNotification('Please create a token first', 'error');
        return;
    }

    const recipientAddress = document.getElementById('recipientAddress').value;
    const amount = document.getElementById('sendAmount').value;

    if (!recipientAddress || !amount || amount <= 0) {
        showNotification('Please enter valid recipient address and amount', 'error');
        return;
    }

    try {
        sendTokensBtn.classList.add('loading');
        sendTokensBtn.disabled = true;

        const recipientPublicKey = new solanaWeb3.PublicKey(recipientAddress);

        const sourceAccount = await findAssociatedTokenAddress(
            wallet.publicKey,
            currentMint
        );

        const destinationAccount = await findAssociatedTokenAddress(
            recipientPublicKey,
            currentMint
        );

        // Check if destination account exists, if not create it
        const destinationAccountInfo = await connection.getAccountInfo(destinationAccount);
        let transaction = new solanaWeb3.Transaction();

        if (!destinationAccountInfo) {
            transaction.add(
                createAssociatedTokenAccountInstruction(
                    wallet.publicKey,
                    destinationAccount,
                    recipientPublicKey,
                    currentMint
                )
            );
        }

        // Check balance before sending
        const sourceBalance = await getTokenAccountBalance(currentMint, wallet.publicKey);
        if (sourceBalance < amount) {
            throw new Error('Insufficient token balance');
        }

        transaction.add(
            createTransferInstruction(
                sourceAccount,
                destinationAccount,
                wallet.publicKey,
                BigInt(amount * Math.pow(10, 9))
            )
        );

        const signature = await wallet.signAndSendTransaction(transaction);
        await connection.confirmTransaction(signature.signature);

        const newBalance = await getTokenAccountBalance(currentMint, wallet.publicKey);

        showNotification(`Successfully sent ${amount} tokens`);
        addToTransactionHistory('Send Tokens', signature.signature, {
            'Amount': amount,
            'Recipient': recipientAddress,
            'New Balance': newBalance,
            'Mint Address': currentMint.toString()
        });

        await updateTokenBalances();
    } catch (error) {
        console.error('Send tokens error:', error);
        showNotification(error.message, 'error');
    } finally {
        sendTokensBtn.classList.remove('loading');
        sendTokensBtn.disabled = false;
    }
}

function createTransferInstruction(
    source,
    destination,
    owner,
    amount
) {
    const keys = [
        { pubkey: source, isSigner: false, isWritable: true },
        { pubkey: destination, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: false }
    ];

    const dataLayout = struct([
        u8('instruction'),
        uint64('amount')
    ]);

    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode(
        {
            instruction: 3, // Transfer instruction
            amount
        },
        data
    );

    return new solanaWeb3.TransactionInstruction({
        keys,
        programId: TOKEN_PROGRAM_ID,
        data
    });
}

// Event Listeners
connectWalletBtn.addEventListener('click', connectWallet);
disconnectWalletBtn.addEventListener('click', disconnectWallet);
createTokenBtn.addEventListener('click', createToken);
mintTokensBtn.addEventListener('click', mintTokens);
sendTokensBtn.addEventListener('click', sendTokens);

// Check for Phantom wallet on page load
window.addEventListener('load', async () => {
    const provider = getProvider();
    if (provider) {
        try {
            const resp = await provider.connect({ onlyIfTrusted: true });
            wallet = provider;
            walletAddress.textContent = resp.publicKey.toString();
            await updateWalletBalance();
            walletDetails.classList.remove('hidden');
            tokenOperations.classList.remove('hidden');
            connectWalletBtn.classList.add('hidden');
            
            // Initial data fetch
            await fetchTransactionHistory();
            await updateTokenBalances();
        } catch (err) {
            // User hasn't connected to the app before
            console.log('User needs to connect manually');
        }
    }
}); 