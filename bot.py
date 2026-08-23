import os
import telebot
from telebot.types import ReplyKeyboardMarkup, KeyboardButton, WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

BOT_TOKEN = os.environ.get("TOKEN")

# Инициализируем бота
bot = telebot.TeleBot(BOT_TOKEN)

@bot.message_handler(commands=['start'])
def send_welcome(message):
    # Вариант 1: Кнопка прямо под сообщением (Inline)
    markup = InlineKeyboardMarkup()
    web_app_btn = InlineKeyboardButton(text="🚀 Открыть трекер")

    markup.add(web_app_btn)

    # Вариант 2 (закомментирован): Кнопка вместо клавиатуры внизу экрана
    # markup = ReplyKeyboardMarkup(resize_keyboard=True)
    # web_app_btn = KeyboardButton(text="🚀 Открыть трекер", web_app=WebAppInfo(url=WEBAPP_URL))
    # markup.add(web_app_btn)

    bot.send_message(
        message.chat.id, 
        "Привет! Нажми на кнопку ниже, чтобы открыть своё приложение:", 
        reply_markup=markup
    )

# В самом конце bot.py:
if __name__ == '__main__':
    print("БОТ ЗАПУЩЕН")
    bot.infinity_polling(timeout=30 , long_polling_timeout=20) #ТАЙМЫ И INFINITY
