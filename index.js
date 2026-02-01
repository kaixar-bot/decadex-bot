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

console.log("=== DECADEX BOT STARTING ===");

// ============================================
// PHáº¦N 1: Cáº¤U HÃNH VÃ KHá»I Táº O
// ============================================

/**
 * Danh sÃ¡ch cÃ¡c biáº¿n mÃ´i trÆ°á»ng báº¯t buá»c
 */
const REQUIRED_ENV_VARS = [
  "TELEGRAM_BOT_TOKEN",
  "PRIVATE_KEY", 
  "ALCHEMY_API_KEY",
  "CONTRACT_ADDRESS",
];

/**
 * Validate vÃ  load environment variables
 */
const envValidation = validateEnvVariables(process.env, REQUIRED_ENV_VARS);
if (!envValidation.isValid) {
  console.error("[ERROR] " + envValidation.error);
  console.error("[INFO] Vui lÃ²ng kiá»m tra file .env cá»§a báº¡n");
  process.exit(1);
}

// Láº¥y cÃ¡c biáº¿n mÃ´i trÆ°á»ng ÄÃ£ validate
const token = process.env.TELEGRAM_BOT_TOKEN;
const privateKey = process.env.PRIVATE_KEY;
const alchemyApiKey = process.env.ALCHEMY_API_KEY;
const contractAddress = process.env.CONTRACT_ADDRESS;

// Cáº¥u hÃ¬nh RPC URL
const rpcUrl = `https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`;

// ============================================
// PHáº¦N 2: KHá»I Táº O CÃC SERVICE
// ============================================

/**
 * Load vÃ  parse ABI tá»« file
 * @returns {Object} ABI object
 */
function loadABI() {
  try {
    const abiContent = readFileSync("./abi.json", "utf-8");
    return JSON.parse(abiContent);
  } catch (error) {
    console.error("[ERROR] KhÃ´ng thá» Äá»c file abi.json:", error.message);
    process.exit(1);
  }
}

// Khá»i táº¡o cÃ¡c components
const abi = loadABI();
const bot = new TelegramBot(token, { polling: true });
const provider = new ethers.JsonRpcProvider(rpcUrl);

// Validate vÃ  chuáº©n hÃ³a Äá»a chá» contract
let validatedContractAddress;
try {
  validatedContractAddress = ethers.getAddress(contractAddress);
} catch (error) {
  console.error("[ERROR] Äá»a chá» contract khÃ´ng há»£p lá»:", contractAddress);
  process.exit(1);
}

// Khá»i táº¡o contract vá»i signer
const wallet = new ethers.Wallet(privateKey, provider);
const contract = new ethers.Contract(validatedContractAddress, abi, wallet);

// Session storage cho cÃ¡c user
const userSessions = {};

// ============================================
// PHáº¦N 3: KHá»I Táº O fhEVM SINGLETON
// ============================================

/**
 * Khá»i táº¡o fhEVM instance má»t láº§n duy nháº¥t khi bot start
 * Sá»­ dá»¥ng singleton pattern Äá» tÃ¡i sá»­ dá»¥ng
 */
async function initializeFhEVMSingleton() {
  try {
    console.log("[FhEVM] Äang khá»i táº¡o singleton instance...");
    await initializeFhEVM({
      networkUrl: rpcUrl,
      verifyingContract: validatedContractAddress,
    });
    console.log("[FhEVM] Singleton ÄÃ£ sáºµn sÃ ng!");
    return true;
  } catch (error) {
    console.error("[FhEVM] Lá»i khá»i táº¡o singleton:", error.message);
    return false;
  }
}

// ============================================
// PHáº¦N 4: Xá»¬ LÃ BID
// ============================================

/**
 * Xá»­ lÃ½ má»t bid request tá»« user
 * @param {number} chatId - Telegram chat ID
 * @param {any} rawAmount - Sá» tiá»n bid (chÆ°a validate)
 * @returns {Promise<Object>} Káº¿t quáº£ xá»­ lÃ½ bid
 */
