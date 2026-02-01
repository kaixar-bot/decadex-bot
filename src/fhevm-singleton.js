import { createInstance } from "@zama-fhe/relayer-sdk/node";

/**
 * FhEVM Singleton Module
 * Manages a single fhEVM instance for the entire application
 * Uses Singleton pattern to avoid creating new instances for each bid
 * 
 * FIX: Import from @zama-fhe/relayer-sdk/node (with /node suffix)
 */

// Private variable storing the singleton instance
let fhevmInstance = null;

// Initialization state to prevent race conditions
let isInitializing = false;
let initializationPromise = null;

/**
 * Default RELAYER_URL for Zama testnet
 * User can override via environment variable
 */
const DEFAULT_RELAYER_URL = "https://relayer.testnet.zama.org";

/**
 * Default configuration for fhEVM
 * Uses Sepolia testnet (networkUrl will be set from env)
 */
const DEFAULT_CONFIG = {
  verifyingContract: null, // Will be set during initialization
  networkUrl: null,        // Will be set during initialization
  relayerUrl: null,        // Will be set during initialization
};

/**
 * Get relayerUrl from config or environment or default
 */
function getRelayerUrl(config) {
  return config?.relayerUrl || process.env.RELAYER_URL || DEFAULT_RELAYER_URL;
}

/**
 * Check if fhEVM has been initialized
 * @returns {boolean} true if initialized
 */
export function isInitialized() {
  return fhevmInstance !== null;
}

/**
 * Get current fhEVM instance
 * Throws error if not initialized
 * @returns {object} fhEVM instance
 */
export function getFhEVMInstance() {
  if (!fhevmInstance) {
    throw new Error("FhEVM not initialized. Call initializeFhEVM() first.");
  }
  return fhevmInstance;
}

/**
 * Initialize fhEVM singleton
 * If already initialized, returns existing instance
 * If initializing, waits for completion
 * @param {object} config - Configuration object
 * @param {string} config.rpcUrl - Ethereum RPC URL
 * @param {string} config.contractAddress - Verifying contract address
 * @param {string} [config.relayerUrl] - Relayer URL (optional)
 * @returns {Promise<object>} fhEVM instance
 */
export async function initializeFhEVM(config) {
  // Already initialized - return existing instance
  if (fhevmInstance) {
    console.log("[FhEVM] Already initialized, reusing existing instance");
    return fhevmInstance;
  }

  // Currently initializing - wait for completion
  if (isInitializing && initializationPromise) {
    console.log("[FhEVM] Initialization in progress, waiting...");
    return initializationPromise;
  }

  // Start initialization
  isInitializing = true;
  console.log("[FhEVM] Starting initialization...");

  initializationPromise = (async () => {
    try {
      // Validate required config
      if (!config?.rpcUrl) {
        throw new Error("rpcUrl is required for FhEVM initialization");
      }
      if (!config?.contractAddress) {
        throw new Error("contractAddress is required for FhEVM initialization");
      }

      const relayerUrl = getRelayerUrl(config);
      
      console.log("[FhEVM] Configuration:");
      console.log("  - networkUrl:", config.rpcUrl);
      console.log("  - contractAddress:", config.contractAddress);
      console.log("  - relayerUrl:", relayerUrl);

      // Create fhEVM instance using Zama SDK
      console.log("[FhEVM] Creating instance...");
      
      fhevmInstance = await createInstance({
        networkUrl: config.rpcUrl,
        gatewayUrl: relayerUrl,
      });

      console.log("[FhEVM] Instance created successfully");
      isInitializing = false;
      
      return fhevmInstance;
      
    } catch (error) {
      console.error("[FhEVM] Initialization failed:", error.message);
      isInitializing = false;
      initializationPromise = null;
      fhevmInstance = null;
      throw error;
    }
  })();

  return initializationPromise;
}

/**
 * Encrypt bid amount using FhEVM
 * @param {number} amount - Bid amount to encrypt
 * @returns {Promise<Uint8Array>} Encrypted bid data
 */
export async function encryptBidAmount(amount) {
  if (!fhevmInstance) {
    throw new Error("FhEVM not initialized. Call initializeFhEVM() first.");
  }

  try {
    console.log("[FhEVM] Encrypting bid amount:", amount);
    
    // Create encrypted input using fhEVM instance
    const encryptedInput = fhevmInstance.createEncryptedInput();
    
    // Add the bid amount as encrypted uint64
    encryptedInput.add64(BigInt(amount));
    
    // Encrypt and return the result
    const encrypted = encryptedInput.encrypt();
    
    console.log("[FhEVM] Encryption successful");
    return encrypted;
    
  } catch (error) {
    console.error("[FhEVM] Encryption failed:", error.message);
    throw new Error(`Failed to encrypt bid: ${error.message}`);
  }
}

/**
 * Reset fhEVM instance (for testing or reconnection)
 * Use with caution - will require re-initialization
 */
export function resetFhEVM() {
  console.log("[FhEVM] Resetting instance...");
  fhevmInstance = null;
  isInitializing = false;
  initializationPromise = null;
  console.log("[FhEVM] Instance reset complete");
}

/**
 * Get fhEVM status information
 * @returns {object} Status object with initialization state
 */
export function getFhEVMStatus() {
  return {
    initialized: fhevmInstance !== null,
    initializing: isInitializing,
    instance: fhevmInstance ? "active" : "null",
  };
}
