import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { ethers } from "ethers";
import { createInstance } from "@zama-fhe/relayer-sdk/node";
import { readFileSync } from "fs";

console.log("=== BOT STARTING ===");

// Load environment variables
const token = process.env.TELEGRAM_BOT_TOKEN;
const privateKey = process.env.PRIVATE_KEY;
const alchemyApiKey = process.env.ALCHEMY_API_KEY;
const contractAddress = process.env.CONTRACT_ADDRESS;

// Validate required environment variables
if (!token || !privateKey || !alchemyApiKey || !contractAddress) {
  console.log("ERROR: Missing required env vars. Please check your .env file.");
  console.log("Required: TELEGRAM_BOT_TOKEN, PRIVATE_KEY, ALCHEMY_API_KEY, CONTRACT_ADDRESS");
  process.exit(1);
}

// Initialize ABI and Telegram bot
const abi = JSON.parse(readFileSync("./abi.json", "utf-8"));
const bot = new TelegramBot(token, { polling: true });

// Initialize Ethereum provider using environment variable
const rpcUrl = `https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`;
const provider = new ethers.JsonRpcProvider(rpcUrl);

// Initialize contract with validated address
const validatedContractAddress = ethers.getAddress(contractAddress);
const contract = new ethers.Contract(
  validatedContractAddress,
  abi,
  new ethers.Wallet(privateKey, provider)
);

const userSessions = {};
console.log("DECADEX BOT ONLINE!");

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Bot Ready! /connect_wallet then /bid [amount]");
});

bot.onText(/\/connect_wallet/, async (msg) => {
  const w = ethers.Wallet.createRandom();
  userSessions[msg.chat.id] = w;
  bot.sendMessage(msg.chat.id, "Wallet: " + w.address);
});

bot.onText(/\/bid (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const amount = parseInt(match[1]);
  if (!userSessions[chatId]) return bot.sendMessage(chatId, "Run /connect_wallet first");
  const wallet = userSessions[chatId];
  try {
    bot.sendMessage(chatId, "Preparing confidential bid...");
    const fheInstance = await createInstance({ networkUrl: rpcUrl });
    const encrypted = await fheInstance.encrypt32(amount);
    const proof = await fheInstance.generateInputProof(encrypted, validatedContractAddress);
    bot.sendMessage(chatId, "Submitting encrypted bid to blockchain...");
    const tx = await contract.bid(encrypted.handles[0], proof);
    const receipt = await tx.wait();
    bot.sendMessage(chatId, "Bid SUCCESS! TX: " + receipt.hash);
  } catch (err) {
    console.log("Bid error:", err);
    bot.sendMessage(chatId, "Bid failed: " + err.message);
  }
});

bot.on("polling_error", (error) => {
  console.log("Polling error:", error.code);
});
