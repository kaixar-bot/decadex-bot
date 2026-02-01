/**
 * DecaDex Telegram Bot - Main Entry Point
 * Bot for FHE (Fully Homomorphic Encryption) encrypted auctions
 * 
 * COMPREHENSIVE FIX:
 * 1. Fix TypeError envValidation.errors undefined
 * 2. Fix 409 Conflict - delete webhook before polling
 * 3. Singleton pattern for bot
 * 4. Proper graceful shutdown
 * 5. Correct env vars logic
 */

// Load dotenv for local development (.env file)
// Note: Replit Secrets automatically inject into process.env
import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { ethers } from "ethers";

// ABI embedded in code - no file read needed
import { DECADEX_ABI } from "./src/contract-abi.js";

// Import separated modules
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

// === DEBUG: Log environment variables (names only, not values) ===
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
  !key.startsWith('GIT_') &&
  key !== 'SHLVL' &&
  key !== '_'
);
console.log("[ENV] Relevant keys:", envKeys.join(", ") || "(none found)");

// Check if values exist (without logging actual values)
console.log("[ENV] TELEGRAM_BOT_TOKEN:", process.env.TELEGRAM_BOT_TOKEN ? "SET" : "NOT SET");
console.log("[ENV] PRIVATE_KEY:", process.env.PRIVATE_KEY ? "SET" : "NOT SET");
console.log("[ENV] RPC_URL:", process.env.RPC_URL ? "SET" : "NOT SET");
console.log("[ENV] CONTRACT_ADDRESS:", process.env.CONTRACT_ADDRESS ? "SET" : "NOT SET");
console.log("[ENV] RELAYER_URL:", process.env.RELAYER_URL ? "SET" : "NOT SET");
console.log("=== END ENVIRONMENT DEBUG ===");

// === VALIDATE ENVIRONMENT VARIABLES ===
const envValidation = validateEnvVariables();
if (!envValidation.valid) {
  console.error("[ENV] Missing required environment variables:");
  if (envValidation.errors && Array.isArray(envValidation.errors)) {
    envValidation.errors.forEach(err => console.error("  -", err));
  } else if (envValidation.error) {
    console.error("  -", envValidation.error);
  } else {
    console.error("  - Undefined error");
  }
  process.exit(1);
}

// === CONFIGURATION ===
const CONFIG = {
  TELEGRAM_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  RPC_URL: process.env.RPC_URL || "https://devnet.zama.ai",
  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS,
  RELAYER_URL: process.env.RELAYER_URL || DEFAULT_RELAYER_URL
};

// Log config (without sensitive values)
console.log("[CONFIG] RPC_URL:", CONFIG.RPC_URL);
console.log("[CONFIG] CONTRACT_ADDRESS:", CONFIG.CONTRACT_ADDRESS);
console.log("[CONFIG] RELAYER_URL:", CONFIG.RELAYER_URL);

if (!CONFIG.CONTRACT_ADDRESS || CONFIG.CONTRACT_ADDRESS === DEFAULT_CONTRACT_ADDRESS) {
  console.log("[CONFIG] Using default CONTRACT_ADDRESS");
}
if (!CONFIG.RELAYER_URL || CONFIG.RELAYER_URL === DEFAULT_RELAYER_URL) {
  console.log("[CONFIG] Using default RELAYER_URL");
}

// === ETHEREUM SETUP ===
let provider;
let wallet;
let contract;

try {
  provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
  wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, provider);
  contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, DECADEX_ABI, wallet);
  console.log("[ETH] Ethereum setup successful");
  console.log("[ETH] Wallet address:", wallet.address);
} catch (error) {
  console.error("[ETH] Ethereum setup error:", error.message);
  process.exit(1);
}

// === BOT INSTANCE MANAGEMENT ===
async function getBotInstance() {
  if (botInstance) {
    console.log("[BOT] Bot instance already exists, reusing");
    return botInstance;
  }

  console.log("[BOT] Creating new bot instance...");
  
  // Delete any existing webhook before polling
  try {
    const tempBot = new TelegramBot(CONFIG.TELEGRAM_TOKEN);
    console.log("[BOT] Deleting existing webhook...");
    await tempBot.deleteWebHook();
    console.log("[BOT] Webhook deleted successfully");
  } catch (error) {
    console.error("[BOT] Error deleting webhook:", error.message);
    // Continue anyway - webhook might not exist
  }
  
  // Wait a bit after deleting webhook
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Create bot with polling
  botInstance = new TelegramBot(CONFIG.TELEGRAM_TOKEN, { 
    polling: {
      interval: 300,
      autoStart: true,
      params: {
        timeout: 10
      }
    }
  });

  // Handle polling errors
  botInstance.on("polling_error", async (error) => {
    console.error("[BOT] Polling error:", error.message);
    
    if (error.code === 'ETELEGRAM' && error.message.includes('409')) {
      console.log("[BOT] 409 Conflict detected - attempting recovery...");
      pollingRetryCount++;
      
      if (pollingRetryCount > MAX_POLLING_RETRIES) {
        console.error("[BOT] Too many retries, giving up");
        console.error("[BOT] Bot appears to be in conflict with another instance");
        process.exit(1);
      }
      
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, pollingRetryCount - 1);
      console.log(`[BOT] Waiting ${delay}ms before retry #${pollingRetryCount}...`);
      
      try {
        await botInstance.stopPolling();
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Delete webhook again
        console.log("[BOT] Deleting webhook before retry...");
        await botInstance.deleteWebHook();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Restart polling
        console.log("[BOT] Reinitializing polling...");
        await botInstance.startPolling();
        console.log("[BOT] Polling restarted successfully");
        pollingRetryCount = 0; // Reset counter
      } catch (retryError) {
        console.error("[BOT] Retry failed:", retryError.message);
      }
    }
  });

  botInstance.on("webhook_error", (error) => {
    console.error("[BOT] Webhook error:", error.message);
  });

  return botInstance;
}

