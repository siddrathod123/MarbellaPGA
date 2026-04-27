import json
from pathlib import Path
from flask import Flask, render_template, request, redirect, url_for

app = Flask(__name__)
DATA_FILE = Path("data.json")

NAMES = ["Elijah", "James", "Ben", "Sam", "Sidd K", "Sidd R", "Nick", "Matt"]
COURSES = [
    {"id": "atalaya", "name": "Atalaya New Course", "holes": [4,4,3,5,4,4,3,5,4,4,5,3,4,4,4,5,3,4]},
    {"id": "dona", "name": "Doña Julia", "holes": [4,5,4,3,4,4,5,3,4,4,4,3,5,4,4,3,5,4]},
    {"id": "arqueros", "name": "Los Arqueros", "holes": [4,4,3,5,4,4,3,4,5,4,3,4,5,4,4,3,5,4]},
    {"id": "higueron", "name": "Higuerón", "holes": [4,3,4,5,4,4,3,5,4,4,4,3,5,4,3,4,5,4]},
]
FORMATS = ["Singles Matchplay", "Fourball Better Ball", "Alternate Shot", "Scramble", "Stableford", "Skins", "Vegas / Wolf"]


def blank_state():
    return {
        "selected_course": "atalaya",
        "current_format": "Singles Matchplay",
        "players": [{"name": n, "team": "", "handicap": "", "joined": False} for n in NAMES],
        "scores": {c["id"]: {n: [""] * 18 for n in NAMES} for c in COURSES},
        "drinks": {c["id"]: {n: [""] * 18 for n in NAMES} for c in COURSES},
        "bets": [],
    }


def load_state():
    if DATA_FILE.exists():
        try:
            state = json.loads(DATA_FILE.read_text())
        except json.JSONDecodeError:
            state = blank_state()
    else:
        state = blank_state()

    # Backward-compatible repair if data.json is missing newer fields.
    state.setdefault("selected_course", "atalaya")
    state.setdefault("current_format", "Singles Matchplay")
    state.setdefault("players", [{"name": n, "team": "", "handicap": "", "joined": False} for n in NAMES])
    state.setdefault("scores", {})
    state.setdefault("drinks", {})
    state.setdefault("bets", [])
    for c in COURSES:
        state["scores"].setdefault(c["id"], {})
        state["drinks"].setdefault(c["id"], {})
        for n in NAMES:
            state["scores"][c["id"]].setdefault(n, [""] * 18)
            state["drinks"][c["id"]].setdefault(n, [""] * 18)
    return state


def save_state(state):
    DATA_FILE.write_text(json.dumps(state, indent=2))


def selected_course_obj(state):
    return next((c for c in COURSES if c["id"] == state.get("selected_course")), COURSES[0])


def number(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def total_for(state, name):
    total = gross = drinks = played = 0
    for c in COURSES:
        course_scores = state["scores"][c["id"]][name]
        course_drinks = state["drinks"][c["id"]][name]
        for shot_value, drink_value in zip(course_scores, course_drinks):
            shots = number(shot_value)
            if shots:
                d = number(drink_value)
                gross += shots
                drinks += d
                total += shots - d
                played += 1
    return {"total": total, "gross": gross, "drinks": drinks, "played": played}


def team_points(state):
    pink = 0
    purple = 0
    for player in state["players"]:
        total = total_for(state, player["name"])["total"]
        if player.get("team") == "Pink":
            pink += total
        elif player.get("team") == "Purple":
            purple += total
    return {"pink": pink, "purple": purple}


def leaderboard(state):
    rows = []
    for n in NAMES:
        player = next((p for p in state["players"] if p["name"] == n), {"team": ""})
        totals = total_for(state, n)
        rows.append({"name": n, "team": player.get("team", ""), **totals})
    return sorted(rows, key=lambda x: x["total"] if x["played"] else 999999)


def common_context(view):
    state = load_state()
    return {
        "state": state,
        "view": view,
        "names": NAMES,
        "courses": COURSES,
        "formats": FORMATS,
        "team_points": team_points(state),
        "leaderboard": leaderboard(state),
    }


@app.route("/")
def home():
    return render_template("home.html", **common_context("home"))


@app.post("/format")
def update_format():
    state = load_state()
    state["current_format"] = request.form.get("format", state["current_format"])
    save_state(state)
    return redirect(url_for("home"))


@app.route("/teams")
def teams():
    return render_template("teams.html", **common_context("teams"))


@app.post("/teams")
def save_player():
    state = load_state()
    name = request.form.get("player")
    for p in state["players"]:
        if p["name"] == name:
            p["team"] = request.form.get("team", "")
            p["handicap"] = request.form.get("handicap", "")
            p["joined"] = True
            break
    save_state(state)
    return redirect(url_for("teams"))


@app.route("/scores")
def scores():
    ctx = common_context("scores")
    state = ctx["state"]
    course_id = request.args.get("course") or state.get("selected_course") or COURSES[0]["id"]
    player = request.args.get("player") or NAMES[0]
    state["selected_course"] = course_id
    save_state(state)
    course = next((c for c in COURSES if c["id"] == course_id), COURSES[0])
    ctx.update({"course": course, "score_player": player})
    return render_template("scores.html", **ctx)


@app.post("/scores")
def save_scores():
    state = load_state()
    course_id = request.form.get("course") or state.get("selected_course")
    player = request.form.get("player") or NAMES[0]
    state["selected_course"] = course_id
    for i in range(18):
        state["scores"][course_id][player][i] = request.form.get(f"score_{i}", "")
        state["drinks"][course_id][player][i] = request.form.get(f"drink_{i}", "")
    save_state(state)
    return redirect(url_for("scores", course=course_id, player=player))


@app.route("/bets")
def bets():
    return render_template("bets.html", **common_context("bets"))


@app.post("/bets")
def add_bet():
    state = load_state()
    state["bets"].insert(0, {
        "players": request.form.get("players") or "Unnamed degenerates",
        "text": request.form.get("text") or "Mystery bet",
        "duration": request.form.get("duration") or "Unknown duration",
        "value": request.form.get("value") or "Pride",
    })
    save_state(state)
    return redirect(url_for("bets"))


@app.post("/bets/remove/<int:index>")
def remove_bet(index):
    state = load_state()
    if 0 <= index < len(state["bets"]):
        state["bets"].pop(index)
        save_state(state)
    return redirect(url_for("bets"))


@app.route("/summary")
def summary():
    return render_template("summary.html", **common_context("summary"))


@app.post("/reset")
def reset():
    save_state(blank_state())
    return redirect(url_for("home"))


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
