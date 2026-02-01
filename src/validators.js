/**
 * Validators Module
 * Contains validation functions for application inputs
 * Ensures input data is valid before processing
 * 
 * FIX: validateEnvVariables() ALWAYS returns {isValid: boolean, errors: array}
 */

/**
 * Configuration limits for bid amounts
 * Can be adjusted per business requirements
 */
export const BID_LIMITS = {
  MIN_AMOUNT: 1,              // Minimum bid amount
  MAX_AMOUNT: 1000000000,     // Maximum bid amount (1 billion)
  MAX_DECIMALS: 18,           // Maximum decimal places
  MIN: 1,                     // Alias for MIN_AMOUNT
  MAX: 1000000000,            // Alias for MAX_AMOUNT
};

/**
 * Default values for optional environment variables
 */
const ENV_DEFAULTS = {
  CONTRACT_ADDRESS: "0xe9c1349c959f98f3d6e1c25b1bc3a4376921423d",
  RELAYER_URL: "https://relayer.testnet.zama.org",
};

/**
 * Validation result
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether the input is valid
 * @property {boolean} valid - Alias for isValid
 * @property {string|null} error - Error message if invalid
 * @property {number|null} value - Normalized value if valid
 */

/**
 * Environment validation result
 * @typedef {Object} EnvValidationResult
 * @property {boolean} isValid - Whether environment is valid
 * @property {boolean} valid - Alias for isValid
 * @property {string[]} errors - Array of errors (always an array, may be empty)
 */

/**
 * Validate bid amount
 * Checks: not null, is number, not NaN, positive, within range
 * @param {any} amount - Value to validate
 * @returns {ValidationResult} Validation result
 */
export function validateBidAmount(amount) {
  // Check null/undefined
  if (amount === null || amount === undefined || amount === "") {
    return {
      isValid: false,
      valid: false,
      error: "Bid amount is required",
      value: null,
    };
  }

  // Convert to number
  const numAmount = Number(amount);

  // Check if valid number
  if (isNaN(numAmount)) {
    return {
      isValid: false,
      valid: false,
      error: "Bid amount must be a number",
      value: null,
    };
  }

  // Check positive
  if (numAmount <= 0) {
    return {
      isValid: false,
      valid: false,
      error: "Bid amount must be positive",
      value: null,
    };
  }

  // Check minimum
  if (numAmount < BID_LIMITS.MIN_AMOUNT) {
    return {
      isValid: false,
      valid: false,
      error: `Bid amount must be at least ${BID_LIMITS.MIN_AMOUNT}`,
      value: null,
    };
  }

  // Check maximum
  if (numAmount > BID_LIMITS.MAX_AMOUNT) {
    return {
      isValid: false,
      valid: false,
      error: `Bid amount must not exceed ${BID_LIMITS.MAX_AMOUNT}`,
      value: null,
    };
  }

  // Check decimals
  const decimalPart = String(numAmount).split(".")[1];
  if (decimalPart && decimalPart.length > BID_LIMITS.MAX_DECIMALS) {
    return {
      isValid: false,
      valid: false,
      error: `Maximum ${BID_LIMITS.MAX_DECIMALS} decimal places allowed`,
      value: null,
    };
  }

  return {
    isValid: true,
    valid: true,
    error: null,
    value: numAmount,
  };
}

/**
 * Validate environment variables
 * Checks required variables are set
 * Optional variables use defaults if not set
 * @returns {EnvValidationResult} Validation result with errors array
 */
export function validateEnvVariables() {
  const errors = [];

  // Required: TELEGRAM_BOT_TOKEN
  if (!process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN.trim() === "") {
    errors.push("TELEGRAM_BOT_TOKEN is required");
  }

  // Required: PRIVATE_KEY
  if (!process.env.PRIVATE_KEY || process.env.PRIVATE_KEY.trim() === "") {
    errors.push("PRIVATE_KEY is required");
  }

  // Optional: RPC_URL (has default in main code)
  // Optional: CONTRACT_ADDRESS (has default)
  // Optional: RELAYER_URL (has default)

  // Validate PRIVATE_KEY format if present
  if (process.env.PRIVATE_KEY) {
    const pk = process.env.PRIVATE_KEY.trim();
    // Private key should be 64 hex chars (with or without 0x prefix)
    const hexPattern = /^(0x)?[a-fA-F0-9]{64}$/;
    if (!hexPattern.test(pk)) {
      errors.push("PRIVATE_KEY must be a valid 64-character hex string");
    }
  }

  return {
    isValid: errors.length === 0,
    valid: errors.length === 0,
    errors: errors,
  };
}

/**
 * Get environment variable with default fallback
 * @param {string} name - Variable name
 * @param {string} defaultValue - Default value if not set
 * @returns {string} Variable value or default
 */
export function getEnvWithDefault(name, defaultValue) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    return defaultValue;
  }
  return value.trim();
}

/**
 * Validate Ethereum address format
 * @param {string} address - Address to validate
 * @returns {boolean} True if valid Ethereum address
 */
export function isValidEthereumAddress(address) {
  if (!address || typeof address !== "string") {
    return false;
  }
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 */
export function isValidUrl(url) {
  if (!url || typeof url !== "string") {
    return false;
  }
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
