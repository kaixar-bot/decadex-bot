import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";
import { ethers } from "ethers";

/**
 * FhEVM Singleton Module
 * Manages a single fhEVM instance for the entire application
 * Uses Singleton pattern to avoid creating new instances for each bid
 *
 * FIX: Import from @zama-fhe/relayer-sdk/node (with /node suffix)
 * FIX: Use SepoliaConfig or full contract addresses for SDK 0.4.x
 * FIX: Use ethers.getAddress() to checksum contract addresses
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
  return config?.networkUrl || process.env.RPC_URL || 'https://sepolia.public-rpc.blastapi.io';
}

/**
 * Check if fhEVM has been initialized
 * @returns {boolean} true if initialized
 */
export function isInitialized() {
  return fhevmInstance !== null;
}

/**
 * Get the singleton fhEVM instance
 * @returns {object} fhEVM instance
 * @throws {Error} if not initialized
 */
export function getFhEVMInstance() {
  if (!fhevmInstance) {
    throw new Error("FhEVM not initialized. Call initializeFhEVM() first.");
  }
  return fhevmInstance;
}

/**
 * Initialize fhEVM singleton instance
 * Thread-safe - prevents multiple simultaneous initializations
 * 
 * @param {object} config - Configuration options
 * @param {string} config.networkUrl - RPC URL for the network
 * @param {string} config.relayerUrl - Relayer URL for Zama
 * @param {string} config.contractAddress - Contract address (for logging)
 * @returns {Promise<object>} fhEVM instance
 */
export async function initializeFhEVM(config = {}) {
  // If already initialized, return existing instance
  if (fhevmInstance) {
    console.log("[FhEVM] Already initialized, reusing instance");
    return fhevmInstance;
  }

  // If initialization is in progress, wait for it
  if (isInitializing && initializationPromise) {
    console.log("[FhEVM] Initialization in progress, waiting...");
    return initializationPromise;
  }

  // Start initialization
  isInitializing = true;
  
  initializationPromise = (async () => {
    try {
      const relayerUrl = getRelayerUrl(config);
      const networkUrl = getNetworkUrl(config);

      console.log("[FhEVM] Initializing with relayer:", relayerUrl);
      console.log("[FhEVM] Network URL:", networkUrl);
      console.log("[FhEVM] Chain ID:", SEPOLIA_CONTRACTS.chainId);
      console.log("[FhEVM] Gateway Chain ID:", SEPOLIA_CONTRACTS.gatewayChainId);

      // Method 1: Use built-in SepoliaConfig (simplest)
      // Method 2: Full manual config (if needed)
      
      // Using SepoliaConfig with relayerUrl override
      fhevmInstance = await createInstance({
        ...SepoliaConfig,
        relayerUrl: relayerUrl,
      });

      console.log("[FhEVM] Instance created successfully");
      return fhevmInstance;
    } catch (error) {
      console.error("[FhEVM] Initialization failed:", error.message);
      fhevmInstance = null;
      isInitializing = false;
      initializationPromise = null;
      throw error;
    } finally {
      isInitializing = false;
    }
  })();

  return initializationPromise;
}

/**
 * Checksum an Ethereum address using ethers.getAddress()
 * Throws if address is invalid
 * 
 * @param {string} address - Address to checksum
 * @param {string} label - Label for error messages
 * @returns {string} Checksummed address
 */
function checksumAddress(address, label = "Address") {
  if (!address || typeof address !== 'string') {
    throw new Error(`${label} is required and must be a string`);
  }
  
  try {
    return ethers.getAddress(address);
  } catch (error) {
    throw new Error(`${label} is not a valid Ethereum address: ${address}`);
  }
}

/**
 * Encrypt a bid amount using FHE
 * 
 * FIX: Use ethers.getAddress() to checksum addresses before passing to SDK
 * The fhEVM SDK requires properly checksummed addresses
 * 
 * @param {number|string|bigint} amount - Bid amount to encrypt
 * @param {string} contractAddress - Smart contract address
 * @param {string} userAddress - User's wallet address
 * @returns {Promise<object>} Encrypted input with proof
 */
export async function encryptBidAmount(amount, contractAddress, userAddress) {
  const instance = getFhEVMInstance();

  console.log("[FhEVM] Encrypting bid amount:", amount);
  console.log("[FhEVM] Contract (raw):", contractAddress);
  console.log("[FhEVM] User (raw):", userAddress);

  try {
    // FIX: Checksum addresses using ethers.getAddress()
    // fhEVM SDK requires properly checksummed addresses
    const checksummedContract = checksumAddress(contractAddress, "Contract address");
    const checksummedUser = checksumAddress(userAddress, "User address");

    console.log("[FhEVM] Contract (checksummed):", checksummedContract);
    console.log("[FhEVM] User (checksummed):", checksummedUser);

    // Create input for encryption with checksummed addresses
    const input = instance.createEncryptedInput(checksummedContract, checksummedUser);

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
