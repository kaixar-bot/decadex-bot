// Debug: Load dotenv for local development (.env file)
// Note: Replit Secrets are auto-injected into process.env before this runs
import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { ethers } from "ethers";
// ABI embedded in code - no fs read needed
import { DECADEX_ABI } from "./src/contract-abi.js";

// Import cÃÂ¡c module ÃÂÃÂ£ tÃÂ¡ch
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

// === DEFAULT VALUES ===
const DEFAULT_CONTRACT_ADDRESS = "0xe9c1349c959f98f3d6e1c25b1bc3a4376921423d";
const DEFAULT_RELAYER_URL = "https://relayer.testnet.zama.org";

// === SINGLETON PATTERN FOR BOT INSTANCE ===
let botInstance = null;
let isShuttingDown = false;
let pollingRetryCount = 0;
const MAX_POLLING_RETRIES = 10;
const INITIAL_RETRY_DELAY = 1000; // 1 second

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

// Check specific required vars (only 3 required now)
const requiredVars = ["TELEGRAM_BOT_TOKEN", "PRIVATE_KEY", "RPC_URL"];
console.log("[ENV] Checking required variables:");
requiredVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? `Ã¢ÂÂ SET (length: ${value.length})` : "Ã¢ÂÂ NOT SET";
  console.log(`[ENV]   ${varName}: ${status}`);
});

// Check optional vars
const optionalVars = ["CONTRACT_ADDRESS", "RELAYER_URL"];
console.log("[ENV] Checking optional variables (have defaults):");
optionalVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? `Ã¢ÂÂ SET (length: ${value.length})` : "Ã¢ÂÂ Using default";
  console.log(`[ENV]   ${varName}: ${status}`);
});
console.log("=== END ENVIRONMENT DEBUG ===\n");

// === VALIDATE ENVIRONMENT VARIABLES ===
const envValidation = validateEnvVariables(process.env);
if (!envValidation.valid) {
  console.error("Ã¢ÂÂ Missing required environment variables:");
  envValidation.errors.forEach(err => console.error(`   - ${err}`));
  console.error("\nÃ°ÂÂÂ¡ HÃÂ°Ã¡Â»Âng dÃ¡ÂºÂ«n:");
  console.error("   1. VÃÂ o Replit Secrets (Tools Ã¢ÂÂ Secrets)");
  console.error("   2. ThÃÂªm cÃÂ¡c biÃ¡ÂºÂ¿n mÃÂ´i trÃÂ°Ã¡Â»Âng bÃ¡ÂºÂ¯t buÃ¡Â»Âc:");
  console.error("      - TELEGRAM_BOT_TOKEN: Token tÃ¡Â»Â« @BotFather");
  console.error("      - PRIVATE_KEY: Private key cÃ¡Â»Â§a wallet (khÃÂ´ng cÃÂ³ 0x)");
  console.error("      - RPC_URL: Zama testnet RPC URL");
  console.error("   3. CÃÂ¡c biÃ¡ÂºÂ¿n optional (cÃÂ³ default):");
  console.error("      - CONTRACT_ADDRESS: DecaDex contract address");
  console.error("      - RELAYER_URL: Zama relayer URL");
  process.exit(1);
}

// === LOAD CONFIG FROM ENVIRONMENT ===
const CONFIG = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  RPC_URL: process.env.RPC_URL,
  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS,
  RELAYER_URL: process.env.RELAYER_URL || DEFAULT_RELAYER_URL,
};

console.log("Ã¢ÂÂ Configuration loaded successfully");
console.log(`   Contract: ${CONFIG.CONTRACT_ADDRESS}`);
console.log(`   RPC: ${CONFIG.RPC_URL}`);
console.log(`   Relayer: ${CONFIG.RELAYER_URL}`);

// === EXPONENTIAL BACKOFF FOR RETRY ===
function getRetryDelay(retryCount) {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, 64s, 128s, 256s, 512s
  // Cap at 5 minutes (300 seconds)
  const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retryCount), 300000);
  return delay;
}

