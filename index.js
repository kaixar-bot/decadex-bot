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
 * LÆ°u Ã½: RPC_URL lÃ  optional - náº¿u khÃ´ng cÃ³ sáº½ dÃ¹ng ALCHEMY_API_KEY Äá» táº¡o URL
 */
const REQUIRED_ENV_VARS = [
  "TELEGRAM_BOT_TOKEN",
  "PRIVATE_KEY", 
  "CONTRACT_ADDRESS",
];

/**
 * Biáº¿n mÃ´i trÆ°á»ng cáº§n Ã­t nháº¥t 1 trong 2
 * User cáº§n cÃ³ ALCHEMY_API_KEY hoáº·c RPC_URL
 */
const RPC_ENV_VARS = ["ALCHEMY_API_KEY", "RPC_URL"];

/**
 * Validate vÃ  load environment variables
 */
const envValidation = validateEnvVariables(process.env, REQUIRED_ENV_VARS);
if (!envValidation.isValid) {
  console.error("[ERROR] " + envValidation.error);
  console.error("[INFO] Vui lÃ²ng kiá»m tra file .env hoáº·c Replit Secrets");
  process.exit(1);
}

// Kiá»m tra pháº£i cÃ³ Ã­t nháº¥t ALCHEMY_API_KEY hoáº·c RPC_URL
const hasAlchemyKey = process.env.ALCHEMY_API_KEY && process.env.ALCHEMY_API_KEY.trim() !== "";
const hasRpcUrl = process.env.RPC_URL && process.env.RPC_URL.trim() !== "";

if (!hasAlchemyKey && !hasRpcUrl) {
  console.error("[ERROR] Thiáº¿u cáº¥u hÃ¬nh RPC. Cáº§n Ã­t nháº¥t má»t trong hai:");
  console.error("  - ALCHEMY_API_KEY: API key tá»« Alchemy");
  console.error("  - RPC_URL: URL RPC endpoint Äáº§y Äá»§");
  console.error("[INFO] Vui lÃ²ng thÃªm vÃ o file .env hoáº·c Replit Secrets");
  process.exit(1);
}

// Láº¥y cÃ¡c biáº¿n mÃ´i trÆ°á»ng ÄÃ£ validate
const token = process.env.TELEGRAM_BOT_TOKEN;
const privateKey = process.env.PRIVATE_KEY;
const contractAddress = process.env.CONTRACT_ADDRESS;

// Cáº¥u hÃ¬nh RPC URL - Æ°u tiÃªn RPC_URL náº¿u cÃ³, fallback vá» ALCHEMY_API_KEY
let rpcUrl;
if (hasRpcUrl) {
  rpcUrl = process.env.RPC_URL;
  console.log("[CONFIG] Sá»­ dá»¥ng RPC_URL tá»« environment");
} else {
  const alchemyApiKey = process.env.ALCHEMY_API_KEY;
  rpcUrl = `https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`;
  console.log("[CONFIG] Sá»­ dá»¥ng ALCHEMY_API_KEY vá»i network eth-sepolia");
}

console.log("[CONFIG] CÃ¡c biáº¿n mÃ´i trÆ°á»ng ÄÃ£ ÄÆ°á»£c load thÃ nh cÃ´ng");
import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { ethers } from "ethers";
import { readFileSync } from "fs";

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

console.log("=== DECADEX BOT STARTING ===");

// ============================================
// PHÃ¡ÂºÂ¦N 1: CÃ¡ÂºÂ¤U HÃÂNH VÃÂ KHÃ¡Â»ÂI TÃ¡ÂºÂ O
// ============================================

/**
 * Danh sÃÂ¡ch cÃÂ¡c biÃ¡ÂºÂ¿n mÃÂ´i trÃÂ°Ã¡Â»Âng bÃ¡ÂºÂ¯t buÃ¡Â»Âc
 */
const REQUIRED_ENV_VARS = [
  "TELEGRAM_BOT_TOKEN",
  "PRIVATE_KEY", 
  "ALCHEMY_API_KEY",
  "CONTRACT_ADDRESS",
];

/**
 * Validate vÃÂ  load environment variables
 */
