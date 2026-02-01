/**
 * Validators Module
 * Chá»©a cÃ¡c hÃ m validation cho input cá»§a á»©ng dá»¥ng
 * Äáº£m báº£o dá»¯ liá»u Äáº§u vÃ o há»£p lá» trÆ°á»c khi xá»­ lÃ½
 */

/**
 * Cáº¥u hÃ¬nh giá»i háº¡n cho bid amount
 * CÃ³ thá» Äiá»u chá»nh theo yÃªu cáº§u business
 */
const BID_LIMITS = {
  MIN_AMOUNT: 1,              // Sá» tiá»n bid tá»i thiá»u
  MAX_AMOUNT: 1000000000,     // Sá» tiá»n bid tá»i Äa (1 tá»·)
  MAX_DECIMALS: 18,           // Sá» chá»¯ sá» tháº­p phÃ¢n tá»i Äa
};

/**
 * Default values cho cÃ¡c biáº¿n optional
 */
const ENV_DEFAULTS = {
  CONTRACT_ADDRESS: "0xe9c1349c959f98f3d6e1c25b1bc3a4376921423d",
  RELAYER_URL: "https://relayer.testnet.zama.org",
};

/**
 * Káº¿t quáº£ validation
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - CÃ³ há»£p lá» hay khÃ´ng
 * @property {string|null} error - ThÃ´ng bÃ¡o lá»i náº¿u khÃ´ng há»£p lá»
 * @property {number|null} value - GiÃ¡ trá» ÄÃ£ ÄÆ°á»£c chuáº©n hÃ³a náº¿u há»£p lá»
 */

/**
 * Validate sá» tiá»n bid
 * Kiá»m tra: khÃ´ng null, lÃ  sá», khÃ´ng NaN, dÆ°Æ¡ng, trong range
 * @param {any} amount - GiÃ¡ trá» cáº§n validate
 * @returns {ValidationResult} Káº¿t quáº£ validation
 */
function validateBidAmount(amount) {
  // Check null/undefined
  if (amount === null || amount === undefined || amount === "") {
    return {
      isValid: false,
      error: "Bid amount is required",
      value: null
    };
  }
  
  // Convert to number
  const numAmount = Number(amount);
  
  // Check NaN
  if (isNaN(numAmount)) {
    return {
      isValid: false,
      error: "Bid amount must be a valid number",
      value: null
    };
  }
  
  // Check positive
  if (numAmount <= 0) {
    return {
      isValid: false,
      error: "Bid amount must be positive",
      value: null
    };
  }
  
  // Check minimum
  if (numAmount < BID_LIMITS.MIN_AMOUNT) {
    return {
      isValid: false,
      error: `Bid amount must be at least ${BID_LIMITS.MIN_AMOUNT}`,
      value: null
    };
  }
  
  // Check maximum
  if (numAmount > BID_LIMITS.MAX_AMOUNT) {
    return {
      isValid: false,
      error: `Bid amount cannot exceed ${BID_LIMITS.MAX_AMOUNT}`,
      value: null
    };
  }
  
  // Check decimals (prevent floating point issues)
  const strAmount = String(amount);
  if (strAmount.includes('.')) {
    const decimals = strAmount.split('.')[1].length;
    if (decimals > BID_LIMITS.MAX_DECIMALS) {
      return {
        isValid: false,
        error: `Bid amount cannot have more than ${BID_LIMITS.MAX_DECIMALS} decimal places`,
        value: null
      };
    }
  }
  
  return {
    isValid: true,
    error: null,
    value: numAmount
  };
}

/**
 * Validate environment variables
 * 
 * REQUIRED (3 biáº¿n báº¯t buá»c):
 * - TELEGRAM_BOT_TOKEN: Token tá»« BotFather
 * - PRIVATE_KEY: Private key cho transactions
 * - RPC_URL: URL cá»§a RPC node
 * 
 * OPTIONAL (cÃ³ default):
 * - CONTRACT_ADDRESS: Default = 0xe9c1349c959f98f3d6e1c25b1bc3a4376921423d
 * - RELAYER_URL: Default = https://relayer.testnet.zama.org
 * 
 * Note: ALCHEMY_API_KEY khÃ´ng cÃ²n cáº§n thiáº¿t náº¿u ÄÃ£ cÃ³ RPC_URL
 * 
 * @returns {ValidationResult} Káº¿t quáº£ validation
 */
