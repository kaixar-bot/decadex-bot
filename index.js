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
 * 6. FIX: Pre-flight checks for bid() - check ended() and auctionEndTime()
 * 7. FIX: Better error handling with revert reason parsing
 * 8. NEW: /status command to check auction state
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
  !key.startsWith('PWD') &&
  !key.startsWith('LOGNAME') &&
  !key.startsWith('_')
);
console.log("[ENV] Keys:", envKeys.join(", "));

// === VALIDATE ENVIRONMENT VARIABLES ===
const envValidation = validateEnvVariables(process.env);
if (!envValidation.valid) {
  console.error("=== ENVIRONMENT VALIDATION FAILED ===");
  // FIX: Check if errors array exists before iterating
  if (envValidation.errors && Array.isArray(envValidation.errors)) {
    envValidation.errors.forEach((err) => console.error(`[ERROR] ${err}`));
  } else {
    console.error("[ERROR] Invalid environment configuration");
  }
  console.error("\nRequired variables:");
  console.error("- TELEGRAM_TOKEN: Your Telegram bot token from @BotFather");
  console.error("- PRIVATE_KEY: Your wallet private key (with 0x prefix)");
  console.error("\nOptional variables:");
  console.error("- CONTRACT_ADDRESS: DecaDex contract (default: " + DEFAULT_CONTRACT_ADDRESS + ")");
  console.error("- RELAYER_URL: Zama relayer (default: " + DEFAULT_RELAYER_URL + ")");
  console.error("- RPC_URL: Sepolia RPC (default: https://sepolia.gateway.tenderly.co)");
  process.exit(1);
}

// === BUILD CONFIG ===
const CONFIG = {
  TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS,
  RPC_URL: process.env.RPC_URL || "https://sepolia.gateway.tenderly.co",
  RELAYER_URL: process.env.RELAYER_URL || DEFAULT_RELAYER_URL
};

// Debug config (without exposing sensitive values)
console.log("=== CONFIG ===");
console.log("[CONFIG] TELEGRAM_TOKEN:", CONFIG.TELEGRAM_TOKEN ? "SET" : "NOT SET");
console.log("[CONFIG] PRIVATE_KEY:", CONFIG.PRIVATE_KEY ? "SET (length: " + CONFIG.PRIVATE_KEY.length + ")" : "NOT SET");
console.log("[CONFIG] CONTRACT_ADDRESS:", CONFIG.CONTRACT_ADDRESS);
console.log("[CONFIG] RPC_URL:", CONFIG.RPC_URL);
console.log("[CONFIG] RELAYER_URL:", CONFIG.RELAYER_URL);

// === INITIALIZE PROVIDER AND WALLET ===
const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
const wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, DECADEX_ABI, wallet);

console.log("[INIT] Wallet address:", wallet.address);
console.log("[INIT] Contract address:", contract.address);

// === HELPER: Parse revert reason from error ===
function parseRevertReason(error) {
  // Try to extract reason from various error formats
  if (error.reason) {
    return error.reason;
  }
  
  // Check for revert reason string
  const revertMatch = error.message?.match(/reverted with reason string '([^']+)'/);
  if (revertMatch) {
    return revertMatch[1];
  }
  
  // Check for custom error
  const customErrorMatch = error.message?.match(/custom error '([^']+)'/);
  if (customErrorMatch) {
    return `Custom error: ${customErrorMatch[1]}`;
  }
  
  // Generic execution reverted
  if (error.message?.includes("execution reverted")) {
    return "Transaction reverted by contract";
  }
  
  // Insufficient funds
  if (error.message?.includes("insufficient funds")) {
    return "Insufficient ETH for gas fees";
  }
  
  // Nonce error
  if (error.message?.includes("nonce")) {
    return "Nonce error - please try again";
  }
  
  // Return truncated message
  return error.message?.substring(0, 150) || "Unknown error";
}

// === HELPER: Check auction status ===
async function checkAuctionStatus() {
  try {
    const [ended, auctionEndTime, beneficiary] = await Promise.all([
      contract.ended(),
      contract.auctionEndTime(),
      contract.beneficiary()
    ]);
    
    const currentTime = Math.floor(Date.now() / 1000);
    const endTimeNum = auctionEndTime.toNumber();
    const isExpired = currentTime >= endTimeNum;
    const remainingSeconds = isExpired ? 0 : endTimeNum - currentTime;
    
    return {
      ended,
      auctionEndTime: endTimeNum,
      beneficiary,
      currentTime,
      isExpired,
      remainingSeconds,
      canBid: !ended && !isExpired
    };
  } catch (error) {
    console.error("[STATUS] Error checking auction status:", error);
    throw error;
  }
}

