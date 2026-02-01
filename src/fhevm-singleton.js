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
 * Cáº¥u hÃ¬nh máº·c Äá»nh cho fhEVM
 * Sá»­ dá»¥ng Sepolia testnet (networkUrl sáº½ ÄÆ°á»£c set tá»« env)
 */
const DEFAULT_CONFIG = {
  verifyingContract: null, // Sáº½ ÄÆ°á»£c set khi khá»i táº¡o
  networkUrl: null,        // Sáº½ ÄÆ°á»£c set khi khá»i táº¡o
};

/**
 * Khá»i táº¡o fhEVM instance (chá» cháº¡y 1 láº§n)
 * @param {Object} config - Cáº¥u hÃ¬nh cho fhEVM
 * @param {string} config.networkUrl - RPC URL cá»§a blockchain
 * @param {string} config.verifyingContract - Äá»a chá» contract Äá» verify
 * @returns {Promise<Object>} fhEVM instance
 * @throws {Error} Náº¿u khá»i táº¡o tháº¥t báº¡i
 */
async function initializeFhEVM(config) {
  // Kiá»m tra config báº¯t buá»c
  if (!config || !config.networkUrl) {
    throw new Error("[FhEVM] Lá»i cáº¥u hÃ¬nh: networkUrl lÃ  báº¯t buá»c");
  }

  // Náº¿u ÄÃ£ cÃ³ instance, tráº£ vá» luÃ´n
  if (fhevmInstance) {
    console.log("[FhEVM] Instance ÄÃ£ tá»n táº¡i, sá»­ dá»¥ng láº¡i");
    return fhevmInstance;
  }

  // Náº¿u Äang trong quÃ¡ trÃ¬nh khá»i táº¡o, chá» promise hiá»n táº¡i
  if (isInitializing && initializationPromise) {
    console.log("[FhEVM] Äang chá» khá»i táº¡o tá»« request trÆ°á»c...");
    return initializationPromise;
  }

  // Báº¯t Äáº§u khá»i táº¡o
  isInitializing = true;
  console.log("[FhEVM] Báº¯t Äáº§u khá»i táº¡o instance má»i...");

  initializationPromise = (async () => {
    try {
      const startTime = Date.now();
      
      // Táº¡o instance vá»i cáº¥u hÃ¬nh ÄÃ£ merge
      const mergedConfig = { ...DEFAULT_CONFIG, ...config };
      fhevmInstance = await createInstance({
        networkUrl: mergedConfig.networkUrl,
        gatewayUrl: "https://gateway.sepolia.zama.ai",
      });

      const elapsed = Date.now() - startTime;
      console.log(`[FhEVM] Khá»i táº¡o thÃ nh cÃ´ng trong ${elapsed}ms`);
      
      return fhevmInstance;
    } catch (error) {
      // Reset tráº¡ng thÃ¡i náº¿u tháº¥t báº¡i
      fhevmInstance = null;
      isInitializing = false;
      initializationPromise = null;
      
      console.error("[FhEVM] Lá»i khá»i táº¡o:", error.message);
      throw new Error(`[FhEVM] KhÃ´ng thá» khá»i táº¡o: ${error.message}`);
    } finally {
      isInitializing = false;
    }
  })();

  return initializationPromise;
}

/**
 * Láº¥y fhEVM instance hiá»n táº¡i (pháº£i gá»i initializeFhEVM trÆ°á»c)
 * @returns {Object|null} fhEVM instance hoáº·c null náº¿u chÆ°a khá»i táº¡o
 */
function getFhEVMInstance() {
  if (!fhevmInstance) {
    console.warn("[FhEVM] Cáº£nh bÃ¡o: Instance chÆ°a ÄÆ°á»£c khá»i táº¡o, hÃ£y gá»i initializeFhEVM trÆ°á»c");
  }
  return fhevmInstance;
}

/**
 * Kiá»m tra xem fhEVM ÄÃ£ ÄÆ°á»£c khá»i táº¡o chÆ°a
 * @returns {boolean} true náº¿u ÄÃ£ khá»i táº¡o
 */
function isInitialized() {
  return fhevmInstance !== null;
}

/**
 * Reset instance (chá» dÃ¹ng cho testing hoáº·c khi cáº§n khá»i táº¡o láº¡i)
 * Cáº£nh bÃ¡o: KhÃ´ng nÃªn dÃ¹ng trong production
 */
function resetInstance() {
  console.warn("[FhEVM] Äang reset instance - chá» dÃ¹ng cho testing!");
  fhevmInstance = null;
  isInitializing = false;
  initializationPromise = null;
}

/**
 * MÃ£ hÃ³a sá» bid sá»­ dá»¥ng fhEVM (ÄÃ£ khá»i táº¡o)
 * @param {Object} instance - fhEVM instance
 * @param {string} contractAddress - Äá»a chá» contract
 * @param {string} userAddress - Äá»a chá» vÃ­ ngÆ°á»i dÃ¹ng
 * @param {number} amount - Sá» tiá»n bid
 * @returns {Promise<Object>} Object chá»©a encrypted input vÃ  proof
 * @throws {Error} Náº¿u mÃ£ hÃ³a tháº¥t báº¡i
 */
async function encryptBidAmount(instance, contractAddress, userAddress, amount) {
  if (!instance) {
    throw new Error("[FhEVM] Instance chÆ°a ÄÆ°á»£c khá»i táº¡o");
  }

  try {
    console.log(`[FhEVM] Äang mÃ£ hÃ³a bid amount: ${amount} cho user: ${userAddress.slice(0, 8)}...`);
    
    const input = instance.createEncryptedInput(contractAddress, userAddress);
    input.add64(amount);
    
    const encrypted = await input.encrypt();
    
    console.log("[FhEVM] MÃ£ hÃ³a thÃ nh cÃ´ng");
    return encrypted;
  } catch (error) {
    console.error("[FhEVM] Lá»i mÃ£ hÃ³a:", error.message);
    throw new Error(`[FhEVM] KhÃ´ng thá» mÃ£ hÃ³a bid: ${error.message}`);
  }
}

export {
  initializeFhEVM,
  getFhEVMInstance,
  isInitialized,
  resetInstance,
  encryptBidAmount,
};
