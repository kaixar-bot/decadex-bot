// Debug: Load dotenv for local development (.env file)
// Note: Replit Secrets are auto-injected into process.env before this runs
import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { ethers } from "ethers";
import { readFileSync } from "fs";

// Import cÃ¡c module ÄÃ£ tÃ¡ch
import { 
  initializeFhEVM, 
  getFhEVMInstance, 
  isInitialized,
  encryptBidAmount 
} from "./src/fhevm-singleton.js";
import { 
  validateBidAmount, 
  validateEnvVariables,
  BID_LIMITS 
} from "./src/validators.js";

// === DEBUG: Log available environment variables (names only, not values for security) ===
console.log("=== ENVIRONMENT DEBUG ===");
console.log("[ENV] Available environment variables:");
const envKeys = Object.keys(process.env).filter(key => 
  !key.startsWith('npm_') && 
  !key.startsWith('NODE_') &&
  !key.startsWith('PATH') &&
  !key.startsWith('HOME') &&
  !key.startsWith('SHELL') &&
  !key.startsWith('USER') &&
  !key.startsWith('LANG') &&
  !key.startsWith('TERM') &&
  !key.startsWith('XDG_') &&
  !key.startsWith('REPLIT_') &&
  !key.startsWith('NIX_') &&
  !key.startsWith('HOSTNAME') &&
  !key.startsWith('PWD') &&
  !key.startsWith('COLORTERM') &&
  !key.startsWith('DENO_') &&
  !key.startsWith('GIT_') &&
  key !== '_' &&
  key !== 'SHLVL' &&
  key !== 'OLDPWD'
);
console.log("[ENV] Keys found:", envKeys);

// Check specific required vars
const requiredVars = ["TELEGRAM_BOT_TOKEN", "PRIVATE_KEY", "CONTRACT_ADDRESS", "ALCHEMY_API_KEY", "RPC_URL"];
console.log("[ENV] Checking required variables:");
requiredVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? `SET (length: ${value.length})` : "NOT SET";
  console.log(`  - ${varName}: ${status}`);
});
console.log("=== END ENVIRONMENT DEBUG ===\n");

console.log("=== DECADEX BOT STARTING ===");
console.log(`[Bot] ThÃ¡Â»Âi gian khÃ¡Â»Âi ÃÂÃ¡Â»Âng: ${new Date().toISOString()}`);
console.log(`[Bot] Node version: ${process.version}`);

// ============================================
// PHÃ¡ÂºÂ¦N 1: CÃ¡ÂºÂ¤U HÃÂNH VÃÂ KHÃ¡Â»ÂI TÃ¡ÂºÂ O
// ============================================

/**
 * Danh sÃÂ¡ch cÃÂ¡c biÃ¡ÂºÂ¿n mÃÂ´i trÃÂ°Ã¡Â»Âng bÃ¡ÂºÂ¯t buÃ¡Â»Âc
 * LÃÂ°u ÃÂ½: RPC_URL lÃÂ  optional - nÃ¡ÂºÂ¿u khÃÂ´ng cÃÂ³ sÃ¡ÂºÂ½ dÃÂ¹ng ALCHEMY_API_KEY ÃÂÃ¡Â»Â tÃ¡ÂºÂ¡o URL
 */
const REQUIRED_ENV_VARS = [
  "TELEGRAM_BOT_TOKEN",
  "PRIVATE_KEY", 
  "CONTRACT_ADDRESS",
];

/**
 * BiÃ¡ÂºÂ¿n mÃÂ´i trÃÂ°Ã¡Â»Âng cÃ¡ÂºÂ§n ÃÂ­t nhÃ¡ÂºÂ¥t 1 trong 2
 * User cÃ¡ÂºÂ§n cÃÂ³ ALCHEMY_API_KEY hoÃ¡ÂºÂ·c RPC_URL
 */
const RPC_ENV_VARS = ["ALCHEMY_API_KEY", "RPC_URL"];

/**
 * Validate vÃÂ  load environment variables
 */
console.log("[Bot] KiÃ¡Â»Âm tra environment variables...");
const envValidation = validateEnvVariables(process.env, REQUIRED_ENV_VARS);
if (!envValidation.isValid) {
  console.error("[ERROR] " + envValidation.error);
  console.error("[INFO] Vui lÃÂ²ng kiÃ¡Â»Âm tra file .env hoÃ¡ÂºÂ·c Replit Secrets");
  process.exit(1);
}
console.log("[Bot] Ã¢ÂÂ Environment variables hÃ¡Â»Â£p lÃ¡Â»Â");