async function processBid(chatId, rawAmount) {
  const startTime = Date.now();
  
  // BÆ°á»c 1: Kiá»m tra user session
  const userWallet = userSessions[chatId];
  if (!userWallet) {
    return {
      success: false,
      error: "Vui lÃ²ng káº¿t ná»i vÃ­ trÆ°á»c báº±ng /connect_wallet",
    };
  }

  // BÆ°á»c 2: Validate bid amount
  const validation = validateBidAmount(rawAmount);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.error,
    };
  }
  const amount = validation.value;

  // BÆ°á»c 3: Kiá»m tra fhEVM instance
  if (!isInitialized()) {
    console.log("[Bid] fhEVM chÆ°a sáºµn sÃ ng, Äang khá»i táº¡o...");
    const initSuccess = await initializeFhEVMSingleton();
    if (!initSuccess) {
      return {
        success: false,
        error: "Há» thá»ng mÃ£ hÃ³a chÆ°a sáºµn sÃ ng, vui lÃ²ng thá»­ láº¡i sau",
      };
    }
  }

  // BÆ°á»c 4: Láº¥y fhEVM instance (singleton)
  const fhevmInstance = getFhEVMInstance();
  if (!fhevmInstance) {
    return {
      success: false,
      error: "KhÃ´ng thá» káº¿t ná»i há» thá»ng mÃ£ hÃ³a",
    };
  }

  try {
    // BÆ°á»c 5: MÃ£ hÃ³a bid amount
    console.log(`[Bid] Äang xá»­ lÃ½ bid ${amount} cho chat ${chatId}`);
    const encrypted = await encryptBidAmount(
      fhevmInstance,
      validatedContractAddress,
      userWallet.address,
      amount
    );

    // BÆ°á»c 6: Gá»­i transaction lÃªn blockchain
    console.log("[Bid] Äang gá»­i transaction...");
    const tx = await contract.bid(encrypted.handles[0], encrypted.inputProof);
    
    // BÆ°á»c 7: Chá» confirmation
    console.log(`[Bid] Äang chá» confirmation cho tx: ${tx.hash}`);
    const receipt = await tx.wait();

    const elapsed = Date.now() - startTime;
    console.log(`[Bid] ThÃ nh cÃ´ng trong ${elapsed}ms - Block: ${receipt.blockNumber}`);

    return {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      amount: amount,
      elapsed: elapsed,
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[Bid] Lá»i sau ${elapsed}ms:`, error.message);
    
    // PhÃ¢n loáº¡i lá»i Äá» tráº£ vá» message phÃ¹ há»£p
    let userMessage = "ÄÃ£ xáº£y ra lá»i khi xá»­ lÃ½ bid";
    
    if (error.message.includes("insufficient funds")) {
      userMessage = "KhÃ´ng Äá»§ ETH Äá» thá»±c hiá»n giao dá»ch";
    } else if (error.message.includes("nonce")) {
      userMessage = "Lá»i giao dá»ch, vui lÃ²ng thá»­ láº¡i";
    } else if (error.message.includes("network")) {
      userMessage = "Lá»i káº¿t ná»i máº¡ng, vui lÃ²ng thá»­ láº¡i sau";
    }

    return {
      success: false,
      error: userMessage,
      technicalError: error.message,
    };
  }
}

// ============================================
// PHáº¦N 5: TELEGRAM BOT HANDLERS
// ============================================

/**
 * Handler cho lá»nh /start
 */
bot.onText(/\/start/, (msg) => {
  const helpMessage = `
ð¤ *DECADEX BOT*

CÃ¡c lá»nh cÃ³ sáºµn:
â¢ /connect_wallet - Táº¡o vÃ­ má»i
â¢ /bid [sá» tiá»n] - Äáº·t bid (vÃ­ dá»¥: /bid 100)

Giá»i háº¡n bid: ${BID_LIMITS.MIN_AMOUNT} - ${BID_LIMITS.MAX_AMOUNT}
  `.trim();
  
  bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: "Markdown" });
});

/**
 * Handler cho lá»nh /connect_wallet
 */
bot.onText(/\/connect_wallet/, async (msg) => {
  try {
    const newWallet = ethers.Wallet.createRandom();
    userSessions[msg.chat.id] = newWallet;
    
    const response = `
â *VÃ­ ÄÃ£ ÄÆ°á»£c táº¡o thÃ nh cÃ´ng!*

ð Äá»a chá»: \`${newWallet.address}\`

â ï¸ LÆ°u Ã½: ÄÃ¢y lÃ  vÃ­ táº¡m thá»i, sáº½ máº¥t khi bot restart.
    `.trim();
    
    bot.sendMessage(msg.chat.id, response, { parse_mode: "Markdown" });
    console.log(`[Wallet] User ${msg.chat.id} ÄÃ£ káº¿t ná»i vÃ­: ${newWallet.address.slice(0, 10)}...`);
  } catch (error) {
    console.error("[Wallet] Lá»i táº¡o vÃ­:", error.message);
    bot.sendMessage(msg.chat.id, "â KhÃ´ng thá» táº¡o vÃ­, vui lÃ²ng thá»­ láº¡i.");
  }
});

