from flask import Flask, jsonify, request
import os
import random
import uuid

try:
    from . import storage
except ImportError:
    import storage

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")


def error(message, code):
    return jsonify({"error": message}), code


def get_quiz(quizzes, quiz_id):
    return next((q for q in quizzes if q.get("id") == quiz_id), None)


def validate_quiz_payload(data):
    if not isinstance(data, dict):
        return "Неверные данные"
    title = str(data.get("title", "")).strip()
    if not title:
        return "Введите название квиза"
    questions = data.get("questions")
    if not isinstance(questions, list) or not questions:
        return "Добавьте хотя бы один вопрос"

    for i, q in enumerate(questions, start=1):
        if not isinstance(q, dict) or not str(q.get("text", "")).strip():
            return f"Вопрос {i}: введите текст"
        options = q.get("options")
        if not isinstance(options, list) or not 2 <= len(options) <= 4:
            return f"Вопрос {i}: должно быть от 2 до 4 вариантов"
        if any(not str(x).strip() for x in options):
            return f"Вопрос {i}: все варианты должны быть заполнены"
        correct = q.get("correct")
        if not isinstance(correct, int) or isinstance(correct, bool) or not 0 <= correct < len(options):
            return f"Вопрос {i}: выберите правильный ответ"
    return None


@app.get("/")
def home():
    return app.send_static_file("index.html")


@app.get("/<path:filename>")
def static_pages(filename):
    if filename.startswith("api/"):
        return error("Не найдено", 404)
    return app.send_static_file(filename)


@app.get("/api/quizzes")
def list_quizzes():
    quizzes = storage.load_quizzes()
    return jsonify([
        {"id": q["id"], "title": q["title"], "description": q.get("description", ""),
         "count": len(q.get("questions", []))}
        for q in quizzes
    ])


@app.post("/api/quizzes")
def create_quiz():
    data = request.get_json(silent=True) or {}
    validation_error = validate_quiz_payload(data)
    if validation_error:
        return error(validation_error, 400)

    with storage.lock:
        quizzes = storage.load_quizzes()
        new_id = max((q.get("id", 0) for q in quizzes), default=0) + 1
        clean_questions = []
        for q in data["questions"]:
            clean_questions.append({
                "text": str(q["text"]).strip(),
                "options": [str(x).strip() for x in q["options"]],
                "correct": int(q["correct"])
            })
        quiz = {
            "id": new_id,
            "title": str(data["title"]).strip(),
            "description": str(data.get("description", "")).strip(),
            "questions": clean_questions
        }
        quizzes.append(quiz)
        storage.save_quizzes(quizzes)
    return jsonify({"id": new_id}), 201


@app.post("/api/rooms")
def create_room():
    data = request.get_json(silent=True) or {}
    quiz_id = data.get("quiz_id")
    if not isinstance(quiz_id, int) or isinstance(quiz_id, bool):
        return error("Укажите quiz_id", 400)

    with storage.lock:
        quizzes = storage.load_quizzes()
        if not get_quiz(quizzes, quiz_id):
            return error("Квиз не найден", 404)
        rooms = storage.load_rooms()
        while True:
            pin = f"{random.randint(0, 999999):06d}"
            if pin not in rooms:
                break
        rooms[pin] = {"quiz_id": quiz_id, "status": "waiting", "players": {}}
        storage.save_rooms(rooms)
    return jsonify({"pin": pin}), 201


@app.get("/api/rooms/<pin>")
def room_state(pin):
    with storage.lock:
        rooms = storage.load_rooms()
        room = rooms.get(pin)
        if not room:
            return error("Комната не найдена", 404)
        quiz = get_quiz(storage.load_quizzes(), room["quiz_id"])
        if not quiz:
            return error("Квиз не найден", 404)
        players = [p["name"] for p in room["players"].values()]
        return jsonify({
            "status": room["status"],
            "quiz_title": quiz["title"],
            "count": len(quiz["questions"]),
            "players": players
        })


@app.post("/api/rooms/<pin>/join")
def join_room(pin):
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()[:20]
    if not name:
        return error("Введите имя", 400)

    with storage.lock:
        rooms = storage.load_rooms()
        room = rooms.get(pin)
        if not room:
            return error("Комната не найдена", 404)
        if room["status"] != "waiting":
            return error("Игра уже началась", 409)
        if any(p["name"].casefold() == name.casefold() for p in room["players"].values()):
            return error("Это имя уже занято", 409)
        player_id = uuid.uuid4().hex[:8]
        room["players"][player_id] = {"name": name, "score": 0, "answers": {}}
        storage.save_rooms(rooms)
    return jsonify({"player_id": player_id}), 201


