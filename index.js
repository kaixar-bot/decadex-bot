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
console.log(`[Bot] Thá»i gian khá»i Äá»ng: ${new Date().toISOString()}`);
console.log(`[Bot] Node version: ${process.version}`);

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
console.log("[Bot] Kiá»m tra environment variables...");
const envValidation = validateEnvVariables(process.env, REQUIRED_ENV_VARS);
if (!envValidation.isValid) {
  console.error("[ERROR] " + envValidation.error);
  console.error("[INFO] Vui lÃ²ng kiá»m tra file .env hoáº·c Replit Secrets");
  process.exit(1);
}
console.log("[Bot] â Environment variables há»£p lá»");

// Kiá»m tra pháº£i cÃ³ Ã­t nháº¥t ALCHEMY_API_KEY hoáº·c RPC_URL
const hasAlchemyKey = process.env.ALCHEMY_API_KEY && process.env.ALCHEMY_API_KEY.trim() !== "";
const hasRpcUrl = process.env.RPC_URL && process.env.RPC_URL.trim() !== "";

if (!hasAlchemyKey && !hasRpcUrl) {
  console.error("[ERROR] Thiáº¿u cáº¥u hÃ¬nh RPC. Cáº§n Ã­t nháº¥t má»t trong hai:");
  console.error("  - ALCHEMY_API_KEY");
  console.error("  - RPC_URL");
  process.exit(1);
}

