/**
 * DecaDex Telegram Bot - Main Entry Point
 * Bot cho phÃ©p Äáº¥u giÃ¡ vá»i mÃ£ hÃ³a FHE (Fully Homomorphic Encryption)
 * 
 * FIX TOÃN DIá»N:
 * 1. Fix TypeError envValidation.errors undefined
 * 2. Fix 409 Conflict - delete webhook trÆ°á»c polling
 * 3. Singleton pattern cho bot
 * 4. Graceful shutdown ÄÃºng cÃ¡ch
 * 5. Env vars logic ÄÃºng
 */

// Load dotenv cho local development (.env file)
// Note: Replit Secrets tá»± Äá»ng inject vÃ o process.env
import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { ethers } from "ethers";

// ABI embedded trong code - khÃ´ng cáº§n Äá»c file
import { DECADEX_ABI } from "./src/contract-abi.js";

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
  !key.startsWith('COLORTERM') &&
  !key.startsWith('DENO_') &&
  !key.startsWith('GIT_') &&
  key !== 'SHLVL' &&
  key !== '_'
);
console.log("[ENV] Relevant keys:", envKeys.join(", ") || "(none found)");

// === KIá»M TRA ENV VARIABLES ===
// Sá»­ dá»¥ng validateEnvVariables() tá»« validators.js
const envValidation = validateEnvVariables();

// FIX: Handle case errors undefined - LUÃN Äáº£m báº£o errors lÃ  array
const validationErrors = envValidation.errors || [];

if (!envValidation.isValid) {
  console.error("=== THIáº¾U CÃC BIáº¾N MÃI TRÆ¯á»NG Báº®T BUá»C ===");
  
  // Log tá»«ng lá»i náº¿u cÃ³
  if (validationErrors.length > 0) {
    validationErrors.forEach(err => console.error(`  - ${err}`));
  }
  
  console.error("\nVui lÃ²ng thiáº¿t láº­p trong Replit Secrets hoáº·c .env file:");
  console.error("  - TELEGRAM_BOT_TOKEN: Token tá»« @BotFather");
  console.error("  - PRIVATE_KEY: Private key vÃ­ Ethereum");
  console.error("  - RPC_URL: URL cá»§a RPC provider (vÃ­ dá»¥: Alchemy Sepolia)");
  console.error("\nOptional (cÃ³ default):");
  console.error("  - CONTRACT_ADDRESS: Äá»a chá» smart contract");
  console.error("  - RELAYER_URL: URL cá»§a Zama relayer");
  
  process.exit(1);
}

// Láº¥y config tá»« env hoáº·c dÃ¹ng default
const CONFIG = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  RPC_URL: process.env.RPC_URL,
  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS,
  RELAYER_URL: process.env.RELAYER_URL || DEFAULT_RELAYER_URL,
};

// Log config ÄÃ£ load (che giáº¥u sensitive data)
console.log("=== CONFIGURATION LOADED ===");
console.log(`[CONFIG] TELEGRAM_BOT_TOKEN: ${CONFIG.TELEGRAM_BOT_TOKEN ? "â Loaded" : "â Missing"}`);
console.log(`[CONFIG] PRIVATE_KEY: ${CONFIG.PRIVATE_KEY ? "â Loaded (hidden)" : "â Missing"}`);
console.log(`[CONFIG] RPC_URL: ${CONFIG.RPC_URL ? "â Loaded" : "â Missing"}`);
console.log(`[CONFIG] CONTRACT_ADDRESS: ${CONFIG.CONTRACT_ADDRESS}`);
console.log(`[CONFIG] RELAYER_URL: ${CONFIG.RELAYER_URL}`);

// === ETHEREUM SETUP ===
let provider;
let wallet;
let contract;

try {
  provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
  wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, provider);
  contract = new ethers.Contract(
    ethers.getAddress(CONFIG.CONTRACT_ADDRESS), // Checksum address
    DECADEX_ABI,
    wallet
  );
  console.log("[ETH] Wallet address:", wallet.address);
  console.log("[ETH] Contract initialized at:", CONFIG.CONTRACT_ADDRESS);
} catch (error) {
  console.error("[ETH] Lá»i khá»i táº¡o Ethereum:", error.message);
  process.exit(1);
}