// KiÃ¡Â»Âm tra phÃ¡ÂºÂ£i cÃÂ³ ÃÂ­t nhÃ¡ÂºÂ¥t ALCHEMY_API_KEY hoÃ¡ÂºÂ·c RPC_URL
const hasAlchemyKey = process.env.ALCHEMY_API_KEY && process.env.ALCHEMY_API_KEY.trim() !== "";
const hasRpcUrl = process.env.RPC_URL && process.env.RPC_URL.trim() !== "";

if (!hasAlchemyKey && !hasRpcUrl) {
  console.error("[ERROR] ThiÃ¡ÂºÂ¿u cÃ¡ÂºÂ¥u hÃÂ¬nh RPC. CÃ¡ÂºÂ§n ÃÂ­t nhÃ¡ÂºÂ¥t mÃ¡Â»Ât trong hai:");
  console.error("  - ALCHEMY_API_KEY");
  console.error("  - RPC_URL");
  process.exit(1);
}

// XÃÂ¢y dÃ¡Â»Â±ng RPC URL
let RPC_URL;
if (hasRpcUrl) {
  RPC_URL = process.env.RPC_URL;
  console.log("[Bot] SÃ¡Â»Â­ dÃ¡Â»Â¥ng RPC_URL tÃ¡Â»Â« environment");
} else {
  RPC_URL = `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
  console.log("[Bot] SÃ¡Â»Â­ dÃ¡Â»Â¥ng Alchemy API Key ÃÂÃ¡Â»Â tÃ¡ÂºÂ¡o RPC URL");
}

// Log config (Ã¡ÂºÂ©n sensitive data)
console.log("[Bot] CÃ¡ÂºÂ¥u hÃÂ¬nh:");
console.log(`  - TELEGRAM_BOT_TOKEN: ***${process.env.TELEGRAM_BOT_TOKEN.slice(-4)}`);
console.log(`  - CONTRACT_ADDRESS: ${process.env.CONTRACT_ADDRESS}`);
console.log(`  - RPC_URL: ${RPC_URL.substring(0, 40)}...`);
console.log(`  - RELAYER_URL: ${process.env.RELAYER_URL || "(sÃ¡ÂºÂ½ dÃÂ¹ng default)"}`);

// Load ABI
let contractABI;
try {
  const abiContent = readFileSync("./abi.json", "utf-8");
  contractABI = JSON.parse(abiContent);
  console.log("[Bot] Ã¢ÂÂ ÃÂÃÂ£ load ABI thÃÂ nh cÃÂ´ng");
} catch (error) {
  console.error("[ERROR] KhÃÂ´ng thÃ¡Â»Â load ABI:", error.message);
  process.exit(1);
}

// KhÃ¡Â»Âi tÃ¡ÂºÂ¡o provider vÃÂ  wallet
console.log("[Bot] KhÃ¡Â»Âi tÃ¡ÂºÂ¡o Ethereum provider...");
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI, wallet);
console.log(`[Bot] Ã¢ÂÂ Wallet address: ${wallet.address}`);

// ============================================
// PHÃ¡ÂºÂ¦N 2: KHÃ¡Â»ÂI TÃ¡ÂºÂ O TELEGRAM BOT
// ============================================

console.log("[Bot] KhÃ¡Â»Âi tÃ¡ÂºÂ¡o Telegram Bot...");
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Log khi bot sÃ¡ÂºÂµn sÃÂ ng
bot.on("polling_error", (error) => {
  console.error("[Bot] Polling error:", error.code, error.message);
});

console.log("[Bot] Ã¢ÂÂ Telegram Bot ÃÂÃÂ£ khÃ¡Â»Âi tÃ¡ÂºÂ¡o vÃ¡Â»Âi polling mode");

// ============================================
// PHÃ¡ÂºÂ¦N 3: KHÃ¡Â»ÂI TÃ¡ÂºÂ O fhEVM
// ============================================

console.log("[Bot] BÃ¡ÂºÂ¯t ÃÂÃ¡ÂºÂ§u khÃ¡Â»Âi tÃ¡ÂºÂ¡o fhEVM...");
let fhevmReady = false;

initializeFhEVM({
  networkUrl: RPC_URL,
  verifyingContract: process.env.CONTRACT_ADDRESS,
  relayerUrl: process.env.RELAYER_URL, // SÃ¡ÂºÂ½ dÃÂ¹ng default nÃ¡ÂºÂ¿u undefined
}).then(() => {
  fhevmReady = true;
  console.log("[Bot] Ã¢ÂÂ fhEVM ÃÂÃÂ£ sÃ¡ÂºÂµn sÃÂ ng!");
}).catch((error) => {
  console.error("[Bot] Ã¢ÂÂ KhÃÂ´ng thÃ¡Â»Â khÃ¡Â»Âi tÃ¡ÂºÂ¡o fhEVM:", error.message);
  console.error("[Bot] Stack trace:", error.stack);
  // KhÃÂ´ng exit - bot vÃ¡ÂºÂ«n cÃÂ³ thÃ¡Â»Â phÃ¡ÂºÂ£n hÃ¡Â»Âi vÃ¡Â»Âi thÃÂ´ng bÃÂ¡o lÃ¡Â»Âi
});

// ============================================
// PHÃ¡ÂºÂ¦N 4: XÃ¡Â»Â¬ LÃÂ COMMANDS
// ============================================

// TrÃ¡ÂºÂ¡ng thÃÂ¡i ÃÂang chÃ¡Â»Â bid cho mÃ¡Â»Âi user
const pendingBids = new Map();

/**
 * XÃ¡Â»Â­ lÃÂ½ lÃ¡Â»Ânh /start
 */
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const username = msg.from?.username || msg.from?.first_name || "Unknown";
  
  console.log(`[Command] /start tÃ¡Â»Â« user ${username} (ID: ${userId}) trong chat ${chatId}`);
  console.log(`[Command] Message object: ${JSON.stringify(msg, null, 2)}`);
  
  try {
    const welcomeMessage = `
Ã°ÂÂÂ¯ *ChÃÂ o mÃ¡Â»Â«ng ÃÂÃ¡ÂºÂ¿n vÃ¡Â»Âi DecaDex Bot!*

Bot nÃÂ y cho phÃÂ©p bÃ¡ÂºÂ¡n ÃÂÃ¡ÂºÂ·t bid mÃÂ£ hÃÂ³a (encrypted bid) sÃ¡Â»Â­ dÃ¡Â»Â¥ng cÃÂ´ng nghÃ¡Â»Â FHE (Fully Homomorphic Encryption).

Ã°ÂÂÂ *CÃÂ¡c lÃ¡Â»Ânh cÃÂ³ sÃ¡ÂºÂµn:*
Ã¢ÂÂ¢ /start - HiÃ¡Â»Ân thÃ¡Â»Â menu nÃÂ y
Ã¢ÂÂ¢ /bid - ÃÂÃ¡ÂºÂ·t bid mÃ¡Â»Âi (sÃ¡ÂºÂ½ hÃ¡Â»Âi sÃ¡Â»Â tiÃ¡Â»Ân)
Ã¢ÂÂ¢ /help - HÃÂ°Ã¡Â»Âng dÃ¡ÂºÂ«n chi tiÃ¡ÂºÂ¿t
Ã¢ÂÂ¢ /status - KiÃ¡Â»Âm tra trÃ¡ÂºÂ¡ng thÃÂ¡i hÃ¡Â»Â thÃ¡Â»Âng

Ã°ÂÂÂ¡ *GiÃ¡Â»Âi hÃ¡ÂºÂ¡n bid:*
Ã¢ÂÂ¢ TÃ¡Â»Âi thiÃ¡Â»Âu: ${BID_LIMITS.MIN} wei
Ã¢ÂÂ¢ TÃ¡Â»Âi ÃÂa: ${BID_LIMITS.MAX} wei

Ã°ÂÂÂ Bid cÃ¡Â»Â§a bÃ¡ÂºÂ¡n sÃ¡ÂºÂ½ ÃÂÃÂ°Ã¡Â»Â£c mÃÂ£ hÃÂ³a trÃÂ°Ã¡Â»Âc khi gÃ¡Â»Â­i lÃÂªn blockchain!
    `;
    
    await bot.sendMessage(chatId, welcomeMessage, { parse_mode: "Markdown" });
    console.log(`[Command] Ã¢ÂÂ ÃÂÃÂ£ gÃ¡Â»Â­i welcome message cho user ${username}`);
  } catch (error) {
    console.error(`[Command] Ã¢ÂÂ LÃ¡Â»Âi khi xÃ¡Â»Â­ lÃÂ½ /start:`);
    console.error(`[Command] Error: ${error.message}`);
    console.error(`[Command] Stack: ${error.stack}`);
    
    try {
      await bot.sendMessage(chatId, "Ã¢ÂÂ CÃÂ³ lÃ¡Â»Âi xÃ¡ÂºÂ£y ra. Vui lÃÂ²ng thÃ¡Â»Â­ lÃ¡ÂºÂ¡i sau.");
    } catch (sendError) {
      console.error(`[Command] KhÃÂ´ng thÃ¡Â»Â gÃ¡Â»Â­i error message: ${sendError.message}`);
    }
  }
});

/**
 * XÃ¡Â»Â­ lÃÂ½ lÃ¡Â»Ânh /help
 */
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from?.username || msg.from?.first_name || "Unknown";
  
  console.log(`[Command] /help tÃ¡Â»Â« user ${username} trong chat ${chatId}`);
  
  try {
    const helpMessage = `
Ã°ÂÂÂ *HÃÂ°Ã¡Â»Âng dÃ¡ÂºÂ«n sÃ¡Â»Â­ dÃ¡Â»Â¥ng DecaDex Bot*

*1. ÃÂÃ¡ÂºÂ·t bid:*
   Ã¢ÂÂ¢ GÃ¡Â»Â­i lÃ¡Â»Ânh /bid
   Ã¢ÂÂ¢ Bot sÃ¡ÂºÂ½ hÃ¡Â»Âi sÃ¡Â»Â tiÃ¡Â»Ân bid (ÃÂÃÂ¡n vÃ¡Â»Â: wei)
   Ã¢ÂÂ¢ NhÃ¡ÂºÂ­p sÃ¡Â»Â tiÃ¡Â»Ân vÃÂ  gÃ¡Â»Â­i
   Ã¢ÂÂ¢ Bot sÃ¡ÂºÂ½ mÃÂ£ hÃÂ³a vÃÂ  gÃ¡Â»Â­i transaction

*2. KiÃ¡Â»Âm tra trÃ¡ÂºÂ¡ng thÃÂ¡i:*
   Ã¢ÂÂ¢ GÃ¡Â»Â­i lÃ¡Â»Ânh /status ÃÂÃ¡Â»Â xem trÃ¡ÂºÂ¡ng thÃÂ¡i hÃ¡Â»Â thÃ¡Â»Âng

*3. LÃÂ°u ÃÂ½ quan trÃ¡Â»Âng:*
   Ã¢ÂÂ¢ Bid ÃÂÃÂ°Ã¡Â»Â£c mÃÂ£ hÃÂ³a hoÃÂ n toÃÂ n bÃ¡ÂºÂ±ng FHE
   Ã¢ÂÂ¢ KhÃÂ´ng ai cÃÂ³ thÃ¡Â»Â biÃ¡ÂºÂ¿t sÃ¡Â»Â tiÃ¡Â»Ân bid cÃ¡Â»Â§a bÃ¡ÂºÂ¡n
   Ã¢ÂÂ¢ Transaction cÃ¡ÂºÂ§n gas fee (Sepolia ETH)

*4. Troubleshooting:*
   Ã¢ÂÂ¢ NÃ¡ÂºÂ¿u bot khÃÂ´ng phÃ¡ÂºÂ£n hÃ¡Â»Âi, thÃ¡Â»Â­ /start
   Ã¢ÂÂ¢ KiÃ¡Â»Âm tra kÃ¡ÂºÂ¿t nÃ¡Â»Âi mÃ¡ÂºÂ¡ng
   Ã¢ÂÂ¢ ÃÂÃ¡ÂºÂ£m bÃ¡ÂºÂ£o wallet cÃÂ³ ÃÂÃ¡Â»Â§ gas

Ã°ÂÂÂ§ HÃ¡Â»Â trÃ¡Â»Â£: LiÃÂªn hÃ¡Â»Â admin nÃ¡ÂºÂ¿u gÃ¡ÂºÂ·p vÃ¡ÂºÂ¥n ÃÂÃ¡Â»Â
    `;
    
    await bot.sendMessage(chatId, helpMessage, { parse_mode: "Markdown" });
    console.log(`[Command] Ã¢ÂÂ ÃÂÃÂ£ gÃ¡Â»Â­i help message`);
  } catch (error) {
    console.error(`[Command] Ã¢ÂÂ LÃ¡Â»Âi /help: ${error.message}`);
    console.error(`[Command] Stack: ${error.stack}`);
  }
});

/**
 * XÃ¡Â»Â­ lÃÂ½ lÃ¡Â»Ânh /status
 */
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from?.username || msg.from?.first_name || "Unknown";
  
  console.log(`[Command] /status tÃ¡Â»Â« user ${username}`);
  
  try {
    // KiÃ¡Â»Âm tra cÃÂ¡c thÃÂ nh phÃ¡ÂºÂ§n
    let networkStatus = "Ã¢ÂÂ ChÃÂ°a kÃ¡ÂºÂ¿t nÃ¡Â»Âi";
    let blockNumber = "N/A";
    let balance = "N/A";
    
    try {
      const network = await provider.getNetwork();
      blockNumber = await provider.getBlockNumber();
      const walletBalance = await provider.getBalance(wallet.address);
      balance = ethers.formatEther(walletBalance) + " ETH";
      networkStatus = `Ã¢ÂÂ ${network.name} (Chain ID: ${network.chainId})`;
    } catch (e) {
      console.error(`[Status] LÃ¡Â»Âi kiÃ¡Â»Âm tra network: ${e.message}`);
    }
    
    const statusMessage = `
Ã°ÂÂÂ *TrÃ¡ÂºÂ¡ng thÃÂ¡i hÃ¡Â»Â thÃ¡Â»Âng*

Ã°ÂÂÂ *Network:* ${networkStatus}
Ã°ÂÂÂ¦ *Block hiÃ¡Â»Ân tÃ¡ÂºÂ¡i:* ${blockNumber}
Ã°ÂÂÂ° *Wallet balance:* ${balance}
Ã°ÂÂÂ *fhEVM:* ${fhevmReady ? "Ã¢ÂÂ SÃ¡ÂºÂµn sÃÂ ng" : "Ã¢ÂÂ ChÃÂ°a khÃ¡Â»Âi tÃ¡ÂºÂ¡o"}
Ã°ÂÂ¤Â *Bot:* Ã¢ÂÂ ÃÂang hoÃ¡ÂºÂ¡t ÃÂÃ¡Â»Âng

Ã°ÂÂÂ *Contract:* \`${process.env.CONTRACT_ADDRESS}\`
    `;
    
    await bot.sendMessage(chatId, statusMessage, { parse_mode: "Markdown" });
    console.log(`[Command] Ã¢ÂÂ ÃÂÃÂ£ gÃ¡Â»Â­i status`);
  } catch (error) {
    console.error(`[Command] Ã¢ÂÂ LÃ¡Â»Âi /status: ${error.message}`);
    console.error(`[Command] Stack: ${error.stack}`);
  }
});