// XÃ¢y dá»±ng RPC URL
let RPC_URL;
if (hasRpcUrl) {
  RPC_URL = process.env.RPC_URL;
  console.log("[Bot] Sá»­ dá»¥ng RPC_URL tá»« environment");
} else {
  RPC_URL = `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
  console.log("[Bot] Sá»­ dá»¥ng Alchemy API Key Äá» táº¡o RPC URL");
}

// Log config (áº©n sensitive data)
console.log("[Bot] Cáº¥u hÃ¬nh:");
console.log(`  - TELEGRAM_BOT_TOKEN: ***${process.env.TELEGRAM_BOT_TOKEN.slice(-4)}`);
console.log(`  - CONTRACT_ADDRESS: ${process.env.CONTRACT_ADDRESS}`);
console.log(`  - RPC_URL: ${RPC_URL.substring(0, 40)}...`);
console.log(`  - RELAYER_URL: ${process.env.RELAYER_URL || "(sáº½ dÃ¹ng default)"}`);

// Load ABI
let contractABI;
try {
  const abiContent = readFileSync("./abi.json", "utf-8");
  contractABI = JSON.parse(abiContent);
  console.log("[Bot] â ÄÃ£ load ABI thÃ nh cÃ´ng");
} catch (error) {
  console.error("[ERROR] KhÃ´ng thá» load ABI:", error.message);
  process.exit(1);
}

// Khá»i táº¡o provider vÃ  wallet
console.log("[Bot] Khá»i táº¡o Ethereum provider...");
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI, wallet);
console.log(`[Bot] â Wallet address: ${wallet.address}`);

// ============================================
// PHáº¦N 2: KHá»I Táº O TELEGRAM BOT
// ============================================

console.log("[Bot] Khá»i táº¡o Telegram Bot...");
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Log khi bot sáºµn sÃ ng
bot.on("polling_error", (error) => {
  console.error("[Bot] Polling error:", error.code, error.message);
});

console.log("[Bot] â Telegram Bot ÄÃ£ khá»i táº¡o vá»i polling mode");

// ============================================
// PHáº¦N 3: KHá»I Táº O fhEVM
// ============================================

console.log("[Bot] Báº¯t Äáº§u khá»i táº¡o fhEVM...");
let fhevmReady = false;

initializeFhEVM({
  networkUrl: RPC_URL,
  verifyingContract: process.env.CONTRACT_ADDRESS,
  relayerUrl: process.env.RELAYER_URL, // Sáº½ dÃ¹ng default náº¿u undefined
}).then(() => {
  fhevmReady = true;
  console.log("[Bot] â fhEVM ÄÃ£ sáºµn sÃ ng!");
}).catch((error) => {
  console.error("[Bot] â KhÃ´ng thá» khá»i táº¡o fhEVM:", error.message);
  console.error("[Bot] Stack trace:", error.stack);
  // KhÃ´ng exit - bot váº«n cÃ³ thá» pháº£n há»i vá»i thÃ´ng bÃ¡o lá»i
});

// ============================================
// PHáº¦N 4: Xá»¬ LÃ COMMANDS
// ============================================

// Tráº¡ng thÃ¡i Äang chá» bid cho má»i user
const pendingBids = new Map();

/**
 * Xá»­ lÃ½ lá»nh /start
 */
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const username = msg.from?.username || msg.from?.first_name || "Unknown";
  
  console.log(`[Command] /start tá»« user ${username} (ID: ${userId}) trong chat ${chatId}`);
  console.log(`[Command] Message object: ${JSON.stringify(msg, null, 2)}`);
  
  try {
    const welcomeMessage = `
ð¯ *ChÃ o má»«ng Äáº¿n vá»i DecaDex Bot!*

Bot nÃ y cho phÃ©p báº¡n Äáº·t bid mÃ£ hÃ³a (encrypted bid) sá»­ dá»¥ng cÃ´ng nghá» FHE (Fully Homomorphic Encryption).

ð *CÃ¡c lá»nh cÃ³ sáºµn:*
â¢ /start - Hiá»n thá» menu nÃ y
â¢ /bid - Äáº·t bid má»i (sáº½ há»i sá» tiá»n)
â¢ /help - HÆ°á»ng dáº«n chi tiáº¿t
â¢ /status - Kiá»m tra tráº¡ng thÃ¡i há» thá»ng

ð¡ *Giá»i háº¡n bid:*
â¢ Tá»i thiá»u: ${BID_LIMITS.MIN} wei
â¢ Tá»i Äa: ${BID_LIMITS.MAX} wei

ð Bid cá»§a báº¡n sáº½ ÄÆ°á»£c mÃ£ hÃ³a trÆ°á»c khi gá»­i lÃªn blockchain!
    `;
    
    await bot.sendMessage(chatId, welcomeMessage, { parse_mode: "Markdown" });
    console.log(`[Command] â ÄÃ£ gá»­i welcome message cho user ${username}`);
  } catch (error) {
    console.error(`[Command] â Lá»i khi xá»­ lÃ½ /start:`);
    console.error(`[Command] Error: ${error.message}`);
    console.error(`[Command] Stack: ${error.stack}`);
    
    try {
      await bot.sendMessage(chatId, "â CÃ³ lá»i xáº£y ra. Vui lÃ²ng thá»­ láº¡i sau.");
    } catch (sendError) {
      console.error(`[Command] KhÃ´ng thá» gá»­i error message: ${sendError.message}`);
    }
  }
});

/**
 * Xá»­ lÃ½ lá»nh /help
 */
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from?.username || msg.from?.first_name || "Unknown";
  
  console.log(`[Command] /help tá»« user ${username} trong chat ${chatId}`);
  
  try {
    const helpMessage = `
ð *HÆ°á»ng dáº«n sá»­ dá»¥ng DecaDex Bot*

*1. Äáº·t bid:*
   â¢ Gá»­i lá»nh /bid
   â¢ Bot sáº½ há»i sá» tiá»n bid (ÄÆ¡n vá»: wei)
   â¢ Nháº­p sá» tiá»n vÃ  gá»­i
   â¢ Bot sáº½ mÃ£ hÃ³a vÃ  gá»­i transaction

*2. Kiá»m tra tráº¡ng thÃ¡i:*
   â¢ Gá»­i lá»nh /status Äá» xem tráº¡ng thÃ¡i há» thá»ng

*3. LÆ°u Ã½ quan trá»ng:*
   â¢ Bid ÄÆ°á»£c mÃ£ hÃ³a hoÃ n toÃ n báº±ng FHE
   â¢ KhÃ´ng ai cÃ³ thá» biáº¿t sá» tiá»n bid cá»§a báº¡n
   â¢ Transaction cáº§n gas fee (Sepolia ETH)

*4. Troubleshooting:*
   â¢ Náº¿u bot khÃ´ng pháº£n há»i, thá»­ /start
   â¢ Kiá»m tra káº¿t ná»i máº¡ng
   â¢ Äáº£m báº£o wallet cÃ³ Äá»§ gas

ð§ Há» trá»£: LiÃªn há» admin náº¿u gáº·p váº¥n Äá»
    `;
    
    await bot.sendMessage(chatId, helpMessage, { parse_mode: "Markdown" });
    console.log(`[Command] â ÄÃ£ gá»­i help message`);
  } catch (error) {
    console.error(`[Command] â Lá»i /help: ${error.message}`);
    console.error(`[Command] Stack: ${error.stack}`);
  }
});

/**
 * Xá»­ lÃ½ lá»nh /status
 */
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from?.username || msg.from?.first_name || "Unknown";
  
  console.log(`[Command] /status tá»« user ${username}`);
  
  try {
    // Kiá»m tra cÃ¡c thÃ nh pháº§n
    let networkStatus = "â ChÆ°a káº¿t ná»i";
    let blockNumber = "N/A";
    let balance = "N/A";
    
    try {
      const network = await provider.getNetwork();
      blockNumber = await provider.getBlockNumber();
      const walletBalance = await provider.getBalance(wallet.address);
      balance = ethers.formatEther(walletBalance) + " ETH";
      networkStatus = `â ${network.name} (Chain ID: ${network.chainId})`;
    } catch (e) {
      console.error(`[Status] Lá»i kiá»m tra network: ${e.message}`);
    }
    
    const statusMessage = `
ð *Tráº¡ng thÃ¡i há» thá»ng*

ð *Network:* ${networkStatus}
ð¦ *Block hiá»n táº¡i:* ${blockNumber}
ð° *Wallet balance:* ${balance}
ð *fhEVM:* ${fhevmReady ? "â Sáºµn sÃ ng" : "â ChÆ°a khá»i táº¡o"}
ð¤ *Bot:* â Äang hoáº¡t Äá»ng

ð *Contract:* \`${process.env.CONTRACT_ADDRESS}\`
    `;
    
    await bot.sendMessage(chatId, statusMessage, { parse_mode: "Markdown" });
    console.log(`[Command] â ÄÃ£ gá»­i status`);
  } catch (error) {
    console.error(`[Command] â Lá»i /status: ${error.message}`);
    console.error(`[Command] Stack: ${error.stack}`);
  }
});