/**
 * XÃ³a webhook vÃ  táº¡o bot instance má»i
 * FIX 409 CONFLICT: Pháº£i xÃ³a webhook trÆ°á»c khi báº¯t Äáº§u polling
 */
async function createBotInstance() {
  // Náº¿u ÄÃ£ cÃ³ instance vÃ  Äang cháº¡y, return
  if (botInstance && !isShuttingDown) {
    console.log("[BOT] Sá»­ dá»¥ng bot instance hiá»n cÃ³");
    return botInstance;
  }
  
  console.log("[BOT] Äang táº¡o bot instance má»i...");
  
  // Táº¡o bot táº¡m Äá» xÃ³a webhook (khÃ´ng polling)
  const tempBot = new TelegramBot(CONFIG.TELEGRAM_BOT_TOKEN, { polling: false });
  
  try {
    // FIX 409: XÃ³a webhook trÆ°á»c khi start polling
    console.log("[BOT] Äang xÃ³a webhook cÅ©...");
    await tempBot.deleteWebHook({ drop_pending_updates: true });
    console.log("[BOT] ÄÃ£ xÃ³a webhook thÃ nh cÃ´ng");
    
    // Äá»£i má»t chÃºt Äá» Telegram xá»­ lÃ½
    await new Promise(resolve => setTimeout(resolve, 1000));
    
  } catch (error) {
    console.warn("[BOT] Lá»i khi xÃ³a webhook (cÃ³ thá» bá» qua):", error.message);
  }
  
  // Táº¡o bot instance chÃ­nh vá»i polling
  botInstance = new TelegramBot(CONFIG.TELEGRAM_BOT_TOKEN, {
    polling: {
      autoStart: false, // KhÃ´ng tá»± Äá»ng start, ta sáº½ start thá»§ cÃ´ng
      params: {
        timeout: 30,
        allowed_updates: ["message", "callback_query"]
      }
    }
  });
  
  // Xá»­ lÃ½ polling error
  botInstance.on("polling_error", handlePollingError);
  
  // Xá»­ lÃ½ webhook error
  botInstance.on("webhook_error", (error) => {
    console.error("[BOT] Webhook error:", error.message);
  });
  
  return botInstance;
}

/**
 * Xá»­ lÃ½ lá»i polling vá»i exponential backoff
 */
function handlePollingError(error) {
  if (isShuttingDown) {
    return; // Bá» qua lá»i khi Äang shutdown
  }
  
  const errorCode = error.response?.statusCode || error.code;
  const errorMessage = error.message || "Unknown error";
  
  console.error(`[BOT] Polling error (code: ${errorCode}): ${errorMessage}`);
  
  // Xá»­ lÃ½ 409 Conflict
  if (errorCode === 409) {
    console.error("[BOT] 409 Conflict - CÃ³ má»t bot instance khÃ¡c Äang cháº¡y!");
    console.error("[BOT] Giáº£i phÃ¡p: Dá»«ng bot instance khÃ¡c hoáº·c Äá»£i vÃ i phÃºt");
    
    pollingRetryCount++;
    
    if (pollingRetryCount >= MAX_POLLING_RETRIES) {
      console.error("[BOT] ÄÃ£ vÆ°á»£t quÃ¡ sá» láº§n retry, Äang shutdown...");
      gracefulShutdown("MAX_RETRIES_EXCEEDED");
      return;
    }
    
    // Exponential backoff
    const delay = INITIAL_RETRY_DELAY * Math.pow(2, pollingRetryCount);
    console.log(`[BOT] Sáº½ retry sau ${delay/1000}s (láº§n ${pollingRetryCount}/${MAX_POLLING_RETRIES})...`);
    
    setTimeout(async () => {
      try {
        await restartPolling();
      } catch (err) {
        console.error("[BOT] Lá»i khi restart polling:", err.message);
      }
    }, delay);
  }
}

/**
 * Restart polling sau khi gáº·p lá»i
 */
async function restartPolling() {
  if (isShuttingDown) return;
  
  console.log("[BOT] Äang restart polling...");
  
  try {
    // Stop polling hiá»n táº¡i
    if (botInstance) {
      await botInstance.stopPolling();
    }
    
    // XÃ³a webhook láº¡i
    const tempBot = new TelegramBot(CONFIG.TELEGRAM_BOT_TOKEN, { polling: false });
    await tempBot.deleteWebHook({ drop_pending_updates: true });
    
    // Äá»£i 2s
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Start polling láº¡i
    if (botInstance && !isShuttingDown) {
      await botInstance.startPolling();
      console.log("[BOT] ÄÃ£ restart polling thÃ nh cÃ´ng");
      pollingRetryCount = 0; // Reset counter
    }
  } catch (error) {
    console.error("[BOT] Lá»i restart polling:", error.message);
  }
}

