"""
FAANG Stock Prediction — ML Dashboard  (Groq AI Edition)
=========================================================
A Flask web server that serves the FAANG ML dashboard powered by Groq AI.

The AI chat section uses:
  • API endpoint : https://api.groq.com/openai/v1/chat/completions
  • Model        : llama-3.3-70b-versatile
  • Auth header  : Authorization: Bearer <your_groq_api_key>

Get a free Groq API key at: https://console.groq.com

Requirements:
    pip install flask

Run:
    python faang_dashboard.py

Then open: http://localhost:5000
"""

import os
import sys
from pathlib import Path

try:
    from flask import Flask, render_template_string
except ImportError:
    print("Flask is not installed. Install it with:\n\n    pip install flask\n")
    sys.exit(1)

HTML_FILE = Path(__file__).parent / "faang_dashboard_groq.html"
if not HTML_FILE.exists():
    HTML_FILE = Path(os.getcwd()) / "faang_dashboard_groq.html"
if not HTML_FILE.exists():
    print("ERROR: 'faang_dashboard_groq.html' not found.\nMake sure it is in the same directory as this script.")
    sys.exit(1)

DASHBOARD_HTML = HTML_FILE.read_text(encoding="utf-8")

app = Flask(__name__)

@app.route("/")
def index():
    """Serve the FAANG ML dashboard (Groq AI edition)."""
    return render_template_string(DASHBOARD_HTML)

@app.route("/health")
def health():
    return {
        "status": "ok",
        "dashboard": "FAANG Stock Prediction ML Dashboard",
        "ai_provider": "Groq",
        "model": "llama-3.3-70b-versatile",
    }

if __name__ == "__main__":
    PORT = int(os.environ.get("PORT", 5000))
    DEBUG = os.environ.get("DEBUG", "false").lower() == "true"

    print("=" * 62)
    print("  FAANG Stock Prediction — ML Dashboard  (Groq AI Edition)")
    print("=" * 62)
    print(f"  Server     : http://localhost:{PORT}")
    print(f"  AI Provider: Groq  (llama-3.3-70b-versatile)")
    print(f"  API Key    : Get yours free at https://console.groq.com")
    print(f"  HTML File  : {HTML_FILE.resolve()}")
    print("=" * 62)
    print("  Press Ctrl+C to stop.\n")

    app.run(host="0.0.0.0", port=PORT, debug=DEBUG)
