import TelegramBot from "node-telegram-bot-api";

const botToken = process.env.TELEGRAM_BOT_TOKEN || '7827339694:AAGjC7mD2PzdZFWCREyqhz4mGYnPxpNjbhI';
export const bot = new TelegramBot(botToken , { polling : true }) 