/**
 * Graceful shutdown
 */
async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    console.log("[SHUTDOWN] Äang trong quÃ¡ trÃ¬nh shutdown...");
    return;
  }
  
  isShuttingDown = true;
  console.log(`\n[SHUTDOWN] Nháº­n signal ${signal}, Äang dá»n dáº¹p...`);
  
  try {
    if (botInstance) {
      console.log("[SHUTDOWN] Äang dá»«ng bot polling...");
      await botInstance.stopPolling();
      
      console.log("[SHUTDOWN] Äang xÃ³a webhook...");
      await botInstance.deleteWebHook({ drop_pending_updates: false });
      
      console.log("[SHUTDOWN] Bot ÄÃ£ dá»«ng thÃ nh cÃ´ng");
    }
  } catch (error) {
    console.error("[SHUTDOWN] Lá»i khi dá»«ng bot:", error.message);
  }
  
  console.log("[SHUTDOWN] Goodbye!");
  process.exit(0);
}

// === TELEGRAM BOT COMMANDS ===

/**
 * Command: /start
 */
function setupCommands(bot) {
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from?.username || msg.from?.first_name || "NgÆ°á»i dÃ¹ng";
    
    const welcomeMessage = `
ð¯ *ChÃ o má»«ng ${username} Äáº¿n vá»i DecaDex Bot!*

Bot nÃ y cho phÃ©p báº¡n tham gia Äáº¥u giÃ¡ vá»i mÃ£ hÃ³a FHE (Fully Homomorphic Encryption).

*CÃ¡c lá»nh cÃ³ sáºµn:*
/bid <sá» tiá»n> - Äáº·t giÃ¡ tháº§u (vÃ­ dá»¥: /bid 100)
/status - Kiá»m tra tráº¡ng thÃ¡i auction
/help - Xem hÆ°á»ng dáº«n chi tiáº¿t

*ThÃ´ng tin:*
â¢ Contract: \`${CONFIG.CONTRACT_ADDRESS.slice(0, 10)}...\`
â¢ Network: Sepolia Testnet
â¢ Wallet: \`${wallet.address.slice(0, 10)}...\`
    `;
    
    await bot.sendMessage(chatId, welcomeMessage, { parse_mode: "Markdown" });
  });
  
  /**
   * Command: /help
   */
  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    
    const helpMessage = `
ð *HÆ°á»ng dáº«n sá»­ dá»¥ng DecaDex Bot*

*1. Äáº·t giÃ¡ tháº§u:*
   /bid <sá» tiá»n>
   VÃ­ dá»¥: /bid 100
   
*2. Kiá»m tra tráº¡ng thÃ¡i:*
   /status
   
*Giá»i háº¡n bid:*
â¢ Tá»i thiá»u: ${BID_LIMITS.MIN_AMOUNT}
â¢ Tá»i Äa: ${BID_LIMITS.MAX_AMOUNT.toLocaleString()}

*LÆ°u Ã½:*
â¢ GiÃ¡ tháº§u ÄÆ°á»£c mÃ£ hÃ³a vá»i FHE
â¢ KhÃ´ng ai cÃ³ thá» xem sá» tiá»n báº¡n Äáº·t
â¢ Káº¿t quáº£ chá» ÄÆ°á»£c tiáº¿t lá» khi auction káº¿t thÃºc
    `;
    
    await bot.sendMessage(chatId, helpMessage, { parse_mode: "Markdown" });
  });
  
  /**
   * Command: /status
   */
  bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    
    await bot.sendMessage(chatId, "â³ Äang kiá»m tra tráº¡ng thÃ¡i auction...");
    
    try {
      const ended = await contract.ended();
      const beneficiary = await contract.beneficiary();
      
      const statusMessage = `
ð *Tráº¡ng thÃ¡i Auction*

â¢ Tráº¡ng thÃ¡i: ${ended ? "ð´ ÄÃ£ káº¿t thÃºc" : "ð¢ Äang diá»n ra"}
â¢ Beneficiary: \`${beneficiary}\`
â¢ Contract: \`${CONFIG.CONTRACT_ADDRESS}\`
      `;
      
      await bot.sendMessage(chatId, statusMessage, { parse_mode: "Markdown" });
    } catch (error) {
      await bot.sendMessage(chatId, `â Lá»i khi kiá»m tra: ${error.message}`);
    }
  });
  
  /**
   * Command: /bid <amount>
   */
  bot.onText(/\/bid(?:\s+(\S+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const amountStr = match?.[1];
    
    // Validate input
    const validation = validateBidAmount(amountStr);
    if (!validation.isValid) {
      await bot.sendMessage(chatId, `â ${validation.error}`);
      return;
    }
    
    const amount = validation.value;
    
    await bot.sendMessage(chatId, `â³ Äang xá»­ lÃ½ bid ${amount}...\n\n_Äang mÃ£ hÃ³a vá»i FHE..._`, { parse_mode: "Markdown" });
    
    try {
      // Khá»i táº¡o FhEVM náº¿u chÆ°a
      if (!isInitialized()) {
        await bot.sendMessage(chatId, "ð Äang khá»i táº¡o FhEVM láº§n Äáº§u...");
        await initializeFhEVM({
          networkUrl: CONFIG.RPC_URL,
          relayerUrl: CONFIG.RELAYER_URL,
          contractAddress: CONFIG.CONTRACT_ADDRESS
        });
      }
      
      // MÃ£ hÃ³a bid amount
      const { encryptedValue, inputProof } = await encryptBidAmount(
        amount,
        CONFIG.CONTRACT_ADDRESS,
        wallet.address
      );
      
      await bot.sendMessage(chatId, "ð¤ Äang gá»­i transaction...");
      
      // Gá»­i transaction
      const tx = await contract.bid(encryptedValue, inputProof);
      await bot.sendMessage(chatId, `â³ Äang Äá»£i confirmation...\nTx: \`${tx.hash}\``, { parse_mode: "Markdown" });
      
      // Äá»£i confirmation
      const receipt = await tx.wait();
      
      const successMessage = `
â *Bid thÃ nh cÃ´ng!*

â¢ Sá» tiá»n: ${amount} (ÄÃ£ mÃ£ hÃ³a)
â¢ Tx Hash: \`${receipt.hash}\`
â¢ Block: ${receipt.blockNumber}
â¢ Gas used: ${receipt.gasUsed.toString()}

[Xem trÃªn Etherscan](https://sepolia.etherscan.io/tx/${receipt.hash})
      `;
      
      await bot.sendMessage(chatId, successMessage, { 
        parse_mode: "Markdown",
        disable_web_page_preview: true 
      });
      
    } catch (error) {
      console.error("[BID] Error:", error);
      
      let errorMessage = error.message;
      if (error.code === "INSUFFICIENT_FUNDS") {
        errorMessage = "KhÃ´ng Äá»§ ETH Äá» tráº£ gas fee";
      } else if (error.code === "CALL_EXCEPTION") {
        errorMessage = "Contract call failed - auction cÃ³ thá» ÄÃ£ káº¿t thÃºc";
      }
      
      await bot.sendMessage(chatId, `â *Lá»i khi bid:*\n\`${errorMessage}\``, { parse_mode: "Markdown" });
    }
  });
  
  console.log("[BOT] ÄÃ£ setup xong cÃ¡c commands");
}

// === MAIN FUNCTION ===
async function main() {
  console.log("\n=== STARTING DECADEX BOT ===\n");
  
  try {
    // Táº¡o bot instance (ÄÃ£ xÃ³a webhook)
    const bot = await createBotInstance();
    
    // Setup commands
    setupCommands(bot);
    
    // Start polling
    console.log("[BOT] Äang báº¯t Äáº§u polling...");
    await bot.startPolling();
    
    console.log("\nâ Bot ÄÃ£ sáºµn sÃ ng! Äang láº¯ng nghe messages...\n");
    
  } catch (error) {
    console.error("[MAIN] Lá»i khá»i Äá»ng bot:", error);
    process.exit(1);
  }
}

// === SIGNAL HANDLERS ===
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("uncaughtException", (error) => {
  console.error("[FATAL] Uncaught exception:", error);
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("[FATAL] Unhandled rejection at:", promise, "reason:", reason);
});

// Start bot
main();