@app.get("/api/rooms/<pin>/players/<player_id>")
def player_state(pin, player_id):
    with storage.lock:
        rooms = storage.load_rooms()
        room = rooms.get(pin)
        if not room:
            return error("Комната не найдена", 404)
        player = room["players"].get(player_id)
        if not player:
            return error("Игрок не найден", 404)
        scores = sorted((p["score"] for p in room["players"].values()), reverse=True)
        place = 1 + sum(score > player["score"] for score in scores)
        return jsonify({
            "status": room["status"],
            "name": player["name"],
            "score": player["score"],
            "answered": len(player["answers"]),
            "place": place,
            "total": len(room["players"])
        })


@app.post("/api/rooms/<pin>/start")
def start_room(pin):
    with storage.lock:
        rooms = storage.load_rooms()
        room = rooms.get(pin)
        if not room:
            return error("Комната не найдена", 404)
        if room["status"] != "waiting":
            return error("Игра уже началась", 409)
        if not room["players"]:
            return error("Нельзя начать игру без игроков", 409)
        room["status"] = "playing"
        storage.save_rooms(rooms)
    return jsonify({"ok": True})


@app.get("/api/rooms/<pin>/questions")
def questions(pin):
    with storage.lock:
        rooms = storage.load_rooms()
        room = rooms.get(pin)
        if not room:
            return error("Комната не найдена", 404)
        if room["status"] != "playing":
            return error("Игра ещё не началась", 409)
        quiz = get_quiz(storage.load_quizzes(), room["quiz_id"])
        if not quiz:
            return error("Квиз не найден", 404)
        return jsonify([
            {"text": q["text"], "options": q["options"]}
            for q in quiz["questions"]
        ])


@app.post("/api/rooms/<pin>/answer")
def answer(pin):
    data = request.get_json(silent=True) or {}
    player_id = data.get("player_id")
    question = data.get("question")
    option = data.get("option")

    if not isinstance(player_id, str) or not player_id:
        return error("Укажите player_id", 400)
    if not isinstance(question, int) or isinstance(question, bool):
        return error("Неверный номер вопроса", 400)
    if not isinstance(option, int) or isinstance(option, bool):
        return error("Неверный вариант ответа", 400)

    with storage.lock:
        rooms = storage.load_rooms()
        room = rooms.get(pin)
        if not room:
            return error("Комната не найдена", 404)
        if room["status"] != "playing":
            return error("Игра не идёт", 409)
        player = room["players"].get(player_id)
        if not player:
            return error("Игрок не найден", 404)
        quiz = get_quiz(storage.load_quizzes(), room["quiz_id"])
        if not quiz:
            return error("Квиз не найден", 404)
        if not 0 <= question < len(quiz["questions"]):
            return error("Неверный номер вопроса", 400)
        q = quiz["questions"][question]
        if not 0 <= option < len(q["options"]):
            return error("Неверный вариант ответа", 400)
        key = str(question)
        if key in player["answers"]:
            return error("На этот вопрос уже отвечали", 409)

        correct = option == q["correct"]
        player["answers"][key] = option
        if correct:
            player["score"] += 100
        storage.save_rooms(rooms)
        return jsonify({"correct": correct, "score": player["score"]})


@app.get("/api/rooms/<pin>/leaderboard")
def leaderboard(pin):
    with storage.lock:
        rooms = storage.load_rooms()
        room = rooms.get(pin)
        if not room:
            return error("Комната не найдена", 404)
        quiz = get_quiz(storage.load_quizzes(), room["quiz_id"])
        count = len(quiz["questions"]) if quiz else 0
        result = [
            {"name": p["name"], "score": p["score"], "answered": len(p["answers"])}
            for p in room["players"].values()
        ]
        result.sort(key=lambda p: (-p["score"], -p["answered"], p["name"].casefold()))
        for p in result:
            p["total"] = count
        return jsonify(result)


@app.post("/api/rooms/<pin>/finish")
def finish_room(pin):
    with storage.lock:
        rooms = storage.load_rooms()
        room = rooms.get(pin)
        if not room:
            return error("Комната не найдена", 404)
        if room["status"] != "playing":
            return error("Игра уже завершена или ещё не началась", 409)
        room["status"] = "finished"
        storage.save_rooms(rooms)
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
