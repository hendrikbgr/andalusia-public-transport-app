"""
CTAN Bus Tracker — End-to-End Test Suite
-----------------------------------------
Tests two layers:
  1. API tests  — hit the live CTAN API and assert real data shapes
  2. UI tests   — spin up a local HTTP server, drive pages with Playwright

Run:
    python3 test_app.py

First run will install playwright + pytest automatically.
"""

import subprocess, sys, os

VENV_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".venv")
VENV_PY  = os.path.join(VENV_DIR, "bin", "python")

# ── Re-launch inside venv if not already running there ────────────────────────
if sys.executable != VENV_PY and os.path.exists(VENV_PY):
    os.execv(VENV_PY, [VENV_PY] + sys.argv)

# ── Auto-install dependencies (venv pip) ──────────────────────────────────────
def _ensure(pkg, import_as=None):
    try:
        __import__(import_as or pkg)
    except ImportError:
        print(f"Installing {pkg}…")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", pkg])

_ensure("pytest")
_ensure("requests")
_ensure("playwright")

# Install browser binaries if needed
try:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        p.chromium.launch()
except Exception:
    print("Installing Playwright browser…")
    subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium", "--quiet"])

# ── Imports ────────────────────────────────────────────────────────────────────
import threading, time, http.server, json, re
import requests
import pytest
from playwright.sync_api import sync_playwright, expect

# ── Constants ──────────────────────────────────────────────────────────────────
API        = "https://api.ctan.es/v1/Consorcios"
APP_DIR    = os.path.dirname(os.path.abspath(__file__))
PORT       = 8787
BASE_URL   = f"http://localhost:{PORT}"
TIMEOUT    = 15_000   # ms, for Playwright waits

# Real reference data verified against live API on 2026-02-19
MALAGA_ID   = "4"
STOP_MUELLE = "149"   # Terminal Muelle Heredia — first stop on M-110
NUCLEO_MALAGA        = "1"
NUCLEO_FUENGIROLA    = "111"
NUCLEO_COIN          = "201"
NUCLEO_ALHAURIN      = "83"

# ── Local HTTP server ──────────────────────────────────────────────────────────
_server = None

def start_server():
    global _server
    handler = http.server.SimpleHTTPRequestHandler
    handler.log_message = lambda *a: None          # suppress request logs
    _server = http.server.HTTPServer(("", PORT), handler)
    os.chdir(APP_DIR)
    t = threading.Thread(target=_server.serve_forever, daemon=True)
    t.start()
    # Wait until port is accepting connections
    for _ in range(20):
        try:
            requests.get(f"{BASE_URL}/home.html", timeout=1)
            return
        except Exception:
            time.sleep(0.3)
    raise RuntimeError("Local server did not start")

def stop_server():
    if _server:
        _server.shutdown()

