import { createInstance } from "@zama-fhe/relayer-sdk/node";

/**
 * FhEVM Singleton Module
 * Quáº£n lÃ½ má»t instance fhEVM duy nháº¥t cho toÃ n bá» á»©ng dá»¥ng
 * Sá»­ dá»¥ng Singleton pattern Äá» trÃ¡nh táº¡o instance má»i má»i láº§n bid
 * 
 * FIX: Import tá»« @zama-fhe/relayer-sdk/node (cÃ³ /node)
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
 */
function getRelayerUrl(config) {
  return config?.relayerUrl || process.env.RELAYER_URL || DEFAULT_RELAYER_URL;
}

/**
 * Kiá»m tra fhEVM ÄÃ£ ÄÆ°á»£c khá»i táº¡o chÆ°a
 * @returns {boolean} true náº¿u ÄÃ£ khá»i táº¡o
 */
export function isInitialized() {
  return fhevmInstance !== null;
}

/**
 * Láº¥y instance fhEVM hiá»n táº¡i
 * Throw error náº¿u chÆ°a khá»i táº¡o
 * @returns {object} fhEVM instance
 */
export function getFhEVMInstance() {
  if (!fhevmInstance) {
    throw new Error("FhEVM chÆ°a ÄÆ°á»£c khá»i táº¡o. Gá»i initializeFhEVM() trÆ°á»c.");
  }
  return fhevmInstance;
}

/**
 * Khá»i táº¡o fhEVM vá»i Singleton pattern
 * Äáº£m báº£o chá» cÃ³ má»t instance ÄÆ°á»£c táº¡o
 * 
 * @param {Object} config - Cáº¥u hÃ¬nh khá»i táº¡o
 * @param {string} config.networkUrl - RPC URL (báº¯t buá»c)
 * @param {string} config.relayerUrl - Relayer URL (optional, cÃ³ default)
 * @param {string} config.contractAddress - Contract address (báº¯t buá»c)
 * @returns {Promise<object>} fhEVM instance
 */
export async function initializeFhEVM(config = {}) {
  // Náº¿u ÄÃ£ cÃ³ instance, return luÃ´n
  if (fhevmInstance) {
    console.log("[FhEVM] Sá»­ dá»¥ng instance hiá»n cÃ³");
    return fhevmInstance;
  }
  
  // Náº¿u Äang khá»i táº¡o, Äá»£i promise hoÃ n thÃ nh
  if (isInitializing && initializationPromise) {
    console.log("[FhEVM] Äang Äá»£i khá»i táº¡o hoÃ n thÃ nh...");
    return initializationPromise;
  }
  
  // Báº¯t Äáº§u khá»i táº¡o
  isInitializing = true;
  
  initializationPromise = (async () => {
    try {
      console.log("[FhEVM] Báº¯t Äáº§u khá»i táº¡o...");
      
      // Validate required config
      const networkUrl = config.networkUrl || process.env.RPC_URL;
      if (!networkUrl) {
        throw new Error("networkUrl (RPC_URL) lÃ  báº¯t buá»c Äá» khá»i táº¡o fhEVM");
      }
      
      const contractAddress = config.contractAddress || process.env.CONTRACT_ADDRESS;
      if (!contractAddress) {
        throw new Error("contractAddress lÃ  báº¯t buá»c Äá» khá»i táº¡o fhEVM");
      }
      
      const relayerUrl = getRelayerUrl(config);
      
      console.log(`[FhEVM] Network URL: ${networkUrl.substring(0, 30)}...`);
      console.log(`[FhEVM] Relayer URL: ${relayerUrl}`);
      console.log(`[FhEVM] Contract: ${contractAddress}`);
      
      // Táº¡o instance fhEVM
      fhevmInstance = await createInstance({
        networkUrl: networkUrl,
        relayerUrl: relayerUrl,
      });
      
      console.log("[FhEVM] â Khá»i táº¡o thÃ nh cÃ´ng!");
      
      return fhevmInstance;
      
    } catch (error) {
      // Reset tráº¡ng thÃ¡i náº¿u lá»i
      fhevmInstance = null;
      isInitializing = false;
      initializationPromise = null;
      
      console.error("[FhEVM] â Lá»i khá»i táº¡o:", error.message);
      throw error;
    }
  })();
  
  return initializationPromise;
}

/**
 * MÃ£ hÃ³a bid amount vá»i FHE
 * 
 * @param {number} amount - Sá» tiá»n cáº§n mÃ£ hÃ³a
 * @param {string} contractAddress - Äá»a chá» contract
 * @param {string} userAddress - Äá»a chá» user
 * @returns {Promise<{encryptedValue: string, inputProof: string}>}
 */
export async function encryptBidAmount(amount, contractAddress, userAddress) {
  // Äáº£m báº£o ÄÃ£ khá»i táº¡o
  if (!fhevmInstance) {
    throw new Error("FhEVM chÆ°a ÄÆ°á»£c khá»i táº¡o. Gá»i initializeFhEVM() trÆ°á»c.");
  }
  
  try {
    console.log(`[FhEVM] MÃ£ hÃ³a bid amount: ${amount}`);
    
    // Táº¡o input cho encryption
    const input = fhevmInstance.createEncryptedInput(contractAddress, userAddress);
    
    // ThÃªm sá» nguyÃªn 64-bit (euint64)
    input.add64(BigInt(amount));
    
    // Encrypt
    const encrypted = await input.encrypt();
    
    console.log("[FhEVM] â MÃ£ hÃ³a thÃ nh cÃ´ng");
    
    return {
      encryptedValue: encrypted.handles[0],
      inputProof: encrypted.inputProof
    };
    
  } catch (error) {
    console.error("[FhEVM] â Lá»i mÃ£ hÃ³a:", error.message);
    throw error;
  }
}

/**
 * Reset instance (dÃ¹ng cho testing hoáº·c cleanup)
 */
export function resetFhEVM() {
  fhevmInstance = null;
  isInitializing = false;
  initializationPromise = null;
  console.log("[FhEVM] Instance ÄÃ£ ÄÆ°á»£c reset");
}
