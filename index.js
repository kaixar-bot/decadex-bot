require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// Lấy chìa khóa
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
    console.log("❌ LỖI: Cậu chưa nhập Token vào mục Secrets (ổ khóa)!");
    process.exit(1);
}

// Khởi động bot
const bot = new TelegramBot(token, {polling: true});

console.log("✅ Bot VeilBid đang chạy... (Kim Long ơi, vào test đi!)");

// Khi ai đó gõ /start
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, `👋 Chào <b>${msg.from.first_name}</b>!\nBot VeilBid đã online!`, {parse_mode: 'HTML'});
});