// === GRACEFUL SHUTDOWN ===
async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    console.log("[SHUTDOWN] Already processing shutdown...");
    return;
  }
  
  isShuttingDown = true;
  console.log(`\n[SHUTDOWN] Received ${signal}, shutting down gracefully...\n`);
  
  if (botInstance) {
    try {
      console.log("[SHUTDOWN] Stopping polling...");
      await botInstance.stopPolling();
      console.log("[SHUTDOWN] Polling stopped");
      botInstance = null;
    } catch (error) {
      console.error("[SHUTDOWN] Error during shutdown:", error.message);
    }
  }
  
  console.log("[SHUTDOWN] Shutdown complete");
  process.exit(0);
}

// Register shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('uncaughtException', (error) => {
  console.error('[ERROR] Uncaught exception:', error);
  gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[ERROR] Unhandled rejection at:', promise, 'reason:', reason);
});

// === TELEGRAM BOT COMMANDS ===
async function setupBotCommands(bot) {
  // /start command
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const welcomeMessage = `
*Welcome to DecaDex Bot!*

*Available commands:*

*1. Place bid:*
   /bid <amount>
   Example: /bid 100

*2. Check status:*
   /status

*3. View guide:*
   /help

Your bid will be encrypted with FHE - no one can know the amount until the auction ends!
    `;
    
    await bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
  });

  // /help command
  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    const helpMessage = `
*DecaDex Bot Guide*

*1. Place bid:*
   /bid <amount>
   Example: /bid 100

*2. Check status:*
   /status

*3. View guide:*
   /help

*Important notes:*
- Your bid will be encrypted with FHE
- No one can see your bid amount until auction ends
- Minimum bid: ${BID_LIMITS.MIN}
- Maximum bid: ${BID_LIMITS.MAX}
    `;
    
    await bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
  });

  // /status command
  bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    const fhevmStatus = isInitialized() ? "Ready" : "Not initialized";
    
    const statusMessage = `
*System Status:*

FhEVM: ${fhevmStatus}
Wallet: ${wallet.address.slice(0, 10)}...
Contract: ${CONFIG.CONTRACT_ADDRESS.slice(0, 10)}...
RPC: ${CONFIG.RPC_URL}
    `;
    
    await bot.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' });
  });

  // /bid command
  bot.onText(/\/bid(?:\s+(\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const amountStr = match[1];
    
    if (!amountStr) {
      await bot.sendMessage(chatId, `Usage: /bid <amount>\nExample: /bid 100`);
      return;
    }

    const amount = parseInt(amountStr, 10);
    
    // Validate amount
    const validation = validateBidAmount(amount);
    if (!validation.valid) {
      await bot.sendMessage(chatId, `Invalid amount: ${validation.error}\nPlease enter a number from ${BID_LIMITS.MIN} to ${BID_LIMITS.MAX}`);
      return;
    }

    // Check FhEVM
    if (!isInitialized()) {
      await bot.sendMessage(chatId, "FhEVM not initialized. Please try again later.");
      return;
    }

    try {
      await bot.sendMessage(chatId, `Processing bid...\nAmount: ${amount}\nEncrypting...`);

      // Encrypt the bid
      const encryptedBid = await encryptBidAmount(amount);
      
      // Send transaction
      const tx = await contract.placeBid(encryptedBid);
      await bot.sendMessage(chatId, `Bid submitted successfully!\n\nAmount: ${amount}\nTx Hash: ${tx.hash}`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      await bot.sendMessage(chatId, `Transaction confirmed!\nBlock: ${receipt.blockNumber}`);
      
    } catch (error) {
      console.error("[BID] Error placing bid:", error);
      await bot.sendMessage(chatId, `Error placing bid: ${error.message}`);
    }
  });

  // Handle unknown commands
  bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/') && 
        !msg.text.startsWith('/start') && 
        !msg.text.startsWith('/help') && 
        !msg.text.startsWith('/status') && 
        !msg.text.startsWith('/bid')) {
      await bot.sendMessage(msg.chat.id, "Unknown command. Use /help to see available commands.");
    }
  });
}

// === MAIN FUNCTION ===
async function main() {
  console.log("\n=== DecaDex Bot Starting ===\n");
  
  try {
    // Initialize FhEVM
    console.log("[MAIN] Initializing FhEVM...");
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`[MAIN] FhEVM initialization attempt ${attempts}/${maxAttempts}...`);
      
      try {
        await initializeFhEVM({
          rpcUrl: CONFIG.RPC_URL,
          relayerUrl: CONFIG.RELAYER_URL,
          contractAddress: CONFIG.CONTRACT_ADDRESS
        });
        console.log("[MAIN] FhEVM initialized successfully");
        break;
      } catch (fhevmError) {
        console.error(`[MAIN] FhEVM init attempt ${attempts} failed:`, fhevmError.message);
        if (attempts >= maxAttempts) {
          console.error("[MAIN] FhEVM initialization failed after all attempts");
          // Continue without FhEVM - bid commands will fail but bot will work
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Get or create bot instance
    console.log("[MAIN] Starting Telegram bot...");
    const bot = await getBotInstance();
    
    // Setup commands
    await setupBotCommands(bot);
    
    console.log("\n=== Bot is ready! Listening for messages... ===\n");

  } catch (error) {
    console.error("[MAIN] Critical error:", error);
    console.error("[MAIN] Exit with error code 1");
    process.exit(1);
  }
}

// Run main
main();
