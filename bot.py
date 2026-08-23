import telebot
from telebot.types import ReplyKeyboardMarkup, KeyboardButton, WebAppInfo
import os
from dotenv import load_dotenv

load_dotenv()
BOT_TOKEN = os.getenv('TOKEN') # Проверьте, что в .env есть токен!
bot = telebot.TeleBot(BOT_TOKEN)


@bot.message_handler(commands=['start'])
def start_message(message):
    user = message.from_user.id #получаем id  чела
    username = message.from_user.username or "Аноним" # и имя
    bot.send_message(message.chat.id , text=f"📌 Приветствую, {username}")



if __name__ == "__main__":
    print("БОТ ЗАПУЩЕН")
    bot.infinity_polling(timeout=30 , long_polling_timeout=20) #ТАЙМЫ И INFINITY
