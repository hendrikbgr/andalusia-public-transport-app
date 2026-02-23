"""
Shared fixtures and server setup for all test modules.
"""

import os, sys, threading, time
import requests
import pytest
from playwright.sync_api import sync_playwright


def pytest_addoption(parser):
    parser.addoption(
        "--run-network",
        action="store_true",
        default=False,
        help="Run tests marked with @pytest.mark.network (skipped by default in CI)",
    )


def pytest_collection_modifyitems(config, items):
    if not config.getoption("--run-network"):
        skip = pytest.mark.skip(reason="Skipped in CI — run with --run-network to include")
        for item in items:
            if "network" in item.keywords:
                item.add_marker(skip)

# ── Project root ───────────────────────────────────────────────────────────────
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── Constants ──────────────────────────────────────────────────────────────────
PORT     = 8787
BASE_URL = f"http://localhost:{PORT}"
TIMEOUT  = 15_000   # ms

# Real reference data verified against live API 2026-02-19
API           = "https://api.ctan.es/v1/Consorcios"
MALAGA_ID     = "4"
STOP_MUELLE   = "149"    # Terminal Muelle Heredia
NUCLEO_MALAGA      = "1"
NUCLEO_FUENGIROLA  = "111"
NUCLEO_COIN        = "201"
NUCLEO_ALHAURIN    = "83"

# ── Local HTTP server ──────────────────────────────────────────────────────────
_server = None

def start_server():
    global _server
    import http.server
    handler = http.server.SimpleHTTPRequestHandler
    handler.log_message = lambda *a: None
    _server = http.server.HTTPServer(("", PORT), handler)
    os.chdir(ROOT)
    t = threading.Thread(target=_server.serve_forever, daemon=True)
    t.start()
    for _ in range(20):
        try:
            requests.get(f"{BASE_URL}/index.html", timeout=1)
            return
        except Exception:
            time.sleep(0.3)
    raise RuntimeError("Local server did not start")

def stop_server():
    if _server:
        _server.shutdown()

# ── Session-scoped fixtures ────────────────────────────────────────────────────
@pytest.fixture(scope="session", autouse=True)
def local_server():
    start_server()
    yield
    stop_server()

@pytest.fixture(scope="session")
def browser_ctx():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context()
        yield ctx
        browser.close()

@pytest.fixture()
def page(browser_ctx):
    pg = browser_ctx.new_page()
    yield pg
    pg.close()
