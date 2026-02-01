/**
 * Validators Module
 * Chá»©a cÃ¡c hÃ m validation cho input cá»§a á»©ng dá»¥ng
 * Äáº£m báº£o dá»¯ liá»u Äáº§u vÃ o há»£p lá» trÆ°á»c khi xá»­ lÃ½
 * 
 * FIX: validateEnvVariables() LUÃN return {isValid: boolean, errors: array}
 */

/**
 * Cáº¥u hÃ¬nh giá»i háº¡n cho bid amount
 * CÃ³ thá» Äiá»u chá»nh theo yÃªu cáº§u business
 */
export const BID_LIMITS = {
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
 * Káº¿t quáº£ validation env
 * @typedef {Object} EnvValidationResult
 * @property {boolean} isValid - CÃ³ há»£p lá» hay khÃ´ng
 * @property {string[]} errors - Máº£ng cÃ¡c lá»i (luÃ´n lÃ  array, cÃ³ thá» rá»ng)
 */

/**
 * Validate sá» tiá»n bid
 * Kiá»m tra: khÃ´ng null, lÃ  sá», khÃ´ng NaN, dÆ°Æ¡ng, trong range
 * @param {any} amount - GiÃ¡ trá» cáº§n validate
 * @returns {ValidationResult} Káº¿t quáº£ validation
 */
export function validateBidAmount(amount) {
  // Check null/undefined
  if (amount === null || amount === undefined || amount === "") {
    return {
      isValid: false,
      error: "Bid amount is required. Usage: /bid <amount>",
      value: null
    };
  }
  
  // Convert to number
  const numAmount = Number(amount);
  
  // Check NaN
  if (isNaN(numAmount)) {
    return {
      isValid: false,
      error: `Invalid amount: "${amount}" is not a valid number`,
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
      error: `Bid amount cannot exceed ${BID_LIMITS.MAX_AMOUNT.toLocaleString()}`,
      value: null
    };
  }
  
  // Check integer (no decimals for simplicity)
  if (!Number.isInteger(numAmount)) {
    return {
      isValid: false,
      error: "Bid amount must be a whole number (no decimals)",
      value: null
    };
  }
  
  // Valid!
  return {
    isValid: true,
    error: null,
    value: numAmount
  };
}

/**
 * Validate environment variables
 * Required: TELEGRAM_BOT_TOKEN, PRIVATE_KEY, RPC_URL
 * Optional: CONTRACT_ADDRESS, RELAYER_URL (cÃ³ defaults)
 * 
 * FIX QUAN TRá»NG: HÃ m nÃ y LUÃN return object vá»i errors lÃ  array
 * 
 * @returns {EnvValidationResult} Káº¿t quáº£ validation
 */
export function validateEnvVariables() {
  // Khá»i táº¡o errors lÃ  array rá»ng - QUAN TRá»NG!
  const errors = [];
  
  // === REQUIRED VARIABLES ===
  
  // 1. TELEGRAM_BOT_TOKEN - báº¯t buá»c
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    errors.push("TELEGRAM_BOT_TOKEN is required - Get from @BotFather on Telegram");
  }
  
  // 2. PRIVATE_KEY - báº¯t buá»c
  if (!process.env.PRIVATE_KEY) {
    errors.push("PRIVATE_KEY is required - Ethereum wallet private key");
  } else {
    // Validate format
    const pk = process.env.PRIVATE_KEY;
    // Remove 0x prefix if present
    const cleanPk = pk.startsWith("0x") ? pk.slice(2) : pk;
    if (!/^[a-fA-F0-9]{64}$/.test(cleanPk)) {
      errors.push("PRIVATE_KEY format invalid - Must be 64 hex characters");
    }
  }
  
  // 3. RPC_URL - báº¯t buá»c
  if (!process.env.RPC_URL) {
    errors.push("RPC_URL is required - Ethereum RPC endpoint (e.g., Alchemy Sepolia URL)");
  } else {
    // Basic URL validation
    try {
      new URL(process.env.RPC_URL);
    } catch {
      errors.push("RPC_URL format invalid - Must be a valid URL");
    }
  }
  
  // === OPTIONAL VARIABLES (cÃ³ defaults) ===
  // CONTRACT_ADDRESS - cÃ³ default
  // RELAYER_URL - cÃ³ default
  // ALCHEMY_API_KEY - KHÃNG Cáº¦N náº¿u ÄÃ£ cÃ³ RPC_URL
  
  // Log optional vars status
  if (process.env.CONTRACT_ADDRESS) {
    console.log("[ENV] CONTRACT_ADDRESS: Custom value provided");
  } else {
    console.log(`[ENV] CONTRACT_ADDRESS: Using default (${ENV_DEFAULTS.CONTRACT_ADDRESS})`);
  }
  
  if (process.env.RELAYER_URL) {
    console.log("[ENV] RELAYER_URL: Custom value provided");
  } else {
    console.log(`[ENV] RELAYER_URL: Using default (${ENV_DEFAULTS.RELAYER_URL})`);
  }
  
  // Return result - errors LUÃN lÃ  array
  return {
    isValid: errors.length === 0,
    errors: errors  // LuÃ´n lÃ  array, cÃ³ thá» rá»ng
  };
}

/**
 * Validate Ethereum address
 * @param {string} address - Äá»a chá» cáº§n validate
 * @returns {ValidationResult} Káº¿t quáº£ validation
 */
export function validateAddress(address) {
  if (!address) {
    return {
      isValid: false,
      error: "Address is required",
      value: null
    };
  }
  
  // Check format
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
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

// Export defaults cho cÃ¡c module khÃ¡c dÃ¹ng
export { ENV_DEFAULTS };
