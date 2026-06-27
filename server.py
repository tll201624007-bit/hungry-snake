from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import time


ROOT = Path(__file__).resolve().parent
LEADERBOARD_FILE = ROOT / "leaderboard.json"
MAX_SCORES = 10


class SnakeHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path == "/api/leaderboard":
            self._send_json(load_scores())
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/api/leaderboard":
            self.send_error(404, "Not found")
            return

        length = int(self.headers.get("Content-Length", "0"))
        try:
            payload = json.loads(self.rfile.read(length) or "{}")
            name = clean_name(payload.get("name", ""))
            score = max(0, int(payload.get("score", 0)))
        except (json.JSONDecodeError, TypeError, ValueError):
            self.send_error(400, "Invalid score payload")
            return

        if not name:
            self.send_error(400, "Player name is required")
            return

        scores = load_scores()
        if score > 0:
            scores = upsert_best_score(scores, name, score)
            save_scores(scores)

        self._send_json(scores)

    def _send_json(self, data):
        encoded = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


def clean_name(value):
    name = str(value).strip()[:16]
    return name


def load_scores():
    if not LEADERBOARD_FILE.exists():
        return []
    try:
        data = json.loads(LEADERBOARD_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []

    best_by_name = {}
    for item in data:
        try:
            name = clean_name(item.get("name", "Player")) or "Player"
            score = max(0, int(item.get("score", 0)))
            created_at = int(item.get("createdAt", 0))
        except (AttributeError, TypeError, ValueError):
            continue

        current = best_by_name.get(name)
        if current is None or score > current["score"]:
            best_by_name[name] = {"name": name, "score": score, "createdAt": created_at}

    return rank_scores(best_by_name.values())


def upsert_best_score(scores, name, score):
    now = int(time.time())
    by_name = {item["name"]: item for item in scores}
    current = by_name.get(name)

    if current is None:
        by_name[name] = {"name": name, "score": score, "createdAt": now}
    elif score > current["score"]:
        current["score"] = score
        current["createdAt"] = now

    return rank_scores(by_name.values())


def rank_scores(scores):
    return sorted(
        scores,
        key=lambda item: (-item["score"], item.get("createdAt", 0), item["name"].lower()),
    )[:MAX_SCORES]


def save_scores(scores):
    LEADERBOARD_FILE.write_text(
        json.dumps(scores, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    port = 8000
    server = ThreadingHTTPServer(("127.0.0.1", port), SnakeHandler)
    print(f"Snake game running at http://127.0.0.1:{port}")
    print("Press Ctrl+C to stop.")
    server.serve_forever()