/**
 * Xá»­ lÃ½ lá»nh /bid
 */
bot.onText(/\/bid/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const username = msg.from?.username || msg.from?.first_name || "Unknown";
  
  console.log(`[Command] /bid tá»« user ${username} (ID: ${userId})`);
  
  try {
    // Kiá»m tra fhEVM
    if (!fhevmReady) {
      await bot.sendMessage(
        chatId,
        "â³ Há» thá»ng Äang khá»i táº¡o. Vui lÃ²ng thá»­ láº¡i sau 10 giÃ¢y."
      );
      console.log(`[Command] fhEVM chÆ°a sáºµn sÃ ng, tá»« chá»i bid`);
      return;
    }
    
    // Äáº·t tráº¡ng thÃ¡i chá» nháº­p bid
    pendingBids.set(userId, { chatId, timestamp: Date.now() });
    
    await bot.sendMessage(
      chatId,
      `ð° *Nháº­p sá» tiá»n bid (ÄÆ¡n vá»: wei)*

ð VÃ­ dá»¥: 1000000000000000000 (= 1 ETH)

â ï¸ Giá»i háº¡n:
â¢ Tá»i thiá»u: ${BID_LIMITS.MIN} wei
â¢ Tá»i Äa: ${BID_LIMITS.MAX} wei

_Gá»­i sá» tiá»n Äá» tiáº¿p tá»¥c hoáº·c /cancel Äá» há»§y_`,
      { parse_mode: "Markdown" }
    );
    
    console.log(`[Command] â ÄÃ£ yÃªu cáº§u nháº­p bid tá»« user ${username}`);
  } catch (error) {
    console.error(`[Command] â Lá»i /bid: ${error.message}`);
    console.error(`[Command] Stack: ${error.stack}`);
  }
});