// === HELPER: Format time remaining ===
function formatTimeRemaining(seconds) {
  if (seconds <= 0) return "Expired";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// === DELETE EXISTING WEBHOOK BEFORE POLLING ===
async function deleteWebhookAndStartPolling(bot) {
  try {
    console.log("[WEBHOOK] Deleting existing webhook...");
    await bot.deleteWebHook({ drop_pending_updates: true });
    console.log("[WEBHOOK] Webhook deleted successfully");
    return true;
  } catch (error) {
    console.error("[WEBHOOK] Error deleting webhook:", error.message);
    return false;
  }
}

// === CREATE BOT INSTANCE ===
async function createBot() {
  if (botInstance) {
    console.log("[BOT] Returning existing bot instance");
    return botInstance;
  }

  console.log("[BOT] Creating new bot instance...");
  
  // Create bot with polling disabled initially
  const bot = new TelegramBot(CONFIG.TELEGRAM_TOKEN, { polling: false });
  
  // Delete webhook first
  await deleteWebhookAndStartPolling(bot);
  
  // Start polling with error handling
  bot.startPolling({
    restart: true,
    onlyFirstMatch: true,
    params: {
      timeout: 30
    }
  });
  
  botInstance = bot;
  
  // Handle polling errors
  bot.on("polling_error", async (error) => {
    if (isShuttingDown) return;
    
    console.error("[POLLING] Error:", error.code, error.message);
    
    if (error.code === "ETELEGRAM" && error.message.includes("409")) {
      console.log("[POLLING] 409 Conflict detected, attempting recovery...");
      pollingRetryCount++;
      
      if (pollingRetryCount >= MAX_POLLING_RETRIES) {
        console.error("[POLLING] Max retries reached, stopping...");
        return;
      }
      
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, pollingRetryCount - 1);
      console.log(`[POLLING] Waiting ${delay}ms before retry #${pollingRetryCount}...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      try {
        bot.stopPolling();
        await deleteWebhookAndStartPolling(bot);
        bot.startPolling();
        pollingRetryCount = 0;
        console.log("[POLLING] Recovery successful");
      } catch (retryError) {
        console.error("[POLLING] Recovery failed:", retryError.message);
      }
    }
  });

  // === START COMMAND ===
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const welcomeMessage = `
ð¯ *Welcome to DecaDex FHE Auction Bot!*

This bot allows you to place encrypted bids on the DecaDex auction using Fully Homomorphic Encryption (FHE).

*Commands:*
â¢ /bid <amount> - Place an encrypted bid
â¢ /status - Check auction status
â¢ /help - Show this help message

*Example:*
\`/bid 100\` - Place a bid of 100

ð Contract: \`${CONFIG.CONTRACT_ADDRESS.slice(0, 10)}...${CONFIG.CONTRACT_ADDRESS.slice(-8)}\`
ð Network: Sepolia Testnet

_Your bids are encrypted using Zama's fhEVM technology._
    `;
    await bot.sendMessage(chatId, welcomeMessage, { parse_mode: "Markdown" });
  });

  // === HELP COMMAND ===
  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    const helpMessage = `
ð *DecaDex Bot Help*

*Available Commands:*

/bid <amount>
  Place an encrypted bid
  Amount: ${BID_LIMITS.MIN} - ${BID_LIMITS.MAX}
  Example: /bid 100

/status
  Check current auction status
  Shows: end time, remaining time, whether bidding is open

/start
  Show welcome message

/help
  Show this help message

*Troubleshooting:*

â "Cannot bid: Auction has ended"
  â The auction is closed

â "Cannot bid: Auction time expired"
  â Time limit reached, wait for finalization

â "Transaction reverted"
  â Use /status to check auction state

â "FhEVM not initialized"
  â Wait a moment and try again
    `;
    await bot.sendMessage(chatId, helpMessage, { parse_mode: "Markdown" });
  });

  // === STATUS COMMAND ===
  bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      await bot.sendMessage(chatId, "ð Checking auction status...");
      
      const status = await checkAuctionStatus();
      
      // Status emoji and text
      const statusEmoji = status.ended ? "ð´" : (status.isExpired ? "ð¡" : "ð¢");
      const statusText = status.ended ? "ENDED" : (status.isExpired ? "EXPIRED (awaiting finalization)" : "ACTIVE");
      
      // Time info
      let timeInfo;
      if (status.isExpired) {
        const expiredSeconds = status.currentTime - status.auctionEndTime;
        timeInfo = `â° Expired ${formatTimeRemaining(expiredSeconds)} ago`;
      } else {
        timeInfo = `â±ï¸ Time remaining: ${formatTimeRemaining(status.remainingSeconds)}`;
      }
      
      const message = `ð *Auction Status*

${statusEmoji} Status: *${statusText}*
ð Contract: \`${CONFIG.CONTRACT_ADDRESS.slice(0, 10)}...\`
ð¤ Beneficiary: \`${status.beneficiary.slice(0, 10)}...\`

â° End Time: ${new Date(status.auctionEndTime * 1000).toISOString()}
${timeInfo}

${status.canBid ? "â You can place bids now!" : (status.ended ? "â Bidding is closed." : "â ï¸ Auction time expired but not yet finalized.")}`;
      
      await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
      
    } catch (error) {
      console.error("[STATUS] Error:", error);
      await bot.sendMessage(chatId, `â Error checking status: ${parseRevertReason(error)}`);
    }
  });

  // === BID COMMAND ===
  bot.onText(/\/bid(?:\s+(\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const amountStr = match[1];
    
    if (!amountStr) {
      await bot.sendMessage(chatId, `Usage: /bid <amount>\nExample: /bid 100\n\nAmount range: ${BID_LIMITS.MIN} - ${BID_LIMITS.MAX}`);
      return;
    }

    const amount = parseInt(amountStr, 10);
    
    // Validate amount
    const validation = validateBidAmount(amount);
    if (!validation.valid) {
      await bot.sendMessage(chatId, `â Invalid amount: ${validation.error}\n\nPlease enter a number from ${BID_LIMITS.MIN} to ${BID_LIMITS.MAX}`);
      return;
    }

    // Check FhEVM initialization
    if (!isInitialized()) {
      await bot.sendMessage(chatId, "â³ FhEVM not initialized yet. Please wait a moment and try again.");
      return;
    }

    try {
      await bot.sendMessage(chatId, `ð Processing bid...\n\nð° Amount: ${amount}\nâ³ Checking auction status...`);

      // === PRE-FLIGHT CHECKS ===
      console.log("[BID] Running pre-flight checks...");
      
      const status = await checkAuctionStatus();
      
      // Check if auction has ended
      if (status.ended) {
        await bot.sendMessage(chatId, "â Cannot bid: Auction has already ended.\n\nð¡ Use /status to see auction details.");
        return;
      }

      // Check auction end time
      if (status.isExpired) {
        await bot.sendMessage(chatId, `â Cannot bid: Auction time has expired.

â° Auction ended at: ${new Date(status.auctionEndTime * 1000).toISOString()}
ð Current time: ${new Date().toISOString()}

ð¡ The auction is awaiting finalization by calling auctionEnd().`);
        return;
      }

      // Auction is active
      await bot.sendMessage(chatId, `â Auction is active!\nâ±ï¸ Time remaining: ${formatTimeRemaining(status.remainingSeconds)}\n\nð Encrypting bid amount...`);

      // DEBUG: Log info
      console.log("[BID] CONTRACT_ADDRESS:", CONFIG.CONTRACT_ADDRESS);
      console.log("[BID] Wallet address:", wallet.address);
      console.log("[BID] Amount:", amount);
      console.log("[BID] Auction status:", status);

      // Encrypt the bid
      const encryptedBid = await encryptBidAmount(amount, CONFIG.CONTRACT_ADDRESS, wallet.address);
      
      console.log("[BID] Encrypted handles:", encryptedBid.handles);
      console.log("[BID] Encrypted inputProof length:", encryptedBid.inputProof?.length);
      
      await bot.sendMessage(chatId, "ð¤ Submitting encrypted bid to blockchain...");

      // Send transaction
      const tx = await contract.bid(encryptedBid.handles[0], encryptedBid.inputProof);
      
      await bot.sendMessage(chatId, `â Transaction submitted!

ð° Amount: ${amount}
ð Tx Hash: \`${tx.hash}\`

â³ Waiting for confirmation...`, { parse_mode: "Markdown" });
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      await bot.sendMessage(chatId, `ð *Bid Confirmed!*

ð° Amount: ${amount}
ð¦ Block: ${receipt.blockNumber}
â½ Gas used: ${receipt.gasUsed.toString()}

ð [View on Etherscan](https://sepolia.etherscan.io/tx/${tx.hash})`, { parse_mode: "Markdown" });
      
    } catch (error) {
      console.error("[BID] Error:", error);
      
      const reason = parseRevertReason(error);
      
      // Provide specific guidance based on error
      let guidance = "";
      if (reason.includes("reverted")) {
        guidance = "\n\nð¡ *Possible causes:*\nâ¢ Auction has ended\nâ¢ Invalid bid parameters\nâ¢ Contract conditions not met\n\nUse /status to check auction state.";
      }
      
      await bot.sendMessage(chatId, `â *Bid Failed!*

Error: ${reason}${guidance}`, { parse_mode: "Markdown" });
    }
  });

  console.log("[BOT] Bot setup complete, waiting for messages...");
  return bot;
}

// === GRACEFUL SHUTDOWN ===
async function gracefulShutdown(signal) {
  console.log(`\n[${signal}] Graceful shutdown initiated...`);
  isShuttingDown = true;
  
  if (botInstance) {
    try {
      botInstance.stopPolling();
      console.log("[SHUTDOWN] Polling stopped");
    } catch (error) {
      console.error("[SHUTDOWN] Error stopping polling:", error.message);
    }
  }
  
  console.log("[SHUTDOWN] Cleanup complete, exiting...");
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// === MAIN ENTRY POINT ===
async function main() {
  console.log("=== STARTING DECADEX BOT ===");
  
  try {
    // Initialize FhEVM first
    console.log("[MAIN] Initializing FhEVM...");
    await initializeFhEVM(CONFIG.CONTRACT_ADDRESS, CONFIG.RELAYER_URL);
    console.log("[MAIN] FhEVM initialized successfully");
    
    // Create and start bot
    await createBot();
    console.log("[MAIN] Bot is running...");
    
  } catch (error) {
    console.error("[MAIN] Fatal error:", error);
    process.exit(1);
  }
}

main();
