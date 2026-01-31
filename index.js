import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { ethers } from "ethers";
import { createInstance } from "@zama-fhe/relayer-sdk/node";
import { readFileSync } from "fs";
console.log("=== BOT STARTING ===");
const token = process.env.TELEGRAM_BOT_TOKEN;
const privateKey = process.env.PRIVATE_KEY;
if (!token || !privateKey) { console.log("ERROR: Missing env vars"); process.exit(1); }
const abi = JSON.parse(readFileSync("./abi.json", "utf-8"));
const bot = new TelegramBot(token, { polling: true });
const rpcUrl = "https://eth-sepolia.g.alchemy.com/v2/03ULioJcOGJ-4NJf9sfXt1rMJaadH9rH";
const provider = new ethers.JsonRpcProvider(rpcUrl);
const contractAddress = ethers.getAddress("0xe9c1349c959f98f3d6e1c25b1bc3a4376921423d");
const contract = new ethers.Contract(contractAddress, abi, new ethers.Wallet(privateKey, provider));
const userSessions = {};
console.log("DECADEX BOT ONLINE!");
bot.onText(/\/start/, (msg) => { bot.sendMessage(msg.chat.id, "Bot Ready! /connect_wallet then /bid [amount]"); });
bot.onText(/\/connect_wallet/, async (msg) => { const w = ethers.Wallet.createRandom(); userSessions[msg.chat.id] = w; bot.sendMessage(msg.chat.id, "Wallet: " + w.address); });
bot.onText(/\/bid (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const amount = parseInt(match[1]);
  if (!userSessions[chatId]) return bot.sendMessage(chatId, "Run /connect_wallet first");
  const userWallet = userSessions[chatId];
  const userAddress = ethers.getAddress(userWallet.address);
  try {
    const instance = await createInstance({
      aclContractAddress: "0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D",
      kmsContractAddress: "0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A",
      inputVerifierContractAddress: "0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0",
      verifyingContractAddressDecryption: "0x5D8BD78e2ea6bbE41f26dFe9fdaEAa349e077478",
      verifyingContractAddressInputVerification: "0x483b9dE06E4E4C7D35CCf5837A1668487406D955",
      chainId: 11155111,
      gatewayChainId: 10901,
      network: rpcUrl,
      relayerUrl: "https://relayer.testnet.zama.org"
    });
    const input = instance.createEncryptedInput(contractAddress, userAddress);
    input.add64(BigInt(amount));
    const encrypted = await input.encrypt();
    const handleBytes32 = ethers.hexlify(encrypted.handles[0]);
    const proofBytes = ethers.hexlify(encrypted.inputProof);
    bot.sendMessage(chatId, "Encrypted OK! Sending tx...");
    const conn = userWallet.connect(provider);
    const tx = await contract.connect(conn).bid(handleBytes32, proofBytes, { gasLimit: 500000 });
    bot.sendMessage(chatId, "Success! TX: " + tx.hash);
  } catch (e) {
    const msg = e.message || "";
    bot.sendMessage(chatId, msg.includes("insufficient") ? "Need ETH! Get at sepoliafaucet.com" : "Error: " + msg.substring(0,120));
  }
});
console.log("Bot listening...");