const envValidation = validateEnvVariables(process.env, REQUIRED_ENV_VARS);
if (!envValidation.isValid) {
  console.error("[ERROR] " + envValidation.error);
  console.error("[INFO] Vui lÃÂ²ng kiÃ¡Â»Âm tra file .env cÃ¡Â»Â§a bÃ¡ÂºÂ¡n");
  process.exit(1);
}

// LÃ¡ÂºÂ¥y cÃÂ¡c biÃ¡ÂºÂ¿n mÃÂ´i trÃÂ°Ã¡Â»Âng ÃÂÃÂ£ validate
const token = process.env.TELEGRAM_BOT_TOKEN;
const privateKey = process.env.PRIVATE_KEY;
const alchemyApiKey = process.env.ALCHEMY_API_KEY;
const contractAddress = process.env.CONTRACT_ADDRESS;

// CÃ¡ÂºÂ¥u hÃÂ¬nh RPC URL
const rpcUrl = `https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`;

// ============================================
// PHÃ¡ÂºÂ¦N 2: KHÃ¡Â»ÂI TÃ¡ÂºÂ O CÃÂC SERVICE
// ============================================

/**
 * Load vÃÂ  parse ABI tÃ¡Â»Â« file
 * @returns {Object} ABI object
 */
function loadABI() {
  try {
    const abiContent = readFileSync("./abi.json", "utf-8");
    return JSON.parse(abiContent);
  } catch (error) {
    console.error("[ERROR] KhÃÂ´ng thÃ¡Â»Â ÃÂÃ¡Â»Âc file abi.json:", error.message);
    process.exit(1);
  }
}

// KhÃ¡Â»Âi tÃ¡ÂºÂ¡o cÃÂ¡c components
const abi = loadABI();
const bot = new TelegramBot(token, { polling: true });
const provider = new ethers.JsonRpcProvider(rpcUrl);

// Validate vÃÂ  chuÃ¡ÂºÂ©n hÃÂ³a ÃÂÃ¡Â»Âa chÃ¡Â»Â contract
let validatedContractAddress;
try {
  validatedContractAddress = ethers.getAddress(contractAddress);
} catch (error) {
  console.error("[ERROR] ÃÂÃ¡Â»Âa chÃ¡Â»Â contract khÃÂ´ng hÃ¡Â»Â£p lÃ¡Â»Â:", contractAddress);
  process.exit(1);
}

// KhÃ¡Â»Âi tÃ¡ÂºÂ¡o contract vÃ¡Â»Âi signer
const wallet = new ethers.Wallet(privateKey, provider);
const contract = new ethers.Contract(validatedContractAddress, abi, wallet);

// Session storage cho cÃÂ¡c user
const userSessions = {};

// ============================================
// PHÃ¡ÂºÂ¦N 3: KHÃ¡Â»ÂI TÃ¡ÂºÂ O fhEVM SINGLETON
// ============================================

/**
 * KhÃ¡Â»Âi tÃ¡ÂºÂ¡o fhEVM instance mÃ¡Â»Ât lÃ¡ÂºÂ§n duy nhÃ¡ÂºÂ¥t khi bot start
 * SÃ¡Â»Â­ dÃ¡Â»Â¥ng singleton pattern ÃÂÃ¡Â»Â tÃÂ¡i sÃ¡Â»Â­ dÃ¡Â»Â¥ng
 */
async function initializeFhEVMSingleton() {
  try {
    console.log("[FhEVM] ÃÂang khÃ¡Â»Âi tÃ¡ÂºÂ¡o singleton instance...");
    await initializeFhEVM({
      networkUrl: rpcUrl,
      verifyingContract: validatedContractAddress,
    });
    console.log("[FhEVM] Singleton ÃÂÃÂ£ sÃ¡ÂºÂµn sÃÂ ng!");
    return true;
  } catch (error) {
    console.error("[FhEVM] LÃ¡Â»Âi khÃ¡Â»Âi tÃ¡ÂºÂ¡o singleton:", error.message);
    return false;
  }
}

// ============================================
// PHÃ¡ÂºÂ¦N 4: XÃ¡Â»Â¬ LÃÂ BID
// ============================================

