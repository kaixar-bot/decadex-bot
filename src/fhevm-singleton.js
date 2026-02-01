import { createInstance } from "@zama-fhe/relayer-sdk/node";

/**
 * FhEVM Singleton Module
 * Quáº£n lÃ½ má»t instance fhEVM duy nháº¥t cho toÃ n bá» á»©ng dá»¥ng
 * Sá»­ dá»¥ng Singleton pattern Äá» trÃ¡nh táº¡o instance má»i má»i láº§n bid
 */

// Biáº¿n private lÆ°u trá»¯ instance duy nháº¥t
let fhevmInstance = null;

// Tráº¡ng thÃ¡i khá»i táº¡o Äá» trÃ¡nh race condition
let isInitializing = false;
let initializationPromise = null;

/**
 * RELAYER_URL máº·c Äá»nh cho Zama testnet
 * User cÃ³ thá» override qua environment variable
 */
const DEFAULT_RELAYER_URL = "https://relayer.testnet.zama.org";

/**
 * Cáº¥u hÃ¬nh máº·c Äá»nh cho fhEVM
 * Sá»­ dá»¥ng Sepolia testnet (networkUrl sáº½ ÄÆ°á»£c set tá»« env)
 */
const DEFAULT_CONFIG = {
  verifyingContract: null, // Sáº½ ÄÆ°á»£c set khi khá»i táº¡o
  networkUrl: null,        // Sáº½ ÄÆ°á»£c set khi khá»i táº¡o
  relayerUrl: null,        // Sáº½ ÄÆ°á»£c set khi khá»i táº¡o
};

/**
 * Láº¥y relayerUrl tá»« config hoáº·c environment hoáº·c default
 * @param {Object} config - Config object
 * @returns {string} Relayer URL
 */
function getRelayerUrl(config) {
  // Æ¯u tiÃªn: config > env > default
  const relayerUrl = config?.relayerUrl || process.env.RELAYER_URL || DEFAULT_RELAYER_URL;
  console.log(`[FhEVM] Sá»­ dá»¥ng Relayer URL: ${relayerUrl}`);
  return relayerUrl;
}

/**
 * Khá»i táº¡o fhEVM instance (chá» cháº¡y 1 láº§n)
 * @param {Object} config - Cáº¥u hÃ¬nh cho fhEVM
 * @param {string} config.networkUrl - RPC URL cá»§a blockchain
 * @param {string} config.verifyingContract - Äá»a chá» contract Äá» verify
 * @param {string} [config.relayerUrl] - URL cá»§a relayer (optional, cÃ³ default)
 * @returns {Promise<Object>} fhEVM instance
 * @throws {Error} Náº¿u khá»i táº¡o tháº¥t báº¡i
 */
