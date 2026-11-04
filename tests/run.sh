#!/usr/bin/env bash
# Runs the browser test suite (tests/index.html) in headless Chrome.
#
#   tests/run.sh            # all tests
#   tests/run.sh "Tab"      # only tests whose name contains "Tab"
#
# Needs python3 and Chrome/Chromium (override with CHROME=/path/to/chrome).
# Exit code: 0 = all passed, 1 = failures, 2 = setup problem.
set -uo pipefail

cd "$(dirname "$0")/.."

PORT="${PORT:-8765}"
GREP="${1:-}"

CHROME="${CHROME:-}"
if [ -z "$CHROME" ]; then
    for c in google-chrome google-chrome-stable chromium chromium-browser; do
        if command -v "$c" >/dev/null 2>&1; then CHROME="$c"; break; fi
    done
fi
if [ -z "$CHROME" ]; then
    echo "Chrome/Chromium not found; set CHROME=/path/to/chrome" >&2
    exit 2
fi

python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null' EXIT

for _ in $(seq 50); do
    (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null && break
    sleep 0.1
done
if ! kill -0 "$SERVER" 2>/dev/null; then
    echo "Could not start the HTTP server on port $PORT (in use? try PORT=...)" >&2
    exit 2
fi

QUERY=""
if [ -n "$GREP" ]; then
    QUERY="?grep=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "$GREP")"
fi

"$CHROME" --headless=new --disable-gpu --window-size=1280,900 \
    --virtual-time-budget=60000 --dump-dom \
    "http://127.0.0.1:$PORT/tests/$QUERY" 2>/dev/null |
python3 -c '
import html, re, sys
dom = sys.stdin.read()
m = re.search(r"<pre id=\"summary\"[^>]*data-status=\"(\w+)\"[^>]*>(.*?)</pre>", dom, re.S)
if not m:
    print("Could not read test results from the page", file=sys.stderr)
    sys.exit(2)
status, body = m.groups()
print(html.unescape(re.sub(r"<[^>]+>", "", body)))
sys.exit(0 if status == "pass" else 1)
'