/**
 * XÃ¡Â»Â­ lÃÂ½ mÃ¡Â»Ât bid request tÃ¡Â»Â« user
 * @param {number} chatId - Telegram chat ID
 * @param {any} rawAmount - SÃ¡Â»Â tiÃ¡Â»Ân bid (chÃÂ°a validate)
 * @returns {Promise<Object>} KÃ¡ÂºÂ¿t quÃ¡ÂºÂ£ xÃ¡Â»Â­ lÃÂ½ bid
 */
async function processBid(chatId, rawAmount) {
  const startTime = Date.now();
  
  // BÃÂ°Ã¡Â»Âc 1: KiÃ¡Â»Âm tra user session
  const userWallet = userSessions[chatId];
  if (!userWallet) {
    return {
      success: false,
      error: "Vui lÃÂ²ng kÃ¡ÂºÂ¿t nÃ¡Â»Âi vÃÂ­ trÃÂ°Ã¡Â»Âc bÃ¡ÂºÂ±ng /connect_wallet",
    };
  }

  // BÃÂ°Ã¡Â»Âc 2: Validate bid amount
  const validation = validateBidAmount(rawAmount);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.error,
    };
  }
  const amount = validation.value;

  // BÃÂ°Ã¡Â»Âc 3: KiÃ¡Â»Âm tra fhEVM instance
  if (!isInitialized()) {
    console.log("[Bid] fhEVM chÃÂ°a sÃ¡ÂºÂµn sÃÂ ng, ÃÂang khÃ¡Â»Âi tÃ¡ÂºÂ¡o...");
    const initSuccess = await initializeFhEVMSingleton();
    if (!initSuccess) {
      return {
        success: false,
        error: "HÃ¡Â»Â thÃ¡Â»Âng mÃÂ£ hÃÂ³a chÃÂ°a sÃ¡ÂºÂµn sÃÂ ng, vui lÃÂ²ng thÃ¡Â»Â­ lÃ¡ÂºÂ¡i sau",
      };
    }
  }

  // BÃÂ°Ã¡Â»Âc 4: LÃ¡ÂºÂ¥y fhEVM instance (singleton)
  const fhevmInstance = getFhEVMInstance();
  if (!fhevmInstance) {
    return {
      success: false,
      error: "KhÃÂ´ng thÃ¡Â»Â kÃ¡ÂºÂ¿t nÃ¡Â»Âi hÃ¡Â»Â thÃ¡Â»Âng mÃÂ£ hÃÂ³a",
    };
  }

  try {
    // BÃÂ°Ã¡Â»Âc 5: MÃÂ£ hÃÂ³a bid amount
    console.log(`[Bid] ÃÂang xÃ¡Â»Â­ lÃÂ½ bid ${amount} cho chat ${chatId}`);
    const encrypted = await encryptBidAmount(
      fhevmInstance,
      validatedContractAddress,
      userWallet.address,
      amount
    );

    // BÃÂ°Ã¡Â»Âc 6: GÃ¡Â»Â­i transaction lÃÂªn blockchain
    console.log("[Bid] ÃÂang gÃ¡Â»Â­i transaction...");
    const tx = await contract.bid(encrypted.handles[0], encrypted.inputProof);
    
    // BÃÂ°Ã¡Â»Âc 7: ChÃ¡Â»Â confirmation
    console.log(`[Bid] ÃÂang chÃ¡Â»Â confirmation cho tx: ${tx.hash}`);
    const receipt = await tx.wait();

    const elapsed = Date.now() - startTime;
    console.log(`[Bid] ThÃÂ nh cÃÂ´ng trong ${elapsed}ms - Block: ${receipt.blockNumber}`);

    return {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      amount: amount,
      elapsed: elapsed,
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[Bid] LÃ¡Â»Âi sau ${elapsed}ms:`, error.message);
    
    // PhÃÂ¢n loÃ¡ÂºÂ¡i lÃ¡Â»Âi ÃÂÃ¡Â»Â trÃ¡ÂºÂ£ vÃ¡Â»Â message phÃÂ¹ hÃ¡Â»Â£p
    let userMessage = "ÃÂÃÂ£ xÃ¡ÂºÂ£y ra lÃ¡Â»Âi khi xÃ¡Â»Â­ lÃÂ½ bid";
    
    if (error.message.includes("insufficient funds")) {
      userMessage = "KhÃÂ´ng ÃÂÃ¡Â»Â§ ETH ÃÂÃ¡Â»Â thÃ¡Â»Â±c hiÃ¡Â»Ân giao dÃ¡Â»Âch";
    } else if (error.message.includes("nonce")) {
      userMessage = "LÃ¡Â»Âi giao dÃ¡Â»Âch, vui lÃÂ²ng thÃ¡Â»Â­ lÃ¡ÂºÂ¡i";
    } else if (error.message.includes("network")) {
      userMessage = "LÃ¡Â»Âi kÃ¡ÂºÂ¿t nÃ¡Â»Âi mÃ¡ÂºÂ¡ng, vui lÃÂ²ng thÃ¡Â»Â­ lÃ¡ÂºÂ¡i sau";
    }

    return {
      success: false,
      error: userMessage,
      technicalError: error.message,
    };
  }
}

// ============================================
// PHÃ¡ÂºÂ¦N 5: TELEGRAM BOT HANDLERS
// ============================================

/**
 * Handler cho lÃ¡Â»Ânh /start
 */
bot.onText(/\/start/, (msg) => {
  const helpMessage = `
Ã°ÂÂ¤Â *DECADEX BOT*

CÃÂ¡c lÃ¡Â»Ânh cÃÂ³ sÃ¡ÂºÂµn:
Ã¢ÂÂ¢ /connect_wallet - TÃ¡ÂºÂ¡o vÃÂ­ mÃ¡Â»Âi
Ã¢ÂÂ¢ /bid [sÃ¡Â»Â tiÃ¡Â»Ân] - ÃÂÃ¡ÂºÂ·t bid (vÃÂ­ dÃ¡Â»Â¥: /bid 100)

GiÃ¡Â»Âi hÃ¡ÂºÂ¡n bid: ${BID_LIMITS.MIN_AMOUNT} - ${BID_LIMITS.MAX_AMOUNT}
  `.trim();
  
  bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: "Markdown" });
});

/**
 * Handler cho lÃ¡Â»Ânh /connect_wallet
 */
bot.onText(/\/connect_wallet/, async (msg) => {
  try {
    const newWallet = ethers.Wallet.createRandom();
    userSessions[msg.chat.id] = newWallet;
    
    const response = `
Ã¢ÂÂ *VÃÂ­ ÃÂÃÂ£ ÃÂÃÂ°Ã¡Â»Â£c tÃ¡ÂºÂ¡o thÃÂ nh cÃÂ´ng!*

Ã°ÂÂÂ ÃÂÃ¡Â»Âa chÃ¡Â»Â: \`${newWallet.address}\`

Ã¢ÂÂ Ã¯Â¸Â LÃÂ°u ÃÂ½: ÃÂÃÂ¢y lÃÂ  vÃÂ­ tÃ¡ÂºÂ¡m thÃ¡Â»Âi, sÃ¡ÂºÂ½ mÃ¡ÂºÂ¥t khi bot restart.
    `.trim();
    
    bot.sendMessage(msg.chat.id, response, { parse_mode: "Markdown" });
    console.log(`[Wallet] User ${msg.chat.id} ÃÂÃÂ£ kÃ¡ÂºÂ¿t nÃ¡Â»Âi vÃÂ­: ${newWallet.address.slice(0, 10)}...`);
  } catch (error) {
    console.error("[Wallet] LÃ¡Â»Âi tÃ¡ÂºÂ¡o vÃÂ­:", error.message);
    bot.sendMessage(msg.chat.id, "Ã¢ÂÂ KhÃÂ´ng thÃ¡Â»Â tÃ¡ÂºÂ¡o vÃÂ­, vui lÃÂ²ng thÃ¡Â»Â­ lÃ¡ÂºÂ¡i.");
  }
});

