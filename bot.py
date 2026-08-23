import os
import time
import threading

import telebot
from dotenv import load_dotenv


load_dotenv()

BOT_TOKEN = os.getenv("TOKEN")

bot = telebot.TeleBot(BOT_TOKEN)

# Пользователи, которым бот будет отправлять напоминания
subscribers = set()


@bot.message_handler(commands=["start"])
def start_message(message):
    chat_id = message.chat.id

    # Запоминаем пользователя
    subscribers.add(chat_id)

    username = message.from_user.username or "Аноним"

    bot.send_message(chat_id, text=f"📌 Приветствую, {username}!")


def hourly_reminders():
    """
    Отправляет напоминание каждому подписавшемуся пользователю
    один раз в час.
    """

    messages = [
        "💧 Попей воды. Не забывай поддерживать водный баланс!",
        "📵 Убери TikTok и отложи телефон хотя бы ненадолго.",
        "💧 Время попить воды!",
        "📵 Проверь себя: не залип ли ты снова в TikTok?",
    ]

    message_index = 0

    while True:
        time.sleep(30)

        text = messages[message_index % len(messages)]
        message_index += 1

        # Создаём копию, чтобы безопасно проходить по списку
        for chat_id in list(subscribers):
            try:
                bot.send_message(chat_id, text)
            except Exception as e:
                print(f"Не удалось отправить сообщение {chat_id}: {e}")


if __name__ == "__main__":
    print("Бот запущен...")

    # Запускаем почасовые напоминания отдельным потоком
    reminder_thread = threading.Thread(
        target=hourly_reminders,
        daemon=True
    )
    reminder_thread.start()

    bot.remove_webhook()
    bot.infinity_polling(skip_pending=True)