// === GRACEFUL SHUTDOWN HANDLER ===
async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    console.log("[BOT] Shutdown already in progress...");
    return;
  }
  
  isShuttingDown = true;
  console.log(`\n[BOT] Received ${signal}. Starting graceful shutdown...`);
  
  if (botInstance) {
    try {
      console.log("[BOT] Stopping polling...");
      await botInstance.stopPolling({ cancel: true });
      console.log("[BOT] Polling stopped successfully");
      
      // Delete webhook to ensure clean state for next restart
      console.log("[BOT] Cleaning up webhook...");
      await botInstance.deleteWebHook({ drop_pending_updates: true });
      console.log("[BOT] Webhook deleted");
    } catch (error) {
      console.error("[BOT] Error during shutdown:", error.message);
    }
  }
  
  console.log("[BOT] Shutdown complete. Goodbye!");
  process.exit(0);
}

// Register shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('uncaughtException', (error) => {
  console.error("[BOT] Uncaught exception:", error);
  gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason, promise) => {
  console.error("[BOT] Unhandled rejection at:", promise, "reason:", reason);
});

// === SINGLETON BOT GETTER ===
function getBotInstance() {
  if (botInstance) {
    console.log("[BOT] Returning existing bot instance (singleton)");
    return botInstance;
  }
  
  console.log("[BOT] Creating new bot instance...");
  botInstance = new TelegramBot(CONFIG.TELEGRAM_BOT_TOKEN, { 
    polling: {
      autoStart: false, // We'll start polling manually after webhook cleanup
      params: {
        timeout: 30
      }
    }
  });
  
  return botInstance;
}

// === INITIALIZE BOT WITH CLEAN STATE ===
async function initializeBot() {
  console.log("[BOT] Initializing bot with clean state...");
  
  const bot = getBotInstance();
  
  // Delete any existing webhook to ensure clean polling state
  // This is critical to prevent 409 Conflict errors
  console.log("[BOT] Deleting existing webhook (if any)...");
  try {
    await bot.deleteWebHook({ drop_pending_updates: true });
    console.log("[BOT] Ã¢ÂÂ Webhook deleted, pending updates dropped");
  } catch (error) {
    console.warn("[BOT] Warning: Could not delete webhook:", error.message);
  }
  
  // Small delay to ensure Telegram API processes the webhook deletion
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return bot;
}