/**
 * Handler cho lÃ¡Â»Ânh /bid
 */
bot.onText(/\/bid(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const rawAmount = match[1];

  // KiÃ¡Â»Âm tra cÃÂ³ nhÃ¡ÂºÂ­p sÃ¡Â»Â tiÃ¡Â»Ân khÃÂ´ng
  if (!rawAmount) {
    bot.sendMessage(chatId, "Ã¢ÂÂ Vui lÃÂ²ng nhÃ¡ÂºÂ­p sÃ¡Â»Â tiÃ¡Â»Ân bid. VÃÂ­ dÃ¡Â»Â¥: /bid 100");
    return;
  }

  // ThÃÂ´ng bÃÂ¡o ÃÂang xÃ¡Â»Â­ lÃÂ½
  const processingMsg = await bot.sendMessage(chatId, "Ã¢ÂÂ³ ÃÂang xÃ¡Â»Â­ lÃÂ½ bid...");

  // XÃ¡Â»Â­ lÃÂ½ bid
  const result = await processBid(chatId, rawAmount);

  // XÃÂ³a message ÃÂang xÃ¡Â»Â­ lÃÂ½
  try {
    await bot.deleteMessage(chatId, processingMsg.message_id);
  } catch (e) {
    // Ignore nÃ¡ÂºÂ¿u khÃÂ´ng xÃÂ³a ÃÂÃÂ°Ã¡Â»Â£c
  }

  // GÃ¡Â»Â­i kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£
  if (result.success) {
    const successMessage = `
Ã¢ÂÂ *Bid thÃÂ nh cÃÂ´ng!*

Ã°ÂÂÂ° SÃ¡Â»Â tiÃ¡Â»Ân: ${result.amount}
Ã°ÂÂÂ TX Hash: \`${result.txHash}\`
Ã°ÂÂÂ¦ Block: ${result.blockNumber}
Ã¢ÂÂ±Ã¯Â¸Â ThÃ¡Â»Âi gian: ${result.elapsed}ms
    `.trim();
    
    bot.sendMessage(chatId, successMessage, { parse_mode: "Markdown" });
  } else {
    bot.sendMessage(chatId, `Ã¢ÂÂ ${result.error}`);
  }
});