/**
 * Xá»­ lÃ½ lá»nh /cancel
 */
bot.onText(/\/cancel/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const username = msg.from?.username || msg.from?.first_name || "Unknown";
  
  console.log(`[Command] /cancel tá»« user ${username}`);
  
  if (pendingBids.has(userId)) {
    pendingBids.delete(userId);
    await bot.sendMessage(chatId, "â ÄÃ£ há»§y lá»nh bid.");
    console.log(`[Command] â ÄÃ£ há»§y pending bid cá»§a user ${username}`);
  } else {
    await bot.sendMessage(chatId, "â¹ï¸ KhÃ´ng cÃ³ lá»nh nÃ o Äang chá» xá»­ lÃ½.");
  }
});

// ============================================
// PHáº¦N 5: Xá»¬ LÃ TIN NHáº®N (BID AMOUNT)
// ============================================

/**
 * Xá»­ lÃ½ tin nháº¯n thÃ´ng thÆ°á»ng (khÃ´ng pháº£i command)
 * DÃ¹ng Äá» nháº­n sá» tiá»n bid
 */
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const text = msg.text;
  const username = msg.from?.username || msg.from?.first_name || "Unknown";
  
  // Log má»i message nháº­n ÄÆ°á»£c
  console.log(`[Message] Nháº­n message tá»« user ${username} (ID: ${userId}): "${text}"`);
  
  // Bá» qua commands (ÄÃ£ ÄÆ°á»£c xá»­ lÃ½ á» trÃªn)
  if (text && text.startsWith("/")) {
    console.log(`[Message] Bá» qua command: ${text}`);
    return;
  }
  
  // Kiá»m tra xem cÃ³ Äang chá» bid khÃ´ng
  if (!pendingBids.has(userId)) {
    console.log(`[Message] User ${username} khÃ´ng cÃ³ pending bid, bá» qua message`);
    return;
  }
  
  console.log(`[Message] Xá»­ lÃ½ bid amount tá»« user ${username}: ${text}`);
  
  try {
    // XÃ³a pending state
    pendingBids.delete(userId);
    
    // Validate sá» tiá»n
    const validation = validateBidAmount(text);
    if (!validation.isValid) {
      console.log(`[Bid] Validation failed: ${validation.error}`);
      await bot.sendMessage(chatId, `â ${validation.error}\n\nGá»­i /bid Äá» thá»­ láº¡i.`);
      return;
    }
    
    const amount = validation.amount;
    console.log(`[Bid] Amount há»£p lá»: ${amount}`);
    
    // ThÃ´ng bÃ¡o Äang xá»­ lÃ½
    const processingMsg = await bot.sendMessage(
      chatId,
      "â³ Äang xá»­ lÃ½ bid...\nð MÃ£ hÃ³a sá» tiá»n..."
    );
    
    // MÃ£ hÃ³a bid
    console.log(`[Bid] Báº¯t Äáº§u mÃ£ hÃ³a...`);
    const encryptedAmount = await encryptBidAmount(amount);
    console.log(`[Bid] â MÃ£ hÃ³a thÃ nh cÃ´ng`);
    
    // Cáº­p nháº­t message
    await bot.editMessageText(
      "â³ Äang xá»­ lÃ½ bid...\nð MÃ£ hÃ³a sá» tiá»n... â\nð¤ Gá»­i transaction...",
      { chat_id: chatId, message_id: processingMsg.message_id }
    );
    
    // Gá»­i transaction
    console.log(`[Bid] Gá»­i transaction...`);
    const tx = await contract.bid(encryptedAmount);
    console.log(`[Bid] Transaction hash: ${tx.hash}`);
    
    // Cáº­p nháº­t message
    await bot.editMessageText(
      `â³ Äang xá»­ lÃ½ bid...
ð MÃ£ hÃ³a sá» tiá»n... â
ð¤ Gá»­i transaction... â
â³ Chá» confirmation...

ð TX: \`${tx.hash}\``,
      { chat_id: chatId, message_id: processingMsg.message_id, parse_mode: "Markdown" }
    );
    
    // Chá» confirmation
    console.log(`[Bid] Chá» confirmation...`);
    const receipt = await tx.wait();
    console.log(`[Bid] â Transaction confirmed! Block: ${receipt.blockNumber}`);
    
    // ThÃ´ng bÃ¡o thÃ nh cÃ´ng
    await bot.editMessageText(
      `â *Bid thÃ nh cÃ´ng!*

ð *Chi tiáº¿t:*
â¢ Block: ${receipt.blockNumber}
â¢ Gas used: ${receipt.gasUsed.toString()}

ð *Transaction:*
\`${tx.hash}\`

ð [Xem trÃªn Etherscan](https://sepolia.etherscan.io/tx/${tx.hash})`,
      { 
        chat_id: chatId, 
        message_id: processingMsg.message_id, 
        parse_mode: "Markdown",
        disable_web_page_preview: true
      }
    );
    
    console.log(`[Bid] â HoÃ n táº¥t bid cho user ${username}`);
    
  } catch (error) {
    console.error(`[Bid] â Lá»i khi xá»­ lÃ½ bid:`);
    console.error(`[Bid] Error name: ${error.name}`);
    console.error(`[Bid] Error message: ${error.message}`);
    console.error(`[Bid] Stack trace: ${error.stack}`);
    
    let errorMessage = "â CÃ³ lá»i xáº£y ra khi xá»­ lÃ½ bid.\n\n";
    
    if (error.message.includes("insufficient funds")) {
      errorMessage += "ð° Wallet khÃ´ng Äá»§ gas. Vui lÃ²ng náº¡p thÃªm Sepolia ETH.";
    } else if (error.message.includes("mÃ£ hÃ³a")) {
      errorMessage += "ð Lá»i mÃ£ hÃ³a. Vui lÃ²ng thá»­ láº¡i.";
    } else if (error.message.includes("network")) {
      errorMessage += "ð Lá»i káº¿t ná»i máº¡ng. Vui lÃ²ng thá»­ láº¡i.";
    } else {
      errorMessage += `Lá»i: ${error.message}`;
    }
    
    errorMessage += "\n\nGá»­i /bid Äá» thá»­ láº¡i.";
    
    await bot.sendMessage(chatId, errorMessage);
  }
});

// ============================================
// PHáº¦N 6: GRACEFUL SHUTDOWN
// ============================================

process.on("SIGINT", () => {
  console.log("\n[Bot] Nháº­n SIGINT, Äang táº¯t bot...");
  bot.stopPolling();
  console.log("[Bot] â ÄÃ£ táº¯t polling");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n[Bot] Nháº­n SIGTERM, Äang táº¯t bot...");
  bot.stopPolling();
  console.log("[Bot] â ÄÃ£ táº¯t polling");
  process.exit(0);
});

// Báº¯t unhandled errors
process.on("uncaughtException", (error) => {
  console.error("[Bot] â Uncaught Exception:");
  console.error(`[Bot] Error: ${error.message}`);
  console.error(`[Bot] Stack: ${error.stack}`);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Bot] â Unhandled Rejection at:", promise);
  console.error(`[Bot] Reason: ${reason}`);
});

console.log("=== DECADEX BOT READY ===");
console.log("[Bot] Bot Äang láº¯ng nghe commands...");
console.log("[Bot] Gá»­i /start Äá» báº¯t Äáº§u");
