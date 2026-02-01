# DecaDex Bot - Confidential Auction Platform

A Telegram bot for confidential auctions using Fully Homomorphic Encryption (FHE) on Zama fhEVM.

## Overview

DecaDex Bot enables privacy-preserving auctions where bid amounts are encrypted end-to-end. No one - not even the contract owner - can see individual bid values until the auction ends.

## Features

- **FHE Encrypted Bids**: Bid amounts are encrypted using Zama's fhEVM, ensuring complete privacy
- **Telegram Interface**: Simple and intuitive bidding through Telegram commands
- **Blockchain Security**: All transactions are recorded on Ethereum Sepolia testnet
- **Secure Key Management**: Private keys are securely handled via environment variables

## Prerequisites

- Node.js 18+
- npm or yarn
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- Ethereum wallet with private key
- RPC URL (Alchemy/Infura/public RPC)

## Installation

```bash
# Clone repository
git clone https://github.com/kaixar-bot/decadex-bot.git
cd decadex-bot

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your actual values

# Start the bot
npm start
```

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Token from @BotFather |
| `PRIVATE_KEY` | Ethereum wallet private key (with 0x prefix) |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `RPC_URL` | Sepolia public RPC | Ethereum RPC endpoint |
| `CONTRACT_ADDRESS` | DecaDex testnet | Auction contract address |
| `RELAYER_URL` | Zama testnet relayer | fhEVM relayer URL |

## Replit Deployment

For Replit, use **Secrets** (not .env file):

1. Open your Replit project
2. Click "Tools" > "Secrets"
3. Add the required variables:
   - `TELEGRAM_BOT_TOKEN`
   - `PRIVATE_KEY`
4. Click "Run"

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and quick guide |
| `/bid <amount>` | Place an encrypted bid (e.g., `/bid 100`) |
| `/status` | Check bot and blockchain connection status |
| `/help` | Show all available commands |

### Example Usage

```
User: /bid 150
Bot: Processing bid 150...
     Encrypting with FHE...
     Sending transaction...
     
     Bid successful!
     Tx: 0x1234...abcd
     Block: 12345678
```

## Tech Stack

- **Runtime**: Node.js 18+
- **Bot Framework**: node-telegram-bot-api
- **Blockchain**: ethers.js v6
- **FHE Encryption**: @zama-fhe/relayer-sdk
- **Network**: Ethereum Sepolia Testnet
- **FHE Infrastructure**: Zama fhEVM

## Architecture

```
User (Telegram)
     |
     v
[Telegram Bot] ---> [fhEVM SDK] ---> [Encrypted Input]
     |                                      |
     v                                      v
[ethers.js] -----> [Sepolia Testnet] <---- [Zama Relayer]
     |
     v
[DecaDex Contract]
```

## Security Considerations

- **Never commit** `.env` or expose private keys
- Use **Replit Secrets** for deployment
- Contract address is checksummed using `ethers.getAddress()`
- All bid amounts are encrypted before leaving the client

## Troubleshooting

### Common Issues

1. **"Contract address is not a valid address"**
   - Ensure the contract address is properly checksummed
   - The bot automatically handles this via `ethers.getAddress()`

2. **"Invalid relayerUrl: undefined"**
   - Set `RELAYER_URL` or use the default Zama testnet relayer

3. **Bot not responding**
   - Check `TELEGRAM_BOT_TOKEN` is correct
   - Ensure no other instance is running (409 Conflict)

4. **Transaction failing**
   - Verify wallet has Sepolia ETH for gas
   - Check RPC_URL is working

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Links

- [Zama fhEVM Documentation](https://docs.zama.ai/fhevm)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [ethers.js Documentation](https://docs.ethers.org/v6/)