/**
 * XÃ¡Â»Â­ lÃÂ½ lÃ¡Â»Ânh /bid
 */
bot.onText(/\/bid/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const username = msg.from?.username || msg.from?.first_name || "Unknown";
  
  console.log(`[Command] /bid tÃ¡Â»Â« user ${username} (ID: ${userId})`);
  
  try {
    // KiÃ¡Â»Âm tra fhEVM
    if (!fhevmReady) {
      await bot.sendMessage(
        chatId,
        "Ã¢ÂÂ³ HÃ¡Â»Â thÃ¡Â»Âng ÃÂang khÃ¡Â»Âi tÃ¡ÂºÂ¡o. Vui lÃÂ²ng thÃ¡Â»Â­ lÃ¡ÂºÂ¡i sau 10 giÃÂ¢y."
      );
      console.log(`[Command] fhEVM chÃÂ°a sÃ¡ÂºÂµn sÃÂ ng, tÃ¡Â»Â« chÃ¡Â»Âi bid`);
      return;
    }
    
    // ÃÂÃ¡ÂºÂ·t trÃ¡ÂºÂ¡ng thÃÂ¡i chÃ¡Â»Â nhÃ¡ÂºÂ­p bid
    pendingBids.set(userId, { chatId, timestamp: Date.now() });
    
    await bot.sendMessage(
      chatId,
      `Ã°ÂÂÂ° *NhÃ¡ÂºÂ­p sÃ¡Â»Â tiÃ¡Â»Ân bid (ÃÂÃÂ¡n vÃ¡Â»Â: wei)*

Ã°ÂÂÂ VÃÂ­ dÃ¡Â»Â¥: 1000000000000000000 (= 1 ETH)

Ã¢ÂÂ Ã¯Â¸Â GiÃ¡Â»Âi hÃ¡ÂºÂ¡n:
Ã¢ÂÂ¢ TÃ¡Â»Âi thiÃ¡Â»Âu: ${BID_LIMITS.MIN} wei
Ã¢ÂÂ¢ TÃ¡Â»Âi ÃÂa: ${BID_LIMITS.MAX} wei

_GÃ¡Â»Â­i sÃ¡Â»Â tiÃ¡Â»Ân ÃÂÃ¡Â»Â tiÃ¡ÂºÂ¿p tÃ¡Â»Â¥c hoÃ¡ÂºÂ·c /cancel ÃÂÃ¡Â»Â hÃ¡Â»Â§y_`,
      { parse_mode: "Markdown" }
    );
    
    console.log(`[Command] Ã¢ÂÂ ÃÂÃÂ£ yÃÂªu cÃ¡ÂºÂ§u nhÃ¡ÂºÂ­p bid tÃ¡Â»Â« user ${username}`);
  } catch (error) {
    console.error(`[Command] Ã¢ÂÂ LÃ¡Â»Âi /bid: ${error.message}`);
    console.error(`[Command] Stack: ${error.stack}`);
  }
});