# ══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — API TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestAPI:
    """Hit the live CTAN API and validate response shapes + known data."""

    def test_consortiums_returns_nine(self):
        r = requests.get(f"{API}/consorcios", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "consorcios" in data
        assert len(data["consorcios"]) == 9

    def test_consortium_ids_and_names(self):
        data = requests.get(f"{API}/consorcios", timeout=10).json()
        by_id = {c["idConsorcio"]: c["nombre"] for c in data["consorcios"]}
        assert by_id["1"] == "Área de Sevilla"
        assert by_id["4"] == "Área de Málaga"
        assert by_id["9"] == "Costa de Huelva"

    def test_malaga_stops_have_coords(self):
        r = requests.get(f"{API}/{MALAGA_ID}/paradas/", timeout=15)
        assert r.status_code == 200
        stops = r.json().get("paradas", [])
        assert len(stops) > 100, "Expected hundreds of Málaga stops"
        # Every stop should have the required fields
        for s in stops[:10]:
            assert "idParada" in s
            assert "nombre" in s
            # latitud/longitud may be empty string for stops without GPS — that's OK
            assert "latitud" in s

    def test_specific_stop_details(self):
        """Stop 149 = Terminal Muelle Heredia, Zone A."""
        r = requests.get(f"{API}/{MALAGA_ID}/paradas/{STOP_MUELLE}", timeout=10)
        assert r.status_code == 200
        s = r.json()
        assert s["idParada"] == STOP_MUELLE
        assert "Muelle Heredia" in s["nombre"]
        assert s["idZona"] == "A"
        assert s["municipio"].lower() in ("málaga", "malaga")

    def test_line_1_details(self):
        """Line 1 = M-110 Málaga–Torremolinos–Benalmádena Costa."""
        r = requests.get(f"{API}/{MALAGA_ID}/lineas/1", timeout=10)
        assert r.status_code == 200
        line = r.json()
        assert line["idLinea"] == "1"
        assert line["codigo"] == "M-110"
        assert "Torremolinos" in line["nombre"] or "Benalm" in line["nombre"]

    def test_line_1_paradas_direction_1(self):
        """M-110 direction 1 starts at stop 149 (Terminal Muelle Heredia)."""
        r = requests.get(f"{API}/{MALAGA_ID}/lineas/1/paradas", timeout=10)
        assert r.status_code == 200
        data = r.json()
        paradas = data.get("paradas", [])
        dir1 = [p for p in paradas if str(p.get("sentido")) == "1"]
        assert len(dir1) >= 10
        ids = [str(p["idParada"]) for p in dir1]
        assert STOP_MUELLE in ids, f"Stop {STOP_MUELLE} not found in direction-1 stops"

    def test_malaga_nucleos(self):
        """Consortium 4 should include key towns used by the planner."""
        r = requests.get(f"{API}/{MALAGA_ID}/nucleos", timeout=10)
        assert r.status_code == 200
        nucleos = r.json().get("nucleos", [])
        by_id = {n["idNucleo"]: n["nombre"] for n in nucleos}
        assert by_id.get(NUCLEO_MALAGA, "").lower() in ("málaga", "malaga")
        assert "Fuengirola" in by_id.get(NUCLEO_FUENGIROLA, "")
        assert "Coín" in by_id.get(NUCLEO_COIN, "") or "Coin" in by_id.get(NUCLEO_COIN, "")

    def test_planner_coin_to_alhaurin_structure(self):
        """Coín→Alhaurín timetable must have the correct column layout."""
        url = (f"{API}/{MALAGA_ID}/horarios_origen_destino"
               f"?idNucleoOrigen={NUCLEO_COIN}&idNucleoDestino={NUCLEO_ALHAURIN}")
        r = requests.get(url, timeout=15)
        assert r.status_code == 200
        data = r.json()

        # Top-level keys
        for key in ("bloques", "horario", "frecuencias", "nucleos"):
            assert key in data, f"Missing key: {key}"

        # Frequency codes seen in real data
        acronimos = {f["acronimo"] for f in data["frecuencias"]}
        assert "L-V" in acronimos,    "Expected L-V (Mon–Fri) frequency"
        assert "lslab" in acronimos,  "Expected lslab (Mon–Sat) frequency"

        # nucleos column layout: 1 col (lines) + 2 cols (Coín) + 3 cols (Alhaurín)
        spans = [n["colspan"] for n in data["nucleos"]]
        assert spans[0] == 1, "First nucleos entry should be 1-col line header"
        assert spans[1] == 2, "Coín should have 2 columns"
        assert spans[2] == 3, "Alhaurín el Grande should have 3 columns"

        # Should have at least a few trips
        assert len(data["horario"]) >= 3

    def test_planner_coin_to_alhaurin_known_trip(self):
        """M-230 should run Mon–Fri departing Coín at 06:20."""
        url = (f"{API}/{MALAGA_ID}/horarios_origen_destino"
               f"?idNucleoOrigen={NUCLEO_COIN}&idNucleoDestino={NUCLEO_ALHAURIN}")
        data = requests.get(url, timeout=15).json()
        m230 = next((h for h in data["horario"] if h["codigo"] == "M-230"), None)
        assert m230 is not None, "M-230 not found in Coín→Alhaurín timetable"
        assert m230["dias"] == "L-V"
        # horas[0] is line label col; origin departure starts at index 1 or 2
        horas = m230["horas"]
        actual_times = [h for h in horas if re.match(r"\d{2}:\d{2}", h)]
        assert "06:20" in actual_times, f"Expected 06:20 departure, got {actual_times}"

    def test_malaga_to_fuengirola_has_trips(self):
        url = (f"{API}/{MALAGA_ID}/horarios_origen_destino"
               f"?idNucleoOrigen={NUCLEO_MALAGA}&idNucleoDestino={NUCLEO_FUENGIROLA}")
        r = requests.get(url, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert len(data.get("horario", [])) >= 5, "Expected multiple Málaga→Fuengirola trips"


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — UI TESTS (Playwright)
# ══════════════════════════════════════════════════════════════════════════════

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


class TestHomeUI:
    def test_title_and_cards_visible(self, page):
        page.goto(f"{BASE_URL}/home.html", timeout=TIMEOUT)
        expect(page.locator("#app-title")).to_be_visible()
        expect(page.locator("#feat-timetable")).to_contain_text("Live Departures")
        expect(page.locator("#feat-planner")).to_contain_text("Route Planner")
        expect(page.locator("#feat-map")).to_contain_text("Stop Map")

    def test_greeting_present(self, page):
        page.goto(f"{BASE_URL}/home.html", timeout=TIMEOUT)
        greeting = page.locator("#home-greeting").text_content()
        assert greeting in ("Good morning", "Good afternoon", "Good evening")

    def test_language_toggle(self, page):
        page.goto(f"{BASE_URL}/home.html", timeout=TIMEOUT)
        page.locator("#lang-toggle").click()
        expect(page.locator("#app-title")).to_contain_text("Rastreador")
        expect(page.locator("#feat-timetable")).to_contain_text("Salidas")
        # Switch back
        page.locator("#lang-toggle").click()
        expect(page.locator("#app-title")).to_contain_text("Bus Tracker")

    def test_live_departures_link(self, page):
        page.goto(f"{BASE_URL}/home.html", timeout=TIMEOUT)
        page.locator("a[href='index.html']").first.click()
        page.wait_for_url(f"**/index.html", timeout=TIMEOUT)

    def test_stop_map_link(self, page):
        page.goto(f"{BASE_URL}/home.html", timeout=TIMEOUT)
        page.locator("a[href='map.html']").click()
        page.wait_for_url(f"**/map.html", timeout=TIMEOUT)

    def test_planner_link(self, page):
        page.goto(f"{BASE_URL}/home.html", timeout=TIMEOUT)
        page.locator("a[href='planner.html']").click()
        page.wait_for_url(f"**/planner.html", timeout=TIMEOUT)


class TestStopSelectorUI:
    def test_regions_load(self, page):
        page.goto(f"{BASE_URL}/index.html", timeout=TIMEOUT)
        # Wait for region cards to appear (API call) — class is "card consortium-card"
        expect(page.locator(".consortium-card").first).to_be_visible(timeout=TIMEOUT)
        count = page.locator(".consortium-card").count()
        assert count == 9, f"Expected 9 region cards, got {count}"

    def test_select_malaga_shows_search(self, page):
        page.goto(f"{BASE_URL}/index.html", timeout=TIMEOUT)
        expect(page.locator(".consortium-card").first).to_be_visible(timeout=TIMEOUT)
        page.locator(".consortium-card").filter(has_text="Málaga").click()
        expect(page.locator("#stop-search")).to_be_visible(timeout=TIMEOUT)

    def _select_malaga_and_wait_stops(self, page):
        """Helper: select Málaga and wait until stops are loaded."""
        page.goto(f"{BASE_URL}/index.html", timeout=TIMEOUT)
        expect(page.locator(".consortium-card").first).to_be_visible(timeout=TIMEOUT)
        page.locator(".consortium-card").filter(has_text="Málaga").click()
        # step-stop becomes visible; wait for the hint paragraph (stops loaded)
        expect(page.locator("#step-stop")).not_to_have_class("hidden", timeout=20_000)
        # Wait until stop-list has real content (hint text replaces spinner)
        page.wait_for_function(
            "document.getElementById('stop-list').querySelector('.loading-spinner') === null",
            timeout=20_000
        )

    def test_stop_search_filters(self, page):
        self._select_malaga_and_wait_stops(page)
        page.locator("#stop-search").fill("muelle")
        page.wait_for_timeout(400)   # debounce
        results = page.locator("#stop-list .card")
        assert results.count() >= 1
        expect(results.first).to_contain_text("Muelle", ignore_case=True)

    def test_stop_navigates_to_station(self, page):
        self._select_malaga_and_wait_stops(page)
        page.locator("#stop-search").fill("Muelle Heredia")
        page.wait_for_timeout(400)
        page.locator("#stop-list .card").first.click()
        page.wait_for_url("**/station.html**", timeout=TIMEOUT)
        assert "c=4" in page.url
        assert "s=" in page.url


class TestStationUI:
    def _station_url(self):
        return f"{BASE_URL}/station.html?c={MALAGA_ID}&s={STOP_MUELLE}"

    def test_stop_name_loads(self, page):
        page.goto(self._station_url(), timeout=TIMEOUT)
        # Wait until name is no longer the default "Loading…" text
        page.wait_for_function(
            "document.getElementById('station-name').textContent.trim() !== 'Loading…'",
            timeout=TIMEOUT
        )
        name = page.locator("#station-name").text_content(timeout=TIMEOUT)
        assert "Muelle" in name, f"Unexpected stop name: {name}"

    def test_station_meta_shows_zone(self, page):
        page.goto(self._station_url(), timeout=TIMEOUT)
        # Wait for stop info to load
        expect(page.locator("#station-meta")).not_to_be_empty(timeout=TIMEOUT)
        meta = page.locator("#station-meta").text_content()
        assert "Zone A" in meta or "Zona A" in meta, f"Zone not in meta: {meta}"

    def test_departures_or_no_service_shown(self, page):
        page.goto(self._station_url(), timeout=TIMEOUT)
        # Either departure cards appear OR the no-service message appears
        page.wait_for_selector(
            ".departure-card, #no-service:not(.hidden)",
            timeout=30_000
        )

    def test_countdown_visible(self, page):
        page.goto(self._station_url(), timeout=TIMEOUT)
        expect(page.locator("#countdown")).to_be_visible()
        text = page.locator("#countdown").text_content(timeout=TIMEOUT)
        assert "30" in text or "29" in text or "Refresh" in text or "Actualizar" in text

    def test_countdown_decrements(self, page):
        page.goto(self._station_url(), timeout=TIMEOUT)
        page.wait_for_selector(".departure-card, #no-service:not(.hidden)", timeout=30_000)
        first = page.locator("#countdown").text_content()
        page.wait_for_timeout(2500)
        second = page.locator("#countdown").text_content()
        assert first != second, "Countdown did not decrement"

    def test_live_clock_ticks(self, page):
        page.goto(self._station_url(), timeout=TIMEOUT)
        t1 = page.locator("#live-clock").text_content(timeout=TIMEOUT)
        page.wait_for_timeout(1500)
        t2 = page.locator("#live-clock").text_content()
        assert t1 != t2, "Live clock is not ticking"

    def test_back_button_href(self, page):
        page.goto(self._station_url(), timeout=TIMEOUT)
        href = page.locator("#back-btn").get_attribute("href")
        assert href == "index.html"

    def test_back_button_with_from_param(self, page):
        url = f"{BASE_URL}/station.html?c={MALAGA_ID}&s={STOP_MUELLE}&from=map.html"
        page.goto(url, timeout=TIMEOUT)
        href = page.locator("#back-btn").get_attribute("href")
        assert href == "map.html"

    def test_missing_params_redirect(self, page):
        page.goto(f"{BASE_URL}/station.html", timeout=TIMEOUT)
        page.wait_for_url("**/index.html", timeout=TIMEOUT)

    def test_silent_refresh_no_spinner(self, page):
        """Background refresh must not flash a loading spinner."""
        page.goto(self._station_url(), timeout=TIMEOUT)
        # Wait for initial content to appear
        page.wait_for_selector(".departure-card, #no-service:not(.hidden)", timeout=30_000)

        # Inject a MutationObserver that flags any spinner appearing in departures-board
        page.evaluate("""
            () => {
                window._spinnerFlashed = false;
                const obs = new MutationObserver(() => {
                    const s = document.querySelector('#departures-board .loading-spinner');
                    if (s) window._spinnerFlashed = true;
                });
                obs.observe(document.getElementById('departures-board'),
                            { childList: true, subtree: true });
                window._spinnerObs = obs;
            }
        """)

        # Wait 35 seconds (just past one 30 s refresh cycle)
        page.wait_for_timeout(35_000)

        spinner_appeared = page.evaluate("() => window._spinnerFlashed")
        page.evaluate("() => window._spinnerObs.disconnect()")

        assert not spinner_appeared, "Spinner appeared during silent background refresh"

    def test_language_toggle_no_api_call(self, page):
        """Toggling language re-renders from cache — no new API fetch."""
        page.goto(self._station_url(), timeout=TIMEOUT)
        page.wait_for_selector(".departure-card, #no-service:not(.hidden)", timeout=30_000)

        requests_made = []
        page.on("request", lambda r: requests_made.append(r.url) if "servicios" in r.url else None)

        page.locator("#lang-toggle").click()
        page.wait_for_timeout(500)

        assert len(requests_made) == 0, "Language toggle triggered an API call"


class TestRouteUI:
    def test_route_page_loads(self, page):
        url = (f"{BASE_URL}/route.html?c={MALAGA_ID}&l=1&s={STOP_MUELLE}"
               f"&code=M-110&dest=Torremolinos&sentido=1")
        page.goto(url, timeout=TIMEOUT)
        expect(page.locator(".stop-card, .route-stop-card").first).to_be_visible(timeout=TIMEOUT)

    def test_current_stop_highlighted(self, page):
        url = (f"{BASE_URL}/route.html?c={MALAGA_ID}&l=1&s={STOP_MUELLE}"
               f"&code=M-110&dest=Torremolinos&sentido=1")
        page.goto(url, timeout=TIMEOUT)
        page.wait_for_selector(".stop-card, .route-stop-card", timeout=TIMEOUT)
        # The active/current stop marker ("●") should be visible somewhere
        content = page.content()
        assert "●" in content or "current" in content.lower()

    def test_back_button_from_param(self, page):
        from_url = f"{BASE_URL}/station.html?c=4&s=149"
        import urllib.parse
        encoded = urllib.parse.quote(from_url, safe="")
        url = (f"{BASE_URL}/route.html?c={MALAGA_ID}&l=1&s={STOP_MUELLE}"
               f"&code=M-110&dest=Torremolinos&sentido=1&from={encoded}")
        page.goto(url, timeout=TIMEOUT)
        href = page.locator("#back-btn, .back-btn, .back-link").first.get_attribute("href")
        assert "station.html" in href


class TestPlannerUI:
    def _load_malaga(self, page):
        """Helper: open planner and select Málaga region."""
        page.goto(f"{BASE_URL}/planner.html", timeout=TIMEOUT)
        # Region cards have class "card" inside #planner-region-list
        expect(page.locator("#planner-region-list .card").first).to_be_visible(timeout=TIMEOUT)
        page.locator("#planner-region-list .card").filter(has_text="Málaga").click()
        expect(page.locator("#from-input")).to_be_visible(timeout=TIMEOUT)

    def test_regions_load(self, page):
        page.goto(f"{BASE_URL}/planner.html", timeout=TIMEOUT)
        expect(page.locator("#planner-region-list .card").first).to_be_visible(timeout=TIMEOUT)
        count = page.locator("#planner-region-list .card").count()
        assert count == 9, f"Expected 9 region cards, got {count}"

    def test_select_region_shows_form(self, page):
        self._load_malaga(page)
        expect(page.locator("#from-input")).to_be_visible(timeout=TIMEOUT)
        expect(page.locator("#to-input")).to_be_visible(timeout=TIMEOUT)

    def test_search_button_disabled_until_both_selected(self, page):
        self._load_malaga(page)
        disabled = page.locator("#search-btn").get_attribute("disabled")
        assert disabled is not None, "Search button should be disabled initially"

    def test_coin_to_alhaurin_search(self, page):
        self._load_malaga(page)

        # Type in From — dropdown items use class "planner-dropdown-item"
        page.locator("#from-input").fill("Coin")
        # Wait until dropdown has at least one visible item
        expect(page.locator("#from-results .planner-dropdown-item").first).to_be_visible(timeout=TIMEOUT)
        # Click the item whose text is "Coín"
        page.locator("#from-results .planner-dropdown-item").filter(
            has=page.locator("text=Coín")
        ).first.click()

        # Type in To
        page.locator("#to-input").fill("Alhaurin el Grande")
        expect(page.locator("#to-results .planner-dropdown-item").first).to_be_visible(timeout=TIMEOUT)
        page.locator("#to-results .planner-dropdown-item").first.click()

        # Search button should now be enabled
        page.wait_for_function(
            "document.getElementById('search-btn').disabled === false",
            timeout=TIMEOUT
        )
        page.locator("#search-btn").click()

        # Results step becomes visible and cards are rendered
        page.wait_for_function(
            "!document.getElementById('step-results').classList.contains('hidden')",
            timeout=20_000
        )
        # Wait for spinner to disappear (results loaded)
        page.wait_for_function(
            "document.getElementById('results-list').querySelector('.loading-spinner') === null",
            timeout=20_000
        )
        count = page.locator("#results-list .card").count()
        assert count >= 1, "Expected at least one result for Coín → Alhaurín"

    def test_dropdown_no_gap(self, page):
        """Dropdown should visually attach to the input (no gap)."""
        self._load_malaga(page)
        page.locator("#from-input").fill("Mal")
        page.wait_for_selector("#from-results:not(.hidden)", timeout=TIMEOUT)

        input_box = page.locator("#from-input").bounding_box()
        dropdown  = page.locator("#from-results").bounding_box()
        # Dropdown top should be within 2px of input bottom
        gap = abs(dropdown["y"] - (input_box["y"] + input_box["height"]))
        assert gap <= 2, f"Gap between input and dropdown is {gap}px"

    def test_state_restored_from_url(self, page):
        """Loading planner.html?c=4&fromN=201&toN=83 should show results directly."""
        url = f"{BASE_URL}/planner.html?c={MALAGA_ID}&fromN={NUCLEO_COIN}&toN={NUCLEO_ALHAURIN}"
        page.goto(url, timeout=TIMEOUT)
        page.wait_for_selector(".planner-result-card, .departure-card", timeout=30_000)
        count = page.locator(".planner-result-card, .departure-card").count()
        assert count >= 1


class TestMapUI:
    def test_region_overlay_shown_on_load(self, page):
        page.goto(f"{BASE_URL}/map.html", timeout=TIMEOUT)
        expect(page.locator("#region-overlay")).to_be_visible(timeout=TIMEOUT)
        expect(page.locator("#map-container")).not_to_be_visible()

    def test_region_list_loads(self, page):
        page.goto(f"{BASE_URL}/map.html", timeout=TIMEOUT)
        expect(page.locator(".map-overlay-item").first).to_be_visible(timeout=TIMEOUT)
        count = page.locator(".map-overlay-item").count()
        assert count == 9

    def test_select_region_hides_overlay(self, page):
        page.goto(f"{BASE_URL}/map.html", timeout=TIMEOUT)
        expect(page.locator(".map-overlay-item").first).to_be_visible(timeout=TIMEOUT)
        page.locator(".map-overlay-item").filter(has_text="Málaga").click()
        expect(page.locator("#region-overlay")).not_to_be_visible(timeout=TIMEOUT)
        expect(page.locator("#map-container")).to_be_visible(timeout=TIMEOUT)

    def test_map_renders_tiles(self, page):
        page.goto(f"{BASE_URL}/map.html", timeout=TIMEOUT)
        expect(page.locator(".map-overlay-item").first).to_be_visible(timeout=TIMEOUT)
        page.locator(".map-overlay-item").filter(has_text="Málaga").click()
        # Wait for Leaflet container to be visible
        expect(page.locator("#map-container")).to_be_visible(timeout=TIMEOUT)
        # Wait for markers layer so we know map fully initialised
        page.wait_for_selector(".map-stop-dot", timeout=20_000)
        # Verify the leaflet-map div has real dimensions
        box = page.locator("#leaflet-map").bounding_box()
        assert box is not None and box["width"] > 100 and box["height"] > 100, \
            "Map has no visible size"

    def test_stop_markers_appear(self, page):
        page.goto(f"{BASE_URL}/map.html", timeout=TIMEOUT)
        expect(page.locator(".map-overlay-item").first).to_be_visible(timeout=TIMEOUT)
        page.locator(".map-overlay-item").filter(has_text="Málaga").click()
        # Wait for markers (our custom div icons)
        page.wait_for_selector(".map-stop-dot", timeout=20_000)
        count = page.locator(".map-stop-dot").count()
        assert count > 50, f"Expected many stop markers, got {count}"

    def test_popup_button_has_white_text(self, page):
        page.goto(f"{BASE_URL}/map.html", timeout=TIMEOUT)
        expect(page.locator(".map-overlay-item").first).to_be_visible(timeout=TIMEOUT)
        page.locator(".map-overlay-item").filter(has_text="Málaga").click()
        page.wait_for_selector(".map-stop-dot", timeout=20_000)
        # Click the first visible marker
        page.locator(".map-stop-dot").first.click()
        page.wait_for_selector(".map-popup-btn", timeout=TIMEOUT)
        color = page.eval_on_selector(
            ".map-popup-btn",
            "el => window.getComputedStyle(el).color"
        )
        # rgb(255, 255, 255) = white
        assert color == "rgb(255, 255, 255)", f"Popup button text is not white: {color}"

    def test_region_pill_visible_after_load(self, page):
        page.goto(f"{BASE_URL}/map.html", timeout=TIMEOUT)
        expect(page.locator(".map-overlay-item").first).to_be_visible(timeout=TIMEOUT)
        page.locator(".map-overlay-item").filter(has_text="Málaga").click()
        expect(page.locator("#region-btn")).to_be_visible(timeout=TIMEOUT)
        expect(page.locator("#region-pill-name")).to_contain_text("Málaga")

    def test_region_pill_reopens_overlay(self, page):
        page.goto(f"{BASE_URL}/map.html", timeout=TIMEOUT)
        expect(page.locator(".map-overlay-item").first).to_be_visible(timeout=TIMEOUT)
        page.locator(".map-overlay-item").filter(has_text="Málaga").click()
        expect(page.locator("#region-btn")).to_be_visible(timeout=TIMEOUT)
        page.locator("#region-btn").click()
        expect(page.locator("#region-overlay")).to_be_visible(timeout=TIMEOUT)


# ══════════════════════════════════════════════════════════════════════════════
# ENTRYPOINT
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    sys.exit(pytest.main([
        __file__,
        "-v",
        "--tb=short",
        "--no-header",
        "-p", "no:warnings",
    ]))
