"""
CTAN Bus Tracker — Test Runner
-------------------------------
Runs all tests, or a specific suite by name.

Usage:
    python3 run_tests.py              # run everything
    python3 run_tests.py api          # API contract tests only
    python3 run_tests.py home         # home page UI tests
    python3 run_tests.py navigation   # stop selector + back-button chain
    python3 run_tests.py timetable    # live departures (station page)
    python3 run_tests.py planner      # route planner
    python3 run_tests.py map          # stop map

First run auto-installs dependencies into a .venv.
"""

import subprocess, sys, os

ROOT     = os.path.dirname(os.path.abspath(__file__))
VENV_DIR = os.path.join(ROOT, ".venv")
VENV_PY  = os.path.join(VENV_DIR, "bin", "python")

# ── Re-launch inside venv ──────────────────────────────────────────────────────
if sys.executable != VENV_PY and os.path.exists(VENV_PY):
    os.execv(VENV_PY, [VENV_PY] + sys.argv)

# ── Auto-install ───────────────────────────────────────────────────────────────
def _ensure(pkg, import_as=None):
    try:
        __import__(import_as or pkg)
    except ImportError:
        print(f"Installing {pkg}…")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", pkg])

_ensure("pytest")
_ensure("requests")
_ensure("playwright")

try:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        p.chromium.launch()
except Exception:
    print("Installing Playwright browser…")
    subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium", "--quiet"])

import pytest

SUITES = {
    "api":        "tests/test_api.py",
    "home":       "tests/test_home.py",
    "navigation": "tests/test_navigation.py",
    "timetable":  "tests/test_timetable.py",
    "planner":    "tests/test_planner.py",
    "map":        "tests/test_map.py",
}

if __name__ == "__main__":
    args = sys.argv[1:]
    if args and args[0] in SUITES:
        targets = [SUITES[args[0]]]
        extra   = args[1:]
    else:
        targets = list(SUITES.values())
        extra   = args

    sys.exit(pytest.main([
        *targets,
        "-v",
        "--tb=short",
        "--no-header",
        "-p", "no:warnings",
        *extra,
    ]))
