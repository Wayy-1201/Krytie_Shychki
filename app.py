import os
from flask import Flask, request, jsonify , render_template
from flask_cors import CORS
from database import db, User
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DB_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

with app.app_context():
    db.create_all()

# Дефолтное состояние пользователя
DEFAULT_STATE = {
    "waterMl": 0,
    "tiktokMins": 0,
    "shopDegradation": 0,
    "obsidianCheckboxState": [False, False, False, False],
    "gymCheckboxState": [False, False],
    "notepadDoneTasks": 0,
    "notepadTotalTasks": 0,
    "gymMacrosState": {"pro": 0, "carbs": 0, "cal": 0, "penalty": False, "bonus": False, "calBonus": False}
}

def get_logical_date():
    msk_tz = timezone(timedelta(hours=3))
    now_msk = datetime.now(msk_tz)
    logical_time = now_msk - timedelta(hours=4)
    return logical_time.date()


@app.route('/') #апи запрос который откроет главную страницу на главном экране
def index():
    return render_template('index.html') #возвращем нащ html файл

@app.route('/api/user/<int:tg_id>', methods=['GET'])
def get_user(tg_id):
    user = db.session.get(User, tg_id)
    today = get_logical_date()

    if not user:
        user = User(tg_id=tg_id, state=DEFAULT_STATE.copy(), last_active_date=today)
        db.session.add(user)
        db.session.commit()
    else:
        if user.last_active_date < today:
            # Гарантируем корректный сброс, даже если state был None или пуст
            current_state = (user.state or {}).copy()
            current_state.update(DEFAULT_STATE)
            
            user.state = current_state
            user.last_active_date = today
            db.session.commit()

    return jsonify(user.to_dict())

@app.route('/api/user/sync', methods=['POST'])
def sync_user():
    data = request.get_json(silent=True) or {}
    tg_id = data.get('tg_id')
    
    if not tg_id:
        return jsonify({"error": "No tg_id provided"}), 400

    today = get_logical_date()
    user = db.session.get(User, tg_id)
    
    if not user:
        user = User(
            tg_id=tg_id,
            state=data.get('state', DEFAULT_STATE.copy()),
            coins=data.get('coins', 0),
            xp=data.get('xp', 0),
            level=data.get('level', 1),
            last_active_date=today
        )
        db.session.add(user)
    else:
        if 'coins' in data:
            user.coins = data['coins']
        if 'xp' in data:
            user.xp = data['xp']
        if 'level' in data:
            user.level = data['level']
        if 'state' in data:
            user.state = data['state']
        
        user.last_active_date = today

    db.session.commit()
    return jsonify({"status": "success"})


if __name__ == '__main__': #стандратная проверка
    port = int(os.environ.get("PORT" , 10000)) #автомат
    app.run(host="0.0.0.0" , port=port)
