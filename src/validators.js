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
  // Kiá»m tra null/undefined
  if (amount === null || amount === undefined) {
    return {
      isValid: false,
      error: "Sá» tiá»n bid khÃ´ng ÄÆ°á»£c Äá» trá»ng",
      value: null,
    };
  }

  // Chuyá»n Äá»i sang sá» náº¿u lÃ  string
  const numericAmount = typeof amount === "string" ? parseFloat(amount) : amount;

  // Kiá»m tra cÃ³ pháº£i lÃ  sá» há»£p lá»
  if (typeof numericAmount !== "number") {
    return {
      isValid: false,
      error: "Sá» tiá»n bid pháº£i lÃ  má»t con sá»",
      value: null,
    };
  }

  // Kiá»m tra NaN
  if (Number.isNaN(numericAmount)) {
    return {
      isValid: false,
      error: "Sá» tiá»n bid khÃ´ng há»£p lá» (NaN)",
      value: null,
    };
  }

  // Kiá»m tra Infinity
  if (!Number.isFinite(numericAmount)) {
    return {
      isValid: false,
      error: "Sá» tiá»n bid khÃ´ng há»£p lá» (Infinity)",
      value: null,
    };
  }

  // Kiá»m tra sá» dÆ°Æ¡ng
  if (numericAmount <= 0) {
    return {
      isValid: false,
      error: `Sá» tiá»n bid pháº£i lÃ  sá» dÆ°Æ¡ng (nháº­n ÄÆ°á»£c: ${numericAmount})`,
      value: null,
    };
  }

  // Kiá»m tra giá»i háº¡n tá»i thiá»u
  if (numericAmount < BID_LIMITS.MIN_AMOUNT) {
    return {
      isValid: false,
      error: `Sá» tiá»n bid tá»i thiá»u lÃ  ${BID_LIMITS.MIN_AMOUNT} (nháº­n ÄÆ°á»£c: ${numericAmount})`,
      value: null,
    };
  }

  // Kiá»m tra giá»i háº¡n tá»i Äa
  if (numericAmount > BID_LIMITS.MAX_AMOUNT) {
    return {
      isValid: false,
      error: `Sá» tiá»n bid tá»i Äa lÃ  ${BID_LIMITS.MAX_AMOUNT} (nháº­n ÄÆ°á»£c: ${numericAmount})`,
      value: null,
    };
  }

  // Kiá»m tra sá» nguyÃªn (cho cÃ¡c smart contract yÃªu cáº§u uint)
  if (!Number.isInteger(numericAmount)) {
    // LÃ m trÃ²n xuá»ng vÃ  cáº£nh bÃ¡o
    const roundedAmount = Math.floor(numericAmount);
    console.warn(`[Validator] Sá» tiá»n ÄÃ£ ÄÆ°á»£c lÃ m trÃ²n tá»« ${numericAmount} xuá»ng ${roundedAmount}`);
    return {
      isValid: true,
      error: null,
      value: roundedAmount,
    };
  }

  // Táº¥t cáº£ Äiá»u kiá»n Äá»u thá»a mÃ£n
  return {
    isValid: true,
    error: null,
    value: numericAmount,
  };
}

/**
 * Validate Äá»a chá» Ethereum
 * Kiá»m tra format cÆ¡ báº£n cá»§a Äá»a chá» ETH
 * @param {string} address - Äá»a chá» cáº§n validate
 * @returns {ValidationResult} Káº¿t quáº£ validation
 */
function validateEthereumAddress(address) {
  if (!address || typeof address !== "string") {
    return {
      isValid: false,
      error: "Äá»a chá» vÃ­ khÃ´ng há»£p lá»",
      value: null,
    };
  }

  // Kiá»m tra format Äá»a chá» ETH (0x + 40 hex chars)
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  if (!ethAddressRegex.test(address)) {
    return {
      isValid: false,
      error: "Äá»a chá» vÃ­ pháº£i cÃ³ format 0x... (42 kÃ½ tá»±)",
      value: null,
    };
  }

  return {
    isValid: true,
    error: null,
    value: address.toLowerCase(), // Chuáº©n hÃ³a vá» lowercase
  };
}

/**
 * Validate environment variables
 * Kiá»m tra cÃ¡c biáº¿n mÃ´i trÆ°á»ng báº¯t buá»c
 * @param {Object} env - Object chá»©a environment variables
 * @param {string[]} requiredVars - Danh sÃ¡ch tÃªn biáº¿n báº¯t buá»c
 * @returns {ValidationResult} Káº¿t quáº£ validation
 */
function validateEnvVariables(env, requiredVars) {
  const missingVars = [];

  for (const varName of requiredVars) {
    if (!env[varName] || env[varName].trim() === "") {
      missingVars.push(varName);
    }
  }

  if (missingVars.length > 0) {
    return {
      isValid: false,
      error: `Thiáº¿u cÃ¡c biáº¿n mÃ´i trÆ°á»ng: ${missingVars.join(", ")}`,
      value: null,
    };
  }

  return {
    isValid: true,
    error: null,
    value: env,
  };
}

export {
  BID_LIMITS,
  validateBidAmount,
  validateEthereumAddress,
  validateEnvVariables,
};