function validateEnvVariables() {
  const missing = [];
  const warnings = [];
  
  // === REQUIRED VARIABLES (3 biáº¿n báº¯t buá»c) ===
  const requiredVars = [
    { name: "TELEGRAM_BOT_TOKEN", description: "Telegram Bot Token (from @BotFather)" },
    { name: "PRIVATE_KEY", description: "Wallet private key for transactions" },
    { name: "RPC_URL", description: "RPC endpoint URL" },
  ];
  
  for (const varInfo of requiredVars) {
    const value = process.env[varInfo.name];
    if (!value || value.trim() === "") {
      missing.push(`  â¢ ${varInfo.name}: ${varInfo.description}`);
    }
  }
  
  // === OPTIONAL VARIABLES (cÃ³ default, chá» log warning náº¿u khÃ´ng set) ===
  if (!process.env.CONTRACT_ADDRESS) {
    warnings.push(`  â¢ CONTRACT_ADDRESS not set, using default: ${ENV_DEFAULTS.CONTRACT_ADDRESS}`);
  }
  
  if (!process.env.RELAYER_URL) {
    warnings.push(`  â¢ RELAYER_URL not set, using default: ${ENV_DEFAULTS.RELAYER_URL}`);
  }
  
  // Log warnings (khÃ´ng pháº£i error)
  if (warnings.length > 0) {
    console.log("[ENV] Optional variables using defaults:");
    warnings.forEach(w => console.log(w));
  }
  
  // Return validation result
  if (missing.length > 0) {
    return {
      isValid: false,
      error: `Missing required environment variables:\n${missing.join("\n")}\n\nPlease set these in Replit Secrets or .env file.`,
      value: null
    };
  }
  
  // Additional validations for format
  const privateKey = process.env.PRIVATE_KEY;
  if (privateKey && !privateKey.match(/^(0x)?[a-fA-F0-9]{64}$/)) {
    return {
      isValid: false,
      error: "PRIVATE_KEY format invalid. Must be 64 hex characters (with or without 0x prefix).",
      value: null
    };
  }
  
  const rpcUrl = process.env.RPC_URL;
  if (rpcUrl && !rpcUrl.startsWith("http://") && !rpcUrl.startsWith("https://")) {
    return {
      isValid: false,
      error: "RPC_URL must start with http:// or https://",
      value: null
    };
  }
  
  // Validate CONTRACT_ADDRESS format if provided
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (contractAddress && !contractAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
    return {
      isValid: false,
      error: "CONTRACT_ADDRESS format invalid. Must be 42 characters starting with 0x.",
      value: null
    };
  }
  
  return {
    isValid: true,
    error: null,
    value: {
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
      PRIVATE_KEY: process.env.PRIVATE_KEY,
      RPC_URL: process.env.RPC_URL,
      CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS || ENV_DEFAULTS.CONTRACT_ADDRESS,
      RELAYER_URL: process.env.RELAYER_URL || ENV_DEFAULTS.RELAYER_URL,
    }
  };
}

/**
 * Validate Ethereum address format
 * @param {string} address - Address cáº§n validate
 * @returns {ValidationResult} Káº¿t quáº£ validation
 */
function validateAddress(address) {
  if (!address || typeof address !== "string") {
    return {
      isValid: false,
      error: "Address is required",
      value: null
    };
  }
  
  if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
    return {
      isValid: false,
      error: "Invalid Ethereum address format",
      value: null
    };
  }
  
  return {
    isValid: true,
    error: null,
    value: address.toLowerCase()
  };
}

// Export cÃ¡c hÃ m vÃ  constants
export {
  validateBidAmount,
  validateEnvVariables,
  validateAddress,
  BID_LIMITS,
  ENV_DEFAULTS
};