// ============================================
// PHÃ¡ÂºÂ¦N 6: KHÃ¡Â»ÂI ÃÂÃ¡Â»ÂNG BOT
// ============================================

/**
 * HÃÂ m khÃ¡Â»Âi ÃÂÃ¡Â»Âng chÃÂ­nh
 * KhÃ¡Â»Âi tÃ¡ÂºÂ¡o fhEVM trÃÂ°Ã¡Â»Âc khi bÃ¡ÂºÂ¯t ÃÂÃ¡ÂºÂ§u nhÃ¡ÂºÂ­n lÃ¡Â»Ânh
 */
async function startBot() {
  console.log("[Bot] ÃÂang khÃ¡Â»Âi ÃÂÃ¡Â»Âng...");
  
  // Pre-initialize fhEVM singleton ÃÂÃ¡Â»Â giÃ¡ÂºÂ£m latency cho bid ÃÂÃ¡ÂºÂ§u tiÃÂªn
  const fhevmReady = await initializeFhEVMSingleton();
  
  if (fhevmReady) {
    console.log("[Bot] fhEVM ÃÂÃÂ£ sÃ¡ÂºÂµn sÃÂ ng - Singleton pattern active");
  } else {
    console.warn("[Bot] fhEVM sÃ¡ÂºÂ½ ÃÂÃÂ°Ã¡Â»Â£c khÃ¡Â»Âi tÃ¡ÂºÂ¡o khi cÃÂ³ bid ÃÂÃ¡ÂºÂ§u tiÃÂªn");
  }
  
  console.log("=== DECADEX BOT ONLINE! ===");
  console.log(`[Config] Contract: ${validatedContractAddress}`);
  console.log(`[Config] Network: Sepolia (Alchemy)`);
}

// KhÃ¡Â»Âi ÃÂÃ¡Â»Âng bot
startBot().catch((error) => {
  console.error("[Fatal] LÃ¡Â»Âi khÃ¡Â»Âi ÃÂÃ¡Â»Âng bot:", error.message);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[Bot] ÃÂang tÃ¡ÂºÂ¯t...");
  bot.stopPolling();
  process.exit(0);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Error] Unhandled Rejection:", reason);
});