// === START POLLING WITH RETRY LOGIC ===
async function startPollingWithRetry(bot) {
  while (!isShuttingDown && pollingRetryCount < MAX_POLLING_RETRIES) {
    try {
      console.log(`[BOT] Starting polling (attempt ${pollingRetryCount + 1}/${MAX_POLLING_RETRIES})...`);
      await bot.startPolling({ restart: false });
      console.log("[BOT] Ã¢ÂÂ Polling started successfully");
      pollingRetryCount = 0; // Reset on success
      return true;
    } catch (error) {
      pollingRetryCount++;
      
      if (error.message && error.message.includes('409')) {
        console.error("[BOT] Ã¢ÂÂ 409 Conflict detected - another instance may be running");
        console.log("[BOT] Attempting to clean up and retry...");
        
        try {
          await bot.stopPolling({ cancel: true });
          await bot.deleteWebHook({ drop_pending_updates: true });
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (cleanupError) {
          console.warn("[BOT] Cleanup error:", cleanupError.message);
        }
      }
      
      if (pollingRetryCount < MAX_POLLING_RETRIES) {
        const delay = getRetryDelay(pollingRetryCount - 1);
        console.log(`[BOT] Retrying in ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  if (pollingRetryCount >= MAX_POLLING_RETRIES) {
    console.error("[BOT] Ã¢ÂÂ Max polling retries exceeded. Please check:");
    console.error("   1. No other bot instances are running");
    console.error("   2. Bot token is correct");
    console.error("   3. Network connection is stable");
    return false;
  }
  
  return false;
}

// === POLLING ERROR HANDLER ===
function setupPollingErrorHandler(bot) {
  bot.on('polling_error', async (error) => {
    console.error("[BOT] Polling error:", error.code, error.message);
    
    if (error.code === 'ETELEGRAM' && error.message.includes('409')) {
      console.log("[BOT] 409 Conflict in polling - attempting recovery...");
      
      if (!isShuttingDown) {
        try {
          await bot.stopPolling({ cancel: true });
          await bot.deleteWebHook({ drop_pending_updates: true });
          await new Promise(resolve => setTimeout(resolve, 3000));
          await startPollingWithRetry(bot);
        } catch (recoveryError) {
          console.error("[BOT] Recovery failed:", recoveryError.message);
        }
      }
    }
  });
}

// === KHÃ¡Â»ÂI TÃ¡ÂºÂ O PROVIDER VÃÂ WALLET ===
const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
const wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, DECADEX_ABI, wallet);

// === COMMAND HANDLERS ===
function setupCommandHandlers(bot) {
  // /start command
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || msg.from.first_name || "User";
    
    console.log(`[CMD] /start from @${username} (chat: ${chatId})`);
    
    const welcomeMessage = `
Ã°ÂÂÂ® *Welcome to DecaDex Bot, ${username}!*

This bot allows you to interact with the DecaDex private auction contract on Zama's fhEVM testnet.

*Available Commands:*
/start - Show this welcome message
/help - Show detailed help
/info - View auction information
/bid <amount> - Place a bid (encrypted)
/status - Check bot and contract status

*About DecaDex:*
DecaDex uses Fully Homomorphic Encryption (FHE) to keep your bid amounts private until the auction ends.

Type /help for more details!
    `;
    
    await bot.sendMessage(chatId, welcomeMessage, { parse_mode: "Markdown" });
  });

  // /help command
  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`[CMD] /help from chat: ${chatId}`);
    
    const helpMessage = `
Ã°ÂÂÂ *DecaDex Bot Help*

*Commands:*
Ã¢ÂÂ¢ /start - Welcome message
Ã¢ÂÂ¢ /help - This help text
Ã¢ÂÂ¢ /info - View current auction info
Ã¢ÂÂ¢ /bid <amount> - Place encrypted bid
Ã¢ÂÂ¢ /status - Bot and contract status

*How Bidding Works:*
1. Your bid amount is encrypted using FHE
2. The encrypted bid is sent to the smart contract
3. No one can see your bid amount until auction ends
4. Winner is determined by comparing encrypted values

*Bid Limits:*
Ã¢ÂÂ¢ Minimum: ${BID_LIMITS.MIN} wei
Ã¢ÂÂ¢ Maximum: ${BID_LIMITS.MAX} wei

*Network:* Zama fhEVM Testnet
*Contract:* ${CONFIG.CONTRACT_ADDRESS}
    `;
    
    await bot.sendMessage(chatId, helpMessage, { parse_mode: "Markdown" });
  });

  // /status command
  bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`[CMD] /status from chat: ${chatId}`);
    
    try {
      const fhevmStatus = isInitialized() ? "Ã¢ÂÂ Initialized" : "Ã¢ÂÂ³ Not initialized";
      const networkInfo = await provider.getNetwork();
      
      const statusMessage = `
Ã°ÂÂÂ *Bot Status*

*Bot:* Ã¢ÂÂ Running
*fhEVM:* ${fhevmStatus}
*Network:* ${networkInfo.name} (Chain ID: ${networkInfo.chainId})
*Contract:* \`${CONFIG.CONTRACT_ADDRESS}\`
*Wallet:* \`${wallet.address}\`
      `;
      
      await bot.sendMessage(chatId, statusMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("[CMD] /status error:", error);
      await bot.sendMessage(chatId, "Ã¢ÂÂ Error fetching status: " + error.message);
    }
  });

  // /info command
  bot.onText(/\/info/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`[CMD] /info from chat: ${chatId}`);
    
    try {
      // Try to get auction info from contract
      const auctionEndTime = await contract.auctionEndTime();
      const highestBidder = await contract.highestBidder();
      const ended = await contract.ended();
      
      const endDate = new Date(Number(auctionEndTime) * 1000);
      
      const infoMessage = `
Ã°ÂÂÂ·Ã¯Â¸Â *Auction Information*

*Status:* ${ended ? "Ã°ÂÂÂ´ Ended" : "Ã°ÂÂÂ¢ Active"}
*End Time:* ${endDate.toISOString()}
*Highest Bidder:* \`${highestBidder}\`
*Contract:* \`${CONFIG.CONTRACT_ADDRESS}\`

_Note: Bid amounts are encrypted and hidden until auction ends._
      `;
      
      await bot.sendMessage(chatId, infoMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("[CMD] /info error:", error);
      await bot.sendMessage(chatId, `Ã¢ÂÂ Error fetching auction info: ${error.message}`);
    }
  });

  // /bid command
  bot.onText(/\/bid(\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const amountStr = match[2];
    
    console.log(`[CMD] /bid from chat: ${chatId}, amount: ${amountStr}`);
    
    if (!amountStr) {
      await bot.sendMessage(chatId, "Ã¢ÂÂ Please specify a bid amount.\n\nUsage: /bid <amount>\nExample: /bid 100");
      return;
    }
    
    // Validate bid amount
    const validation = validateBidAmount(amountStr);
    if (!validation.valid) {
      await bot.sendMessage(chatId, `Ã¢ÂÂ Invalid bid: ${validation.error}`);
      return;
    }
    
    const amount = validation.amount;
    
    try {
      // Initialize fhEVM if not already done
      if (!isInitialized()) {
        await bot.sendMessage(chatId, "Ã¢ÂÂ³ Initializing fhEVM... Please wait.");
        await initializeFhEVM(provider, CONFIG.CONTRACT_ADDRESS, CONFIG.RELAYER_URL);
      }
      
      await bot.sendMessage(chatId, "Ã°ÂÂÂ Encrypting your bid...");
      
      // Encrypt the bid amount
      const encryptedAmount = await encryptBidAmount(
        amount,
        CONFIG.CONTRACT_ADDRESS,
        wallet.address
      );
      
      await bot.sendMessage(chatId, "Ã°ÂÂÂ¤ Submitting encrypted bid to blockchain...");
      
      // Submit the bid
      const tx = await contract.bid(encryptedAmount, { gasLimit: 500000 });
      await bot.sendMessage(chatId, `Ã¢ÂÂ³ Transaction submitted: \`${tx.hash}\`\n\nWaiting for confirmation...`);
      
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        await bot.sendMessage(chatId, `Ã¢ÂÂ Bid placed successfully!\n\nTx Hash: \`${receipt.hash}\`\nBlock: ${receipt.blockNumber}\nGas Used: ${receipt.gasUsed.toString()}`, { parse_mode: "Markdown" });
      } else {
        await bot.sendMessage(chatId, "Ã¢ÂÂ Transaction failed. Please try again.");
      }
      
    } catch (error) {
      console.error("[CMD] /bid error:", error);
      await bot.sendMessage(chatId, `Ã¢ÂÂ Error placing bid: ${error.message}`);
    }
  });
}

// === MAIN STARTUP ===
async function main() {
  console.log("\n========================================");
  console.log("   DecaDex Telegram Bot Starting...");
  console.log("========================================\n");
  
  try {
    // Initialize bot with clean state (delete webhook first)
    const bot = await initializeBot();
    
    // Setup error handlers
    setupPollingErrorHandler(bot);
    
    // Setup command handlers
    setupCommandHandlers(bot);
    
    // Start polling with retry logic
    const pollingStarted = await startPollingWithRetry(bot);
    
    if (!pollingStarted) {
      console.error("[BOT] Failed to start polling. Exiting...");
      process.exit(1);
    }
    
    // Initialize fhEVM in background
    console.log("[fhEVM] Initializing fhEVM in background...");
    initializeFhEVM(provider, CONFIG.CONTRACT_ADDRESS, CONFIG.RELAYER_URL)
      .then(() => console.log("[fhEVM] Ã¢ÂÂ fhEVM initialized successfully"))
      .catch(err => console.warn("[fhEVM] Ã¢ÂÂ  Background initialization failed:", err.message));
    
    console.log("\n========================================");
    console.log("   Ã¢ÂÂ Bot is now running!");
    console.log(`   Wallet: ${wallet.address}`);
    console.log(`   Contract: ${CONFIG.CONTRACT_ADDRESS}`);
    console.log("========================================\n");
    
  } catch (error) {
    console.error("[FATAL] Failed to start bot:", error);
    process.exit(1);
  }
}

// Start the bot
main();