/**
 * Handler cho lá»nh /bid
 */
bot.onText(/\/bid(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const rawAmount = match[1];

  // Kiá»m tra cÃ³ nháº­p sá» tiá»n khÃ´ng
  if (!rawAmount) {
    bot.sendMessage(chatId, "â Vui lÃ²ng nháº­p sá» tiá»n bid. VÃ­ dá»¥: /bid 100");
    return;
  }

  // ThÃ´ng bÃ¡o Äang xá»­ lÃ½
  const processingMsg = await bot.sendMessage(chatId, "â³ Äang xá»­ lÃ½ bid...");

  // Xá»­ lÃ½ bid
  const result = await processBid(chatId, rawAmount);

  // XÃ³a message Äang xá»­ lÃ½
  try {
    await bot.deleteMessage(chatId, processingMsg.message_id);
  } catch (e) {
    // Ignore náº¿u khÃ´ng xÃ³a ÄÆ°á»£c
  }

  // Gá»­i káº¿t quáº£
  if (result.success) {
    const successMessage = `
â *Bid thÃ nh cÃ´ng!*

ð° Sá» tiá»n: ${result.amount}
ð TX Hash: \`${result.txHash}\`
ð¦ Block: ${result.blockNumber}
â±ï¸ Thá»i gian: ${result.elapsed}ms
    `.trim();
    
    bot.sendMessage(chatId, successMessage, { parse_mode: "Markdown" });
  } else {
    bot.sendMessage(chatId, `â ${result.error}`);
  }
});

// ============================================
// PHáº¦N 6: KHá»I Äá»NG BOT
// ============================================

/**
 * HÃ m khá»i Äá»ng chÃ­nh
 * Khá»i táº¡o fhEVM trÆ°á»c khi báº¯t Äáº§u nháº­n lá»nh
 */
async function startBot() {
  console.log("[Bot] Äang khá»i Äá»ng...");
  
  // Pre-initialize fhEVM singleton Äá» giáº£m latency cho bid Äáº§u tiÃªn
  const fhevmReady = await initializeFhEVMSingleton();
  
  if (fhevmReady) {
    console.log("[Bot] fhEVM ÄÃ£ sáºµn sÃ ng - Singleton pattern active");
  } else {
    console.warn("[Bot] fhEVM sáº½ ÄÆ°á»£c khá»i táº¡o khi cÃ³ bid Äáº§u tiÃªn");
  }
  
  console.log("=== DECADEX BOT ONLINE! ===");
  console.log(`[Config] Contract: ${validatedContractAddress}`);
  console.log(`[Config] Network: Sepolia (Alchemy)`);
}

// Khá»i Äá»ng bot
startBot().catch((error) => {
  console.error("[Fatal] Lá»i khá»i Äá»ng bot:", error.message);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[Bot] Äang táº¯t...");
  bot.stopPolling();
  process.exit(0);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Error] Unhandled Rejection:", reason);
});
