/**
 * DecaDex Contract ABI
 * Contract: 0xe9c1349c959f98f3d6e1c25b1bc3a4376921423d (Sepolia)
 * 
 * This is a FHE (Fully Homomorphic Encryption) auction contract.
 * The bid function accepts encrypted values via Zama's fhEVM.
 */

export const DECADEX_ABI = [
  // === WRITE FUNCTIONS ===
  
  // Submit encrypted bid
  {
    "inputs": [
      {"internalType": "bytes32", "name": "encryptedValue", "type": "bytes32"},
      {"internalType": "bytes", "name": "inputProof", "type": "bytes"}
    ],
    "name": "bid",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  
  // End the auction and transfer funds to beneficiary
  {
    "inputs": [],
    "name": "auctionEnd",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  
  // === READ FUNCTIONS ===
  
  // Check if auction has ended
  {
    "inputs": [],
    "name": "ended",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  
  // Get beneficiary address
  {
    "inputs": [],
    "name": "beneficiary",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  
  // Get auction end time
  {
    "inputs": [],
    "name": "auctionEndTime",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  
  // Get highest bidder address
  {
    "inputs": [],
    "name": "highestBidder",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  
  // Get highest bid amount (may be encrypted)
  {
    "inputs": [],
    "name": "highestBid",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

// Default export for convenience
export default DECADEX_ABI;
