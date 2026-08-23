from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.ext.mutable import MutableDict
from datetime import date

db = SQLAlchemy()

# Базовое дефолтное состояние для нового пользователя или ежедневного сброса
DEFAULT_STATE = {
    "waterMl": 0,
    "tiktokMins": 0,
    "physicalBattery": 100,
    "socialBattery": 100,
    "shopDegradation": 0,
    "notepadTotalTasks": 0,
    "notepadDoneTasks": 0,
    "obsidianCheckboxState": [False, False, False, False],
    "gymCheckboxState": [False, False],
    "gymMacrosState": {
        "pro": 0, "carbs": 0, "cal": 0, 
        "penalty": False, "bonus": False, "calBonus": False
    }
}

class User(db.Model):
    __tablename__ = "users"

    tg_id = db.Column(db.BigInteger, primary_key=True)
    username = db.Column(db.String(255), nullable=True)

    coins = db.Column(db.Integer, default=0)
    xp = db.Column(db.Integer, default=0)
    level = db.Column(db.Integer, default=1)

    state = db.Column(
        MutableDict.as_mutable(db.JSON),
        default=lambda: DEFAULT_STATE.copy()
    )

    last_active_date = db.Column(db.Date, default=date.today)
    

    def check_and_reset_daily(self):
        """Автоматический сброс дневных счетчиков при наступлении нового дня"""
        today = date.today()
        if self.last_active_date != today:
            current_state = self.state or {}
            
            # Сбрасываем дневные задачи и счетчики
            current_state.update({
                "waterMl": 0,
                "tiktokMins": 0,
                "obsidianCheckboxState": [False, False, False, False],
                "gymCheckboxState": [False, False],
                "gymMacrosState": {
                    "pro": 0, "carbs": 0, "cal": 0, 
                    "penalty": False, "bonus": False, "calBonus": False
                }
            })
            
            self.state = current_state
            self.last_active_date = today
            return True
        return False

    def to_dict(self):
        # Проверяем сброс перед отдачей данных клиенту
        self.check_and_reset_daily()
        return {
            "tg_id": self.tg_id,
            "coins": self.coins,
            "xp": self.xp,
            "level": self.level,
            "state": self.state or DEFAULT_STATE
        }