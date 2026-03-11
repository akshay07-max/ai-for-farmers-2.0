"""
Run this instead of main.py:
    python run.py

This guarantees the current directory is in Python's path before
any imports happen — fixes 'No module named schemas' on Windows.
"""
import sys
import os

# Step 1 — add this folder to path BEFORE any local imports
THIS_DIR = os.path.abspath(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, THIS_DIR)

# Step 2 — now safe to import local modules
import uvicorn

# Step 3 — import app object directly (not as string)
# This keeps uvicorn in the same process — no spawning, no path loss
from main import app  # noqa: E402

if __name__ == "__main__":
    # Read port directly from .env without importing config
    # (avoids any circular import issues)
    from dotenv import load_dotenv
    load_dotenv()
    port = int(os.getenv("PORT", 8000))

    print(f"Starting KrishiMitra AI Service on port {port}...")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        reload=False,
        workers=1,
    )