# DecaDex Bot - Zama fhEVM Confidential Bids

Bot Telegram cho phÃ©p Äáº¥u giÃ¡ vá»i mÃ£ hÃ³a FHE (Fully Homomorphic Encryption) sá»­ dá»¥ng Zama fhEVM.

## TÃ­nh nÄng

- ð **MÃ£ hÃ³a FHE**: GiÃ¡ tháº§u ÄÆ°á»£c mÃ£ hÃ³a hoÃ n toÃ n, khÃ´ng ai cÃ³ thá» xem sá» tiá»n
- ð¤ **Telegram Bot**: Giao diá»n ÄÆ¡n giáº£n qua Telegram
- âï¸ **Blockchain**: Giao dá»ch trÃªn Sepolia testnet
- ð¡ï¸ **Báº£o máº­t**: Private key ÄÆ°á»£c giá»¯ an toÃ n

## YÃªu cáº§u

- Node.js 18+
- NPM hoáº·c Yarn
- Telegram Bot Token (tá»« @BotFather)
- Ethereum wallet vá»i private key
- RPC URL (Alchemy/Infura/etc.)

## CÃ i Äáº·t

```bash
# Clone repository
git clone https://github.com/kaixar-bot/decadex-bot.git
cd decadex-bot

# CÃ i Äáº·t dependencies
npm install

# Cáº¥u hÃ¬nh environment variables
cp .env.example .env
# Sá»­a file .env vá»i cÃ¡c giÃ¡ trá» tháº­t

# Cháº¡y bot
npm start
```

## Environment Variables

### Required (Báº¯t buá»c)

| Variable | MÃ´ táº£ |
|----------|-------|
| `TELEGRAM_BOT_TOKEN` | Token tá»« @BotFather |
| `PRIVATE_KEY` | Private key vÃ­ Ethereum (64 hex chars) |
| `RPC_URL` | URL RPC endpoint (Alchemy/Infura/etc.) |

### Optional (CÃ³ default)

| Variable | Default | MÃ´ táº£ |
|----------|---------|-------|
| `CONTRACT_ADDRESS` | `0xe9c1349c959f98f3d6e1c25b1bc3a4376921423d` | Äá»a chá» smart contract |
| `RELAYER_URL` | `https://relayer.testnet.zama.org` | URL Zama relayer |

> **Note**: KHÃNG cáº§n `ALCHEMY_API_KEY` riÃªng náº¿u ÄÃ£ cÃ³ `RPC_URL` Äáº§y Äá»§.

## Sá»­ dá»¥ng

### Telegram Commands

| Command | MÃ´ táº£ |
|---------|-------|
| `/start` | Báº¯t Äáº§u vÃ  xem hÆ°á»ng dáº«n |
| `/bid <amount>` | Äáº·t giÃ¡ tháº§u (vÃ­ dá»¥: `/bid 100`) |
| `/status` | Kiá»m tra tráº¡ng thÃ¡i auction |
| `/help` | Xem trá»£ giÃºp |

### VÃ­ dá»¥

```
User: /bid 500
Bot: â³ Äang xá»­ lÃ½ bid 500...
     ð Äang mÃ£ hÃ³a vá»i FHE...
     ð¤ Äang gá»­i transaction...
     â Bid thÃ nh cÃ´ng!
```

## Cáº¥u trÃºc project

```
decadex-bot/
âââ index.js              # Entry point chÃ­nh
âââ src/
â   âââ validators.js     # Validation functions
â   âââ fhevm-singleton.js # FhEVM instance management
â   âââ contract-abi.js   # Smart contract ABI
âââ .env.example          # Template environment
âââ package.json
âââ README.md
```

## Troubleshooting

### Lá»i 409 Conflict
Bot ÄÃ£ tá»± Äá»ng xá»­ lÃ½ báº±ng cÃ¡ch xÃ³a webhook trÆ°á»c khi polling. Náº¿u váº«n gáº·p lá»i:
1. Äá»£i vÃ i phÃºt cho session cÅ© timeout
2. Äáº£m báº£o chá» cÃ³ 1 instance bot cháº¡y

### Lá»i "Thiáº¿u biáº¿n mÃ´i trÆ°á»ng"
Kiá»m tra ÄÃ£ thiáº¿t láº­p Äá»§ 3 biáº¿n báº¯t buá»c:
- `TELEGRAM_BOT_TOKEN`
- `PRIVATE_KEY`
- `RPC_URL`

### Lá»i FhEVM
- Äáº£m báº£o RPC_URL lÃ  Sepolia endpoint há»£p lá»
- Kiá»m tra RELAYER_URL ÄÃºng format

## Tech Stack

- **Runtime**: Node.js (ESM modules)
- **Telegram**: node-telegram-bot-api
- **Blockchain**: ethers.js v6
- **FHE**: @zama-fhe/relayer-sdk

## License

MIT

## Contributing

PRs welcome! Vui lÃ²ng táº¡o issue trÆ°á»c khi submit PR lá»n.