async function initializeFhEVM(config) {
  console.log("[FhEVM] Báº¯t Äáº§u khá»i táº¡o fhEVM...");
  console.log(`[FhEVM] Config nháº­n ÄÆ°á»£c: ${JSON.stringify({
    networkUrl: config?.networkUrl ? "***" : "undefined",
    verifyingContract: config?.verifyingContract || "undefined",
    relayerUrl: config?.relayerUrl || "(sáº½ dÃ¹ng default)"
  })}`);

  // Kiá»m tra config báº¯t buá»c
  if (!config || !config.networkUrl) {
    const error = "[FhEVM] Lá»i cáº¥u hÃ¬nh: networkUrl lÃ  báº¯t buá»c";
    console.error(error);
    throw new Error(error);
  }

  // Náº¿u ÄÃ£ cÃ³ instance, tráº£ vá» luÃ´n
  if (fhevmInstance) {
    console.log("[FhEVM] Instance ÄÃ£ tá»n táº¡i, sá»­ dá»¥ng láº¡i");
    return fhevmInstance;
  }

  // Náº¿u Äang trong quÃ¡ trÃ¬nh khá»i táº¡o, chá» promise hiá»n táº¡i
  if (isInitializing && initializationPromise) {
    console.log("[FhEVM] Äang khá»i táº¡o, chá» promise hiá»n táº¡i...");
    return initializationPromise;
  }

  // Báº¯t Äáº§u khá»i táº¡o
  isInitializing = true;
  console.log("[FhEVM] Báº¯t Äáº§u táº¡o instance má»i...");

  initializationPromise = (async () => {
    try {
      // Láº¥y relayerUrl
      const relayerUrl = getRelayerUrl(config);
      
      console.log("[FhEVM] Äang gá»i createInstance vá»i config:");
      console.log(`  - networkUrl: ${config.networkUrl.substring(0, 30)}...`);
      console.log(`  - verifyingContract: ${config.verifyingContract}`);
      console.log(`  - relayerUrl: ${relayerUrl}`);

      // Táº¡o instance vá»i relayerUrl
      fhevmInstance = await createInstance({
        networkUrl: config.networkUrl,
        verifyingContract: config.verifyingContract,
        relayerUrl: relayerUrl,
      });

      console.log("[FhEVM] â Khá»i táº¡o thÃ nh cÃ´ng!");
      console.log(`[FhEVM] Instance cÃ³ cÃ¡c methods: ${Object.keys(fhevmInstance).join(", ")}`);

      return fhevmInstance;
    } catch (error) {
      // Reset state Äá» cÃ³ thá» thá»­ láº¡i
      fhevmInstance = null;
      console.error("[FhEVM] â Lá»i khi khá»i táº¡o fhEVM:");
      console.error(`[FhEVM] Error name: ${error.name}`);
      console.error(`[FhEVM] Error message: ${error.message}`);
      console.error(`[FhEVM] Stack trace: ${error.stack}`);
      throw new Error(`KhÃ´ng thá» khá»i táº¡o fhEVM: ${error.message}`);
    } finally {
      isInitializing = false;
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

/**
 * Láº¥y instance hiá»n táº¡i (khÃ´ng khá»i táº¡o má»i)
 * @returns {Object|null} fhEVM instance hoáº·c null náº¿u chÆ°a khá»i táº¡o
 */
function getFhEVMInstance() {
  if (!fhevmInstance) {
    console.warn("[FhEVM] Cáº£nh bÃ¡o: getFhEVMInstance ÄÆ°á»£c gá»i nhÆ°ng chÆ°a cÃ³ instance");
  }
  return fhevmInstance;
}

/**
 * Kiá»m tra xem fhEVM ÄÃ£ ÄÆ°á»£c khá»i táº¡o chÆ°a
 * @returns {boolean} true náº¿u ÄÃ£ khá»i táº¡o
 */
function isInstanceInitialized() {
  return fhevmInstance !== null;
}

/**
 * MÃ£ hÃ³a sá» tiá»n bid
 * @param {number} amount - Sá» tiá»n cáº§n mÃ£ hÃ³a
 * @returns {Promise<Object>} Dá»¯ liá»u ÄÃ£ mÃ£ hÃ³a
 * @throws {Error} Náº¿u chÆ°a khá»i táº¡o hoáº·c mÃ£ hÃ³a tháº¥t báº¡i
 */
async function encryptBidAmount(amount) {
  console.log(`[FhEVM] Báº¯t Äáº§u mÃ£ hÃ³a sá» tiá»n: ${amount}`);

  if (!fhevmInstance) {
    const error = "[FhEVM] ChÆ°a khá»i táº¡o fhEVM. Gá»i initializeFhEVM() trÆ°á»c!";
    console.error(error);
    throw new Error(error);
  }

  try {
    console.log("[FhEVM] Gá»i instance.encrypt64...");
    const encrypted = await fhevmInstance.encrypt64(BigInt(amount));
    console.log("[FhEVM] â MÃ£ hÃ³a thÃ nh cÃ´ng!");
    return encrypted;
  } catch (error) {
    console.error("[FhEVM] â Lá»i khi mÃ£ hÃ³a:");
    console.error(`[FhEVM] Error: ${error.message}`);
    console.error(`[FhEVM] Stack: ${error.stack}`);
    throw new Error(`KhÃ´ng thá» mÃ£ hÃ³a sá» tiá»n: ${error.message}`);
  }
}

/**
 * Reset instance (chá»§ yáº¿u dÃ¹ng cho testing)
 * Cáº¢NH BÃO: KhÃ´ng nÃªn sá»­ dá»¥ng trong production
 */
function resetInstance() {
  console.warn("[FhEVM] Cáº¢NH BÃO: Äang reset instance! Chá» dÃ¹ng cho testing.");
  fhevmInstance = null;
  isInitializing = false;
  initializationPromise = null;
}

// Export cÃ¡c function cáº§n thiáº¿t
export {
  initializeFhEVM,
  getFhEVMInstance,
  isInstanceInitialized as isInitialized,
  encryptBidAmount,
  resetInstance,
  DEFAULT_RELAYER_URL,
};
