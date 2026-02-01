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

// === DEFAULT VALUES ===
const DEFAULT_CONTRACT_ADDRESS = "0xe9c1349c959f98f3d6e1c25b1bc3a4376921423d";
const DEFAULT_RELAYER_URL = "https://relayer.testnet.zama.org";

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
  const status = value ? `â SET (length: ${value.length})` : "â MISSING";
  console.log(`[ENV]   ${varName}: ${status}`);
});
console.log("=== END ENVIRONMENT DEBUG ===\n");

// === VALIDATE ENVIRONMENT BEFORE STARTING ===
const envValidation = validateEnvVariables();
if (!envValidation.isValid) {
  console.error("\nâ ENVIRONMENT VALIDATION FAILED:");
  console.error(envValidation.error);
  console.error("\nPlease set the required environment variables and restart.");
  console.error("Required: TELEGRAM_BOT_TOKEN, PRIVATE_KEY, RPC_URL");
  console.error("Optional: CONTRACT_ADDRESS (has default), RELAYER_URL (has default)");
  process.exit(1);
}

// === CONFIGURATION ===
// Apply defaults for optional variables
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS;
const RELAYER_URL = process.env.RELAYER_URL || DEFAULT_RELAYER_URL;

console.log("[CONFIG] Using configuration:");
console.log(`[CONFIG]   CONTRACT_ADDRESS: ${CONTRACT_ADDRESS}${!process.env.CONTRACT_ADDRESS ? ' (default)' : ''}`);
console.log(`[CONFIG]   RELAYER_URL: ${RELAYER_URL}${!process.env.RELAYER_URL ? ' (default)' : ''}`);
console.log(`[CONFIG]   RPC_URL: ${process.env.RPC_URL.substring(0, 30)}...`);

// Initialize Telegram Bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Initialize ethers provider and wallet
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Load ABI
let contractABI;
try {
  contractABI = JSON.parse(readFileSync("./abi/DecaDex.json", "utf8"));
  console.log("[INIT] ABI loaded successfully");
} catch (error) {
  console.error("[INIT] Failed to load ABI:", error.message);
  process.exit(1);
}

// Initialize contract
const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, wallet);

// State tracking
const userStates = {};

// Helper function Äá» gá»­i message vá»i retry
async function sendMessageWithRetry(chatId, text, options = {}, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await bot.sendMessage(chatId, text, options);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

// Command: /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `
ð¯ *Welcome to DecaDex Bot!*

This bot helps you interact with the DecaDex smart contract on Zama network.

*Available Commands:*
/bid <amount> - Place a bid (encrypted with FHE)
/balance - Check your wallet balance
/contract - View contract information
/help - Show this help message

*Contract Address:* \`${CONTRACT_ADDRESS}\`
  `;
  
  await sendMessageWithRetry(chatId, welcomeMessage, { parse_mode: "Markdown" });
});

// Command: /help
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `
ð *DecaDex Bot Help*

*Commands:*
â¢ /bid <amount> - Place an encrypted bid
  Example: /bid 100
  Min: ${BID_LIMITS.MIN_AMOUNT}, Max: ${BID_LIMITS.MAX_AMOUNT}

â¢ /balance - Check your wallet balance

â¢ /contract - View contract details

*How Bidding Works:*
1. Your bid amount is encrypted using FHE
2. The encrypted bid is sent to the contract
3. Only the contract can decrypt and process bids

*Security:*
All bids are fully encrypted - no one can see your bid amount except the contract!
  `;
  
  await sendMessageWithRetry(chatId, helpMessage, { parse_mode: "Markdown" });
});

// Command: /balance
bot.onText(/\/balance/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    const balance = await provider.getBalance(wallet.address);
    const balanceInEth = ethers.formatEther(balance);
    
    const balanceMessage = `
ð° *Wallet Balance*

Address: \`${wallet.address}\`
Balance: ${balanceInEth} ETH
    `;
    
    await sendMessageWithRetry(chatId, balanceMessage, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("[BALANCE] Error:", error);
    await sendMessageWithRetry(chatId, "â Failed to fetch balance. Please try again.");
  }
});