/**
 * XÃ¡Â»Â­ lÃÂ½ lÃ¡Â»Ânh /cancel
 */
bot.onText(/\/cancel/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const username = msg.from?.username || msg.from?.first_name || "Unknown";
  
  console.log(`[Command] /cancel tÃ¡Â»Â« user ${username}`);
  
  if (pendingBids.has(userId)) {
    pendingBids.delete(userId);
    await bot.sendMessage(chatId, "Ã¢ÂÂ ÃÂÃÂ£ hÃ¡Â»Â§y lÃ¡Â»Ânh bid.");
    console.log(`[Command] Ã¢ÂÂ ÃÂÃÂ£ hÃ¡Â»Â§y pending bid cÃ¡Â»Â§a user ${username}`);
  } else {
    await bot.sendMessage(chatId, "Ã¢ÂÂ¹Ã¯Â¸Â KhÃÂ´ng cÃÂ³ lÃ¡Â»Ânh nÃÂ o ÃÂang chÃ¡Â»Â xÃ¡Â»Â­ lÃÂ½.");
  }
});

// ============================================
// PHÃ¡ÂºÂ¦N 5: XÃ¡Â»Â¬ LÃÂ TIN NHÃ¡ÂºÂ®N (BID AMOUNT)
// ============================================

/**
 * XÃ¡Â»Â­ lÃÂ½ tin nhÃ¡ÂºÂ¯n thÃÂ´ng thÃÂ°Ã¡Â»Âng (khÃÂ´ng phÃ¡ÂºÂ£i command)
 * DÃÂ¹ng ÃÂÃ¡Â»Â nhÃ¡ÂºÂ­n sÃ¡Â»Â tiÃ¡Â»Ân bid
 */
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const text = msg.text;
  const username = msg.from?.username || msg.from?.first_name || "Unknown";
  
  // Log mÃ¡Â»Âi message nhÃ¡ÂºÂ­n ÃÂÃÂ°Ã¡Â»Â£c
  console.log(`[Message] NhÃ¡ÂºÂ­n message tÃ¡Â»Â« user ${username} (ID: ${userId}): "${text}"`);
  
  // BÃ¡Â»Â qua commands (ÃÂÃÂ£ ÃÂÃÂ°Ã¡Â»Â£c xÃ¡Â»Â­ lÃÂ½ Ã¡Â»Â trÃÂªn)
  if (text && text.startsWith("/")) {
    console.log(`[Message] BÃ¡Â»Â qua command: ${text}`);
    return;
  }
  
  // KiÃ¡Â»Âm tra xem cÃÂ³ ÃÂang chÃ¡Â»Â bid khÃÂ´ng
  if (!pendingBids.has(userId)) {
    console.log(`[Message] User ${username} khÃÂ´ng cÃÂ³ pending bid, bÃ¡Â»Â qua message`);
    return;
  }
  
  console.log(`[Message] XÃ¡Â»Â­ lÃÂ½ bid amount tÃ¡Â»Â« user ${username}: ${text}`);
  
  try {
    // XÃÂ³a pending state
    pendingBids.delete(userId);
    
    // Validate sÃ¡Â»Â tiÃ¡Â»Ân
    const validation = validateBidAmount(text);
    if (!validation.isValid) {
      console.log(`[Bid] Validation failed: ${validation.error}`);
      await bot.sendMessage(chatId, `Ã¢ÂÂ ${validation.error}\n\nGÃ¡Â»Â­i /bid ÃÂÃ¡Â»Â thÃ¡Â»Â­ lÃ¡ÂºÂ¡i.`);
      return;
    }
    
    const amount = validation.amount;
    console.log(`[Bid] Amount hÃ¡Â»Â£p lÃ¡Â»Â: ${amount}`);
    
    // ThÃÂ´ng bÃÂ¡o ÃÂang xÃ¡Â»Â­ lÃÂ½
    const processingMsg = await bot.sendMessage(
      chatId,
      "Ã¢ÂÂ³ ÃÂang xÃ¡Â»Â­ lÃÂ½ bid...\nÃ°ÂÂÂ MÃÂ£ hÃÂ³a sÃ¡Â»Â tiÃ¡Â»Ân..."
    );
    
    // MÃÂ£ hÃÂ³a bid
    console.log(`[Bid] BÃ¡ÂºÂ¯t ÃÂÃ¡ÂºÂ§u mÃÂ£ hÃÂ³a...`);
    const encryptedAmount = await encryptBidAmount(amount);
    console.log(`[Bid] Ã¢ÂÂ MÃÂ£ hÃÂ³a thÃÂ nh cÃÂ´ng`);
    
    // CÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t message
    await bot.editMessageText(
      "Ã¢ÂÂ³ ÃÂang xÃ¡Â»Â­ lÃÂ½ bid...\nÃ°ÂÂÂ MÃÂ£ hÃÂ³a sÃ¡Â»Â tiÃ¡Â»Ân... Ã¢ÂÂ\nÃ°ÂÂÂ¤ GÃ¡Â»Â­i transaction...",
      { chat_id: chatId, message_id: processingMsg.message_id }
    );
    
    // GÃ¡Â»Â­i transaction
    console.log(`[Bid] GÃ¡Â»Â­i transaction...`);
    const tx = await contract.bid(encryptedAmount);
    console.log(`[Bid] Transaction hash: ${tx.hash}`);
    
    // CÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t message
    await bot.editMessageText(
      `Ã¢ÂÂ³ ÃÂang xÃ¡Â»Â­ lÃÂ½ bid...
Ã°ÂÂÂ MÃÂ£ hÃÂ³a sÃ¡Â»Â tiÃ¡Â»Ân... Ã¢ÂÂ
Ã°ÂÂÂ¤ GÃ¡Â»Â­i transaction... Ã¢ÂÂ
Ã¢ÂÂ³ ChÃ¡Â»Â confirmation...

Ã°ÂÂÂ TX: \`${tx.hash}\``,
      { chat_id: chatId, message_id: processingMsg.message_id, parse_mode: "Markdown" }
    );
    
    // ChÃ¡Â»Â confirmation
    console.log(`[Bid] ChÃ¡Â»Â confirmation...`);
    const receipt = await tx.wait();
    console.log(`[Bid] Ã¢ÂÂ Transaction confirmed! Block: ${receipt.blockNumber}`);
    
    // ThÃÂ´ng bÃÂ¡o thÃÂ nh cÃÂ´ng
    await bot.editMessageText(
      `Ã¢ÂÂ *Bid thÃÂ nh cÃÂ´ng!*

Ã°ÂÂÂ *Chi tiÃ¡ÂºÂ¿t:*
Ã¢ÂÂ¢ Block: ${receipt.blockNumber}
Ã¢ÂÂ¢ Gas used: ${receipt.gasUsed.toString()}

Ã°ÂÂÂ *Transaction:*
\`${tx.hash}\`

Ã°ÂÂÂ [Xem trÃÂªn Etherscan](https://sepolia.etherscan.io/tx/${tx.hash})`,
      { 
        chat_id: chatId, 
        message_id: processingMsg.message_id, 
        parse_mode: "Markdown",
        disable_web_page_preview: true
      }
    );
    
    console.log(`[Bid] Ã¢ÂÂ HoÃÂ n tÃ¡ÂºÂ¥t bid cho user ${username}`);
    
  } catch (error) {
    console.error(`[Bid] Ã¢ÂÂ LÃ¡Â»Âi khi xÃ¡Â»Â­ lÃÂ½ bid:`);
    console.error(`[Bid] Error name: ${error.name}`);
    console.error(`[Bid] Error message: ${error.message}`);
    console.error(`[Bid] Stack trace: ${error.stack}`);
    
    let errorMessage = "Ã¢ÂÂ CÃÂ³ lÃ¡Â»Âi xÃ¡ÂºÂ£y ra khi xÃ¡Â»Â­ lÃÂ½ bid.\n\n";
    
    if (error.message.includes("insufficient funds")) {
      errorMessage += "Ã°ÂÂÂ° Wallet khÃÂ´ng ÃÂÃ¡Â»Â§ gas. Vui lÃÂ²ng nÃ¡ÂºÂ¡p thÃÂªm Sepolia ETH.";
    } else if (error.message.includes("mÃÂ£ hÃÂ³a")) {
      errorMessage += "Ã°ÂÂÂ LÃ¡Â»Âi mÃÂ£ hÃÂ³a. Vui lÃÂ²ng thÃ¡Â»Â­ lÃ¡ÂºÂ¡i.";
    } else if (error.message.includes("network")) {
      errorMessage += "Ã°ÂÂÂ LÃ¡Â»Âi kÃ¡ÂºÂ¿t nÃ¡Â»Âi mÃ¡ÂºÂ¡ng. Vui lÃÂ²ng thÃ¡Â»Â­ lÃ¡ÂºÂ¡i.";
    } else {
      errorMessage += `LÃ¡Â»Âi: ${error.message}`;
    }
    
    errorMessage += "\n\nGÃ¡Â»Â­i /bid ÃÂÃ¡Â»Â thÃ¡Â»Â­ lÃ¡ÂºÂ¡i.";
    
    await bot.sendMessage(chatId, errorMessage);
  }
});

