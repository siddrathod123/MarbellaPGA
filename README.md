# Marbella Drinking Open

A simple mobile-friendly Flask web app for an 8-player golf drinking game.

## Rules

- Record the par for each hole.
- Record strokes and drinks for each player.
- Net score = strokes - drinks.
- Lowest total net score wins.

## Run locally

```bash
pip install -r requirements.txt
python app.py
```

Open `http://127.0.0.1:10000`.

## Deploy on Render

1. Upload these files to a GitHub repo.
2. Create a Render Web Service.
3. Use:
   - Language: Python 3
   - Build command: `pip install -r requirements.txt`
   - Start command: `gunicorn app:app`
   - Instance type: Starter/free

The app stores game data in `game_state.json` on the running service. On Render free tier, data can reset if the service is rebuilt/restarted.