// Command: /contract
bot.onText(/\/contract/, async (msg) => {
  const chatId = msg.chat.id;
  
  const contractMessage = `
ð *Contract Information*

Address: \`${CONTRACT_ADDRESS}\`
Network: Zama Devnet
Relayer: ${RELAYER_URL}

*Features:*
â¢ FHE-encrypted bidding
â¢ Confidential transactions
â¢ Secure auction mechanism
  `;
  
  await sendMessageWithRetry(chatId, contractMessage, { parse_mode: "Markdown" });
});

// Command: /bid
bot.onText(/\/bid(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const amountStr = match[1];
  
  // Validate amount
  if (!amountStr) {
    await sendMessageWithRetry(chatId, `
â *Missing bid amount*

Usage: /bid <amount>
Example: /bid 100

Limits: Min ${BID_LIMITS.MIN_AMOUNT}, Max ${BID_LIMITS.MAX_AMOUNT}
    `, { parse_mode: "Markdown" });
    return;
  }
  
  // Validate bid amount
  const validation = validateBidAmount(amountStr);
  if (!validation.isValid) {
    await sendMessageWithRetry(chatId, `â *Invalid bid:* ${validation.error}`, { parse_mode: "Markdown" });
    return;
  }
  
  const amount = validation.value;
  
  // Send processing message
  const processingMsg = await sendMessageWithRetry(chatId, "â³ Processing your bid...");
  
  try {
    // Initialize FhEVM if not already
    if (!isInitialized()) {
      await bot.editMessageText("ð Initializing encryption...", {
        chat_id: chatId,
        message_id: processingMsg.message_id
      });
      
      await initializeFhEVM(provider, CONTRACT_ADDRESS, wallet);
    }
    
    // Encrypt the bid
    await bot.editMessageText("ð Encrypting your bid...", {
      chat_id: chatId,
      message_id: processingMsg.message_id
    });
    
    const encryptedBid = await encryptBidAmount(amount);
    
    // Send transaction
    await bot.editMessageText("ð¤ Sending transaction...", {
      chat_id: chatId,
      message_id: processingMsg.message_id
    });
    
    const tx = await contract.placeBid(encryptedBid.handles[0], encryptedBid.inputProof);
    
    await bot.editMessageText(`
â³ *Transaction Submitted*

Hash: \`${tx.hash}\`
Waiting for confirmation...
    `, {
      chat_id: chatId,
      message_id: processingMsg.message_id,
      parse_mode: "Markdown"
    });
    
    // Wait for confirmation
    const receipt = await tx.wait();
    
    await bot.editMessageText(`
â *Bid Placed Successfully!*

Amount: ${amount} (encrypted)
Transaction: \`${tx.hash}\`
Block: ${receipt.blockNumber}
Gas Used: ${receipt.gasUsed.toString()}
    `, {
      chat_id: chatId,
      message_id: processingMsg.message_id,
      parse_mode: "Markdown"
    });
    
  } catch (error) {
    console.error("[BID] Error:", error);
    
    let errorMessage = "Unknown error occurred";
    if (error.message.includes("insufficient funds")) {
      errorMessage = "Insufficient funds for transaction";
    } else if (error.message.includes("nonce")) {
      errorMessage = "Transaction nonce error. Please try again.";
    } else if (error.code === "NETWORK_ERROR") {
      errorMessage = "Network error. Please check RPC connection.";
    }
    
    await bot.editMessageText(`â *Bid Failed*\n\nError: ${errorMessage}`, {
      chat_id: chatId,
      message_id: processingMsg.message_id,
      parse_mode: "Markdown"
    });
  }
});

// Error handling
bot.on("polling_error", (error) => {
  console.error("[BOT] Polling error:", error.code, error.message);
});

bot.on("error", (error) => {
  console.error("[BOT] Error:", error);
});

// Startup message
console.log("\nâ DecaDex Bot started successfully!");
console.log(`ð Contract: ${CONTRACT_ADDRESS}`);
console.log(`ð¼ Wallet: ${wallet.address}`);
console.log("ð¤ Waiting for commands...\n");