// ============================================
// PHÃ¡ÂºÂ¦N 6: GRACEFUL SHUTDOWN
// ============================================

process.on("SIGINT", () => {
  console.log("\n[Bot] NhÃ¡ÂºÂ­n SIGINT, ÃÂang tÃ¡ÂºÂ¯t bot...");
  bot.stopPolling();
  console.log("[Bot] Ã¢ÂÂ ÃÂÃÂ£ tÃ¡ÂºÂ¯t polling");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n[Bot] NhÃ¡ÂºÂ­n SIGTERM, ÃÂang tÃ¡ÂºÂ¯t bot...");
  bot.stopPolling();
  console.log("[Bot] Ã¢ÂÂ ÃÂÃÂ£ tÃ¡ÂºÂ¯t polling");
  process.exit(0);
});

// BÃ¡ÂºÂ¯t unhandled errors
process.on("uncaughtException", (error) => {
  console.error("[Bot] Ã¢ÂÂ Uncaught Exception:");
  console.error(`[Bot] Error: ${error.message}`);
  console.error(`[Bot] Stack: ${error.stack}`);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Bot] Ã¢ÂÂ Unhandled Rejection at:", promise);
  console.error(`[Bot] Reason: ${reason}`);
});

console.log("=== DECADEX BOT READY ===");
console.log("[Bot] Bot ÃÂang lÃ¡ÂºÂ¯ng nghe commands...");
console.log("[Bot] GÃ¡Â»Â­i /start ÃÂÃ¡Â»Â bÃ¡ÂºÂ¯t ÃÂÃ¡ÂºÂ§u");
