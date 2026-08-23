from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.ext.mutable import MutableDict
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from copy import deepcopy

db = SQLAlchemy()

MSK = ZoneInfo("Europe/Moscow")

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
        "pro": 0,
        "carbs": 0,
        "cal": 0,
        "penalty": False,
        "bonus": False,
        "calBonus": False
    }
}


def get_msk_reset_date():
    """
    Возвращает текущий "игровой день" по Москве.
    Новый день начинается в 04:00 МСК.
    """
    now_msk = datetime.now(timezone.utc).astimezone(MSK)

    # До 04:00 ещё считается предыдущий игровой день
    if now_msk.hour < 4:
        return now_msk.date() - timedelta(days=1)

    return now_msk.date()


class User(db.Model):
    __tablename__ = "users"

    tg_id = db.Column(db.BigInteger, primary_key=True)
    username = db.Column(db.String(255), nullable=True)

    coins = db.Column(db.Integer, default=0)
    xp = db.Column(db.Integer, default=0)
    level = db.Column(db.Integer, default=1)

    state = db.Column(
        MutableDict.as_mutable(db.JSON),
        default=lambda: deepcopy(DEFAULT_STATE)
    )

    last_active_date = db.Column(
        db.Date,
        default=get_msk_reset_date
    )

    def check_and_reset_daily(self):
        """
        Сброс всего state один раз в новый игровой день.
        Новый игровой день начинается в 04:00 МСК.
        coins/xp/level не меняются.
        """
        current_reset_date = get_msk_reset_date()

        if self.last_active_date != current_reset_date:
            self.state = deepcopy(DEFAULT_STATE)
            self.last_active_date = current_reset_date
            return True

        return False

    def to_dict(self):
        self.check_and_reset_daily()

        return {
            "tg_id": self.tg_id,
            "username": self.username,
            "coins": self.coins,
            "xp": self.xp,
            "level": self.level,
            "state": self.state or deepcopy(DEFAULT_STATE)
        }

