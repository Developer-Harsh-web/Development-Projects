# Solana Token App

A frontend application that integrates with the Solana blockchain, allowing users to create, mint, and send SPL tokens.

## Features

- **Solana Wallet Integration**
  - Connect and disconnect wallet (Phantom/Solflare)
  - Display wallet address and balance
  - Error handling for wallet connection issues

- **Token Management**
  - Create new tokens using SPL Token Program
  - Mint tokens to your wallet or other addresses
  - Send tokens to other wallets
  - Display transaction history

- **Modern UI/UX**
  - Responsive design for all screen sizes
  - Transaction status notifications
  - Intuitive interface for blockchain interactions

## Technology Stack

- Next.js with TypeScript
- Tailwind CSS for styling
- Solana Web3.js for blockchain interactions
- Solana Wallet Adapter for wallet connections
- SPL Token Program for token operations

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A Solana wallet (Phantom or Solflare) installed as a browser extension

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/solana-token-app.git
cd solana-token-app
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Start the development server:
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Connect Wallet**: Click the "Connect Wallet" button and select your Solana wallet.
2. **Create Token**: Fill in the token creation form to create a new SPL token. You'll need SOL in your devnet wallet.
3. **Mint Tokens**: After creating a token, use the mint form to issue tokens to your wallet or another address.
4. **Send Tokens**: Transfer tokens to other wallets using the send form.
5. **View Transactions**: Check your transaction history at the bottom of the page.

## Development

This application connects to Solana's devnet by default. If you want to use a different network, you can modify the `WalletContextProvider.tsx` file.

## Notes

- The app is connected to Solana's devnet, so real SOL is not used.
- You need devnet SOL to perform transactions. Get some from [Solana Faucet](https://faucet.solana.com/). 