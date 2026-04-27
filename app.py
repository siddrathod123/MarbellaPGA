import json
import os
from pathlib import Path
from threading import Lock
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
DATA_FILE = Path(os.environ.get("DATA_FILE", "game_state.json"))
lock = Lock()

DEFAULT_PLAYERS = ["Elijah", "James", "Ben", "Sam", "Sidd K", "Sidd R", "Nick", "Matt"]
DEFAULT_STATE = {
    "game_name": "Marbella Drinking Open",
    "players": [{"name": name, "group": 1 if i < 4 else 2} for i, name in enumerate(DEFAULT_PLAYERS)],
    "pars": [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 5, 3, 4, 4, 4, 5, 3, 4],
    "scores": {},
}


def fresh_state():
    state = json.loads(json.dumps(DEFAULT_STATE))
    for player in DEFAULT_PLAYERS:
        state["scores"][player] = [None] * 18
    return state


def load_state():
    if DATA_FILE.exists():
        try:
            with DATA_FILE.open("r", encoding="utf-8") as f:
                state = json.load(f)
        except json.JSONDecodeError:
            state = fresh_state()
    else:
        state = fresh_state()
    return normalise_state(state)


def normalise_state(state):
    state.setdefault("game_name", "Marbella Drinking Open")
    state.setdefault("players", [])
    state.setdefault("pars", [4] * 18)
    state["pars"] = (state["pars"] + [4] * 18)[:18]
    state.setdefault("scores", {})
    for player in state["players"]:
        name = player.get("name", "").strip()
        if name and name not in state["scores"]:
            state["scores"][name] = [None] * 18
        elif name:
            state["scores"][name] = (state["scores"].get(name, []) + [None] * 18)[:18]
    valid_names = {p.get("name", "").strip() for p in state["players"]}
    state["scores"] = {k: v for k, v in state["scores"].items() if k in valid_names}
    return state


def save_state(state):
    with DATA_FILE.open("w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)


def score_summary(state):
    rows = []
    for player in state["players"]:
        name = player["name"]
        holes = state["scores"].get(name, [None] * 18)
        gross = 0
        drinks = 0
        net = 0
        played = 0
        versus_par = 0
        for i, entry in enumerate(holes):
            if not entry:
                continue
            strokes = int(entry.get("strokes") or 0)
            drink_count = int(entry.get("drinks") or 0)
            hole_net = strokes - drink_count
            gross += strokes
            drinks += drink_count
            net += hole_net
            versus_par += hole_net - int(state["pars"][i])
            played += 1
        rows.append({
            "name": name,
            "group": player.get("group", 1),
            "gross": gross,
            "drinks": drinks,
            "net": net,
            "played": played,
            "versus_par": versus_par,
        })
    rows.sort(key=lambda r: (r["played"] == 0, r["net"] if r["played"] else 9999, r["gross"]))
    return rows


@app.route("/")
def index():
    return render_template("index.html")


@app.get("/api/state")
def get_state():
    with lock:
        state = load_state()
        return jsonify({"state": state, "leaderboard": score_summary(state)})


@app.post("/api/settings")
def update_settings():
    payload = request.get_json(force=True)
    with lock:
        state = load_state()
        if "game_name" in payload:
            state["game_name"] = str(payload["game_name"]).strip() or state["game_name"]
        if "pars" in payload:
            pars = []
            for value in payload["pars"][:18]:
                try:
                    pars.append(max(3, min(6, int(value))))
                except (TypeError, ValueError):
                    pars.append(4)
            state["pars"] = (pars + [4] * 18)[:18]
        if "players" in payload:
            players = []
            for idx, player in enumerate(payload["players"][:8]):
                name = str(player.get("name", "")).strip() or f"Player {idx + 1}"
                group = int(player.get("group", 1))
                players.append({"name": name, "group": 1 if group == 1 else 2})
            old_scores = state.get("scores", {})
            state["players"] = players
            state["scores"] = {p["name"]: old_scores.get(p["name"], [None] * 18) for p in players}
        state = normalise_state(state)
        save_state(state)
        return jsonify({"ok": True, "state": state, "leaderboard": score_summary(state)})


@app.post("/api/score")
def update_score():
    payload = request.get_json(force=True)
    player = str(payload.get("player", "")).strip()
    hole = int(payload.get("hole", 1))
    if hole < 1 or hole > 18:
        return jsonify({"ok": False, "error": "Hole must be 1 to 18"}), 400
    with lock:
        state = load_state()
        if player not in state["scores"]:
            return jsonify({"ok": False, "error": "Unknown player"}), 400
        clear = bool(payload.get("clear"))
        if clear:
            state["scores"][player][hole - 1] = None
        else:
            strokes = max(1, min(20, int(payload.get("strokes", 1))))
            drinks = max(0, min(20, int(payload.get("drinks", 0))))
            state["scores"][player][hole - 1] = {"strokes": strokes, "drinks": drinks, "net": strokes - drinks}
        save_state(state)
        return jsonify({"ok": True, "state": state, "leaderboard": score_summary(state)})


@app.post("/api/reset_scores")
def reset_scores():
    with lock:
        state = load_state()
        for player in state["players"]:
            state["scores"][player["name"]] = [None] * 18
        save_state(state)
        return jsonify({"ok": True, "state": state, "leaderboard": score_summary(state)})


@app.post("/api/reset_all")
def reset_all():
    with lock:
        state = fresh_state()
        save_state(state)
        return jsonify({"ok": True, "state": state, "leaderboard": score_summary(state)})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
