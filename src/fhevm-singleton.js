import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

/**
 * FhEVM Singleton Module
 * Manages a single fhEVM instance for the entire application
 * Uses Singleton pattern to avoid creating new instances for each bid
 * 
 * FIX: Import from @zama-fhe/relayer-sdk/node (with /node suffix)
 * FIX: Use SepoliaConfig or full contract addresses for SDK 0.4.x
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
 * Zama Sepolia testnet contract addresses (SDK 0.4.x)
 * See: https://docs.zama.org/protocol/relayer-sdk-guides/fhevm-relayer/initialization
 */
const SEPOLIA_CONTRACTS = {
  // ACL_CONTRACT_ADDRESS (FHEVM Host chain)
  aclContractAddress: '0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D',
  // KMS_VERIFIER_CONTRACT_ADDRESS (FHEVM Host chain)
  kmsContractAddress: '0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A',
  // INPUT_VERIFIER_CONTRACT_ADDRESS (FHEVM Host chain)
  inputVerifierContractAddress: '0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0',
  // DECRYPTION_ADDRESS (Gateway chain)
  verifyingContractAddressDecryption: '0x5D8BD78e2ea6bbE41f26dFe9fdaEAa349e077478',
  // INPUT_VERIFICATION_ADDRESS (Gateway chain)
  verifyingContractAddressInputVerification: '0x483b9dE06E4E4C7D35CCf5837A1668487406D955',
  // FHEVM Host chain id (Sepolia)
  chainId: 11155111,
  // Gateway chain id
  gatewayChainId: 10901,
};

/**
 * Get relayerUrl from config or environment or default
 */
function getRelayerUrl(config) {
  return config?.relayerUrl || process.env.RELAYER_URL || DEFAULT_RELAYER_URL;
}

/**
 * Get network RPC URL from config or environment
 */
function getNetworkUrl(config) {
  return config?.rpcUrl || process.env.RPC_URL || 'https://eth-sepolia.public.blastapi.io';
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
 * Initialize fhEVM singleton using SDK 0.4.x API
 * If already initialized, returns existing instance
 * If initializing, waits for completion
 * 
 * SDK 0.4.x requires specific contract addresses instead of just networkUrl/gatewayUrl
 * 
 * @param {object} config - Configuration object
 * @param {string} config.rpcUrl - Ethereum RPC URL (optional, defaults to Sepolia)
 * @param {string} config.relayerUrl - Relayer URL (optional, defaults to Zama testnet)
 * @param {boolean} config.useSepoliaConfig - Use built-in SepoliaConfig (recommended)
 * @returns {Promise<object>} fhEVM instance
 */
export async function initializeFhEVM(config = {}) {
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
  console.log("[FhEVM] Starting initialization with SDK 0.4.x...");

  initializationPromise = (async () => {
    try {
      const relayerUrl = getRelayerUrl(config);
      const networkUrl = getNetworkUrl(config);
      
      console.log("[FhEVM] Configuration:");
      console.log("  - relayerUrl:", relayerUrl);
      console.log("  - networkUrl:", networkUrl);
      console.log("  - chainId:", SEPOLIA_CONTRACTS.chainId);
      console.log("  - gatewayChainId:", SEPOLIA_CONTRACTS.gatewayChainId);

      // Method 1: Use built-in SepoliaConfig (simplest)
      // Method 2: Use full contract addresses with custom relayer/network
      
      // We use Method 2 to allow custom relayerUrl and networkUrl from env
      const instanceConfig = {
        ...SEPOLIA_CONTRACTS,
        network: networkUrl,
        relayerUrl: relayerUrl,
      };

      console.log("[FhEVM] Creating instance with full config...");
      
      fhevmInstance = await createInstance(instanceConfig);

      console.log("[FhEVM] Instance created successfully");
      isInitializing = false;
      
      return fhevmInstance;
      
    } catch (error) {
      console.error("[FhEVM] Initialization failed:", error.message);
      console.error("[FhEVM] Stack:", error.stack);
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
 * @param {number} amount - Bid amount in wei
 * @param {string} contractAddress - Target contract address
 * @param {string} userAddress - User's wallet address
 * @returns {Promise<Uint8Array>} Encrypted bid data
 */
export async function encryptBidAmount(amount, contractAddress, userAddress) {
  const instance = getFhEVMInstance();
  
  console.log("[FhEVM] Encrypting bid amount:", amount);
  console.log("[FhEVM] Contract:", contractAddress);
  console.log("[FhEVM] User:", userAddress);
  
  try {
    // Create input for encryption
    const input = instance.createEncryptedInput(contractAddress, userAddress);
    
    // Add amount as encrypted uint256
    input.add256(BigInt(amount));
    
    // Encrypt and get proof
    const encryptedInput = await input.encrypt();
    
    console.log("[FhEVM] Encryption successful");
    
    return encryptedInput;
  } catch (error) {
    console.error("[FhEVM] Encryption failed:", error.message);
    throw error;
  }
}

/**
 * Reset fhEVM instance (for testing or re-initialization)
 * Use with caution - only when you need to reinitialize with different config
 */
export function resetFhEVM() {
  console.log("[FhEVM] Resetting instance...");
  fhevmInstance = null;
  isInitializing = false;
  initializationPromise = null;
}

/**
 * Get fhEVM status for debugging
 * @returns {object} Status object
 */
export function getFhEVMStatus() {
  return {
    initialized: isInitialized(),
    initializing: isInitializing,
    hasInstance: fhevmInstance !== null,
    defaultRelayerUrl: DEFAULT_RELAYER_URL,
    sepoliaChainId: SEPOLIA_CONTRACTS.chainId,
    gatewayChainId: SEPOLIA_CONTRACTS.gatewayChainId,
  };
}
