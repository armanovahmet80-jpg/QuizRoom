import json
import os
import threading

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
QUIZZES_FILE = os.path.join(DATA_DIR, "quizzes.json")
ROOMS_FILE = os.path.join(DATA_DIR, "rooms.json")

lock = threading.RLock()


def _load(path, default):
    with lock:
        if not os.path.exists(path):
            return default
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return default


def _save(path, data):
    with lock:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, path)


def load_quizzes():
    return _load(QUIZZES_FILE, [])


def save_quizzes(quizzes):
    _save(QUIZZES_FILE, quizzes)


def load_rooms():
    return _load(ROOMS_FILE, {})


def save_rooms(rooms):
    _save(ROOMS_FILE, rooms)
