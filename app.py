import os

from dotenv import load_dotenv
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS

from database import db, User


load_dotenv()

app = Flask(__name__)
CORS(app)

database_url = os.getenv("DB_URL")

if not database_url:
    raise RuntimeError("DB_URL is not set")

app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

with app.app_context():
    db.create_all()
# --- РОУТЫ (ENDPOINTS) ---



# Главная страница (Отдает ваш index.html из папки templates)
@app.route('/')
def index():
    return render_template('index.html')

# Создание или обновление пользователя при входе
@app.route('/save_user', methods=['POST'])
def save_user():
    data = request.json
    tg_id = data.get('tg_id')
    username = data.get('username')

    if not tg_id:
        return jsonify({"error": "No tg_id provided"}), 400

    user = User.query.filter_by(tg_id=tg_id).first()
    if not user:
        user = User(tg_id=tg_id, username=username)
        db.session.add(user)
        db.session.commit()
        return jsonify({"message": "User created"}), 201
    else:
        if username and user.username != username:
            user.username = username
            db.session.commit()
        return jsonify({"message": "User exists, updated"}), 200

# Загрузка данных при старте приложения
@app.route('/get_data/<int:tg_id>', methods=['GET'])
def get_data(tg_id):
    user = User.query.filter_by(tg_id=tg_id).first()
    if user:
        return jsonify({
            "tg_id": user.tg_id,
            "username": user.username,
            "coins": user.coins,
            "xp": user.xp,
            "level": user.level,
            "state": user.state or {}
        }), 200
    return jsonify({"error": "User not found"}), 404

# Сохранение всех данных (синхронизация)
@app.route('/sync', methods=['POST'])
def sync_data():
    data = request.json
    tg_id = data.get('tg_id')

    if not tg_id:
        return jsonify({"error": "No tg_id"}), 400

    user = User.query.filter_by(tg_id=tg_id).first()
    if user:
        user.coins = data.get('coins', user.coins)
        user.xp = data.get('xp', user.xp)
        user.level = data.get('level', user.level)
        user.state = data.get('state', user.state)
        db.session.commit()
        return jsonify({"message": "Data synced successfully"}), 200
        
    return jsonify({"error": "User not found"}), 404

# --- ЗАПУСК СЕРВЕРА ---
if __name__ == '__main__': #стандратная проверка
    port = int(os.environ.get("PORT" , 10000)) #автомат
    app.run(host="0.0.0.0" , port=port)