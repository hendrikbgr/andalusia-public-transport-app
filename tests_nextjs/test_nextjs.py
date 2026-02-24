"""
Next.js migration — End-to-End Tests
--------------------------------------
Tests the Next.js app at http://localhost:3000 (or NX_BASE_URL env var).

Prerequisites:
  cd nextjs && npm run dev   (or npm run build && npm start)

Run:
  pytest tests/test_nextjs.py -v
  pytest tests/test_nextjs.py -v -k "home"      # single class
  pytest tests/test_nextjs.py -v --run-network   # include network-marked tests

These tests mirror the original tests/test_app.py suite but target the
Next.js routes (/stops, /station, /route, /map, /planner, /settings, etc.)
instead of the .html files.

All UI tests are marked @pytest.mark.network because they require:
  1. The Next.js dev/prod server to be running
  2. The CTAN API to be reachable (same as the original network tests)
"""

import os
import urllib.parse

import pytest
from playwright.sync_api import sync_playwright, expect

# ── Config ─────────────────────────────────────────────────────────────────────
NX_BASE = os.environ.get("NX_BASE_URL", "http://localhost:3000").rstrip("/")
TIMEOUT  = 20_000   # ms

MALAGA_ID   = "4"
STOP_MUELLE = "149"   # Terminal Muelle Heredia
NUCLEO_COIN     = "201"
NUCLEO_ALHAURIN = "83"


# ── Shared fixtures ─────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def nx_browser_ctx():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context()
        yield ctx
        browser.close()


@pytest.fixture()
def nx_page(nx_browser_ctx):
    pg = nx_browser_ctx.new_page()
    yield pg
    pg.close()


# ── Helper ──────────────────────────────────────────────────────────────────────
def go(page, path, **kwargs):
    """Navigate to a Next.js route."""
    page.goto(f"{NX_BASE}{path}", timeout=TIMEOUT, **kwargs)


# ══════════════════════════════════════════════════════════════════════════════
# Home page  /
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.network
class TestNextHomeUI:
    def test_title_visible(self, nx_page):
        go(nx_page, "/")
        # h1 inside the header should say "Bus Tracker" (EN default)
        expect(nx_page.locator("h1").first).to_contain_text("Bus Tracker")

    def test_greeting_present(self, nx_page):
        go(nx_page, "/")
        greeting = nx_page.locator(".home-greeting").text_content(timeout=TIMEOUT)
        assert any(w in greeting for w in ("morning", "afternoon", "evening",
                                            "mañana", "tarde", "noche")), \
            f"Unexpected greeting: {greeting!r}"

    def test_feature_cards_visible(self, nx_page):
        go(nx_page, "/")
        # All six home feature cards should be present
        cards = nx_page.locator(".home-feature-card")
        assert cards.count() >= 4, f"Expected ≥4 feature cards, got {cards.count()}"

    def test_live_departures_card_links_to_stops(self, nx_page):
        go(nx_page, "/")
        link = nx_page.locator(".home-feature-card[href='/stops']")
        expect(link).to_be_visible()

    def test_map_card_links_to_map(self, nx_page):
        go(nx_page, "/")
        expect(nx_page.locator(".home-feature-card[href='/map']")).to_be_visible()

    def test_language_toggle_switches_to_es(self, nx_page):
        go(nx_page, "/")
        nx_page.locator(".lang-toggle").click()
        expect(nx_page.locator("h1").first).to_contain_text("Rastreador")

    def test_language_toggle_switches_back_to_en(self, nx_page):
        go(nx_page, "/")
        # Ensure we start in EN (cookie may carry over from previous test)
        title = nx_page.locator("h1").first.text_content(timeout=TIMEOUT)
        if "Rastreador" in title:
            nx_page.locator(".lang-toggle").click()  # ES → EN
        expect(nx_page.locator("h1").first).to_contain_text("Bus Tracker")

    def test_navigate_to_stops_page(self, nx_page):
        go(nx_page, "/")
        nx_page.locator(".home-feature-card[href='/stops']").click()
        nx_page.wait_for_url(f"{NX_BASE}/stops", timeout=TIMEOUT)

    def test_navigate_to_map_page(self, nx_page):
        go(nx_page, "/")
        nx_page.locator(".home-feature-card[href='/map']").click()
        nx_page.wait_for_url(f"{NX_BASE}/map", timeout=TIMEOUT)

    def test_navigate_to_planner_page(self, nx_page):
        go(nx_page, "/")
        nx_page.locator(".home-feature-card[href='/planner']").click()
        nx_page.wait_for_url(f"{NX_BASE}/planner", timeout=TIMEOUT)

    def test_settings_link_in_header(self, nx_page):
        go(nx_page, "/")
        # Settings link should be in the header
        settings_link = nx_page.locator("a[href='/settings']")
        expect(settings_link).to_be_visible()
        settings_link.click()
        nx_page.wait_for_url(f"{NX_BASE}/settings", timeout=TIMEOUT)


# ══════════════════════════════════════════════════════════════════════════════
# Stops page  /stops
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.network
class TestNextStopsUI:
    def test_region_cards_load(self, nx_page):
        go(nx_page, "/stops")
        expect(nx_page.locator(".consortium-card").first).to_be_visible(timeout=TIMEOUT)
        count = nx_page.locator(".consortium-card").count()
        assert count == 9, f"Expected 9 region cards, got {count}"

    def test_select_malaga_shows_search(self, nx_page):
        go(nx_page, "/stops")
        expect(nx_page.locator(".consortium-card").first).to_be_visible(timeout=TIMEOUT)
        nx_page.locator(".consortium-card").filter(has_text="Málaga").click()
        expect(nx_page.locator(".stop-search, #stop-search")).to_be_visible(timeout=TIMEOUT)

    def _load_malaga_stops(self, page):
        go(page, "/stops")
        expect(page.locator(".consortium-card").first).to_be_visible(timeout=TIMEOUT)
        page.locator(".consortium-card").filter(has_text="Málaga").click()
        # Wait for stop search to appear
        expect(page.locator(".stop-search, #stop-search")).to_be_visible(timeout=TIMEOUT)
        # Wait until stop-list has real content (spinner gone)
        page.wait_for_function(
            """() => {
                const list = document.querySelector('#stop-list, .card-list');
                return list && !list.querySelector('.loading-spinner');
            }""",
            timeout=25_000,
        )

    def test_stop_search_filters_results(self, nx_page):
        self._load_malaga_stops(nx_page)
        nx_page.locator(".stop-search, #stop-search").fill("muelle")
        nx_page.wait_for_timeout(400)
        results = nx_page.locator(".card")
        assert results.count() >= 1
        expect(results.first).to_contain_text("Muelle", ignore_case=True)

    def test_stop_card_navigates_to_station(self, nx_page):
        self._load_malaga_stops(nx_page)
        nx_page.locator(".stop-search, #stop-search").fill("Muelle Heredia")
        nx_page.wait_for_timeout(400)
        nx_page.locator(".card").first.click()
        nx_page.wait_for_url("**/station**", timeout=TIMEOUT)
        assert "c=4" in nx_page.url
        assert "s=" in nx_page.url

    def test_set_default_region_button_visible(self, nx_page):
        go(nx_page, "/stops")
        expect(nx_page.locator(".consortium-card").first).to_be_visible(timeout=TIMEOUT)
        # Each consortium card should have a set-default-btn
        expect(nx_page.locator(".set-default-btn").first).to_be_visible(timeout=TIMEOUT)

    def test_back_link_points_to_home(self, nx_page):
        go(nx_page, "/stops")
        back = nx_page.locator(".back-link, a[href='/']").first
        href = back.get_attribute("href")
        assert href in ("/", None) or href.endswith("/"), \
            f"Back link href unexpected: {href!r}"


# ══════════════════════════════════════════════════════════════════════════════
# Station page  /station
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.network
class TestNextStationUI:
    def _station_url(self):
        return f"/station?c={MALAGA_ID}&s={STOP_MUELLE}"

    def test_station_name_loads(self, nx_page):
        go(nx_page, self._station_url())
        # Header h1 should eventually contain the real stop name (not the "Stop NNN" fallback)
        nx_page.wait_for_function(
            "document.querySelector('h1') && "
            "document.querySelector('h1').textContent.trim().length > 0 && "
            "!/^Stop \\d/.test(document.querySelector('h1').textContent.trim())",
            timeout=TIMEOUT,
        )
        name = nx_page.locator("h1").first.text_content()
        assert "Muelle" in name, f"Unexpected stop name: {name!r}"

    def test_station_meta_shows_zone(self, nx_page):
        go(nx_page, self._station_url())
        expect(nx_page.locator("#station-meta")).not_to_be_empty(timeout=TIMEOUT)
        meta = nx_page.locator("#station-meta").text_content()
        assert "Zone A" in meta or "Zona A" in meta, f"Zone not in meta: {meta!r}"

    def test_departures_or_no_service_shown(self, nx_page):
        go(nx_page, self._station_url())
        nx_page.wait_for_selector(
            ".departure-card, .no-service",
            timeout=35_000,
        )

    def test_live_clock_ticks(self, nx_page):
        go(nx_page, self._station_url())
        t1 = nx_page.locator("#live-clock").text_content(timeout=TIMEOUT)
        nx_page.wait_for_timeout(1500)
        t2 = nx_page.locator("#live-clock").text_content()
        assert t1 != t2, f"Live clock not ticking: {t1!r} == {t2!r}"

    def test_live_label_visible(self, nx_page):
        go(nx_page, self._station_url())
        expect(nx_page.locator(".live-label, #live-label")).to_be_visible(timeout=TIMEOUT)

    def test_action_buttons_present(self, nx_page):
        go(nx_page, self._station_url())
        # save-stop, refresh, QR buttons
        expect(nx_page.locator(".action-btn").first).to_be_visible(timeout=TIMEOUT)
        assert nx_page.locator(".action-btn").count() >= 2

    def test_qr_modal_opens_and_closes(self, nx_page):
        go(nx_page, self._station_url())
        expect(nx_page.locator(".action-btn").first).to_be_visible(timeout=TIMEOUT)
        # Click QR toggle button
        nx_page.locator(".qr-toggle, button:has-text('QR')").click()
        expect(nx_page.locator(".qr-overlay")).to_be_visible(timeout=TIMEOUT)
        # Close it
        nx_page.locator(".qr-close, .qr-close-btn").first.click()
        expect(nx_page.locator(".qr-overlay")).not_to_be_visible(timeout=TIMEOUT)

    def test_missing_params_redirects_to_stops(self, nx_page):
        go(nx_page, "/station")
        nx_page.wait_for_url(f"{NX_BASE}/stops", timeout=TIMEOUT)

    def test_back_link_defaults_to_stops(self, nx_page):
        go(nx_page, self._station_url())
        back_href = nx_page.locator(".back-link").get_attribute("href")
        # When no `from` param, back should point to /stops
        assert back_href == "/stops", f"Back href: {back_href!r}"

    def test_back_link_respects_from_param(self, nx_page):
        go(nx_page, f"/station?c={MALAGA_ID}&s={STOP_MUELLE}&from=%2Fmap")
        back_href = nx_page.locator(".back-link").get_attribute("href")
        assert "/map" in back_href, f"Back href: {back_href!r}"

    def test_departure_card_navigates_to_route(self, nx_page):
        go(nx_page, self._station_url())
        nx_page.wait_for_selector(".departure-card", timeout=35_000)
        nx_page.locator(".departure-card").first.click()
        nx_page.wait_for_url("**/route**", timeout=TIMEOUT)
        assert "c=" in nx_page.url
        assert "l=" in nx_page.url


# ══════════════════════════════════════════════════════════════════════════════
# Route page  /route
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.network
class TestNextRouteUI:
    def _route_url(self):
        return (f"/route?c={MALAGA_ID}&l=1&s={STOP_MUELLE}"
                f"&code=M-110&dest=Torremolinos&sentido=1")

    def test_route_page_loads(self, nx_page):
        go(nx_page, self._route_url())
        expect(nx_page.locator(".route-stop-card").first).to_be_visible(timeout=TIMEOUT)

    def test_route_title_shows_code(self, nx_page):
        go(nx_page, self._route_url())
        h1_text = nx_page.locator("h1").first.text_content(timeout=TIMEOUT)
        assert "M-110" in h1_text or "Torremolinos" in h1_text, \
            f"Route title unexpected: {h1_text!r}"

    def test_route_meta_subtitle_visible(self, nx_page):
        go(nx_page, self._route_url())
        expect(nx_page.locator(".route-stop-card").first).to_be_visible(timeout=TIMEOUT)
        # The route line name should appear somewhere on page
        content = nx_page.content()
        assert "Torremolinos" in content or "Benalm" in content

    def test_current_stop_highlighted(self, nx_page):
        go(nx_page, self._route_url())
        nx_page.wait_for_selector(".route-stop-card", timeout=TIMEOUT)
        # Check for highlighted/current stop class
        current = nx_page.locator(".route-stop-current")
        assert current.count() >= 1, "No current-stop card found"

    def test_action_buttons_present(self, nx_page):
        go(nx_page, self._route_url())
        expect(nx_page.locator(".route-actions").first).to_be_visible(timeout=TIMEOUT)
        # Should have at least the timetable link button
        btns = nx_page.locator(".route-actions .action-btn")
        assert btns.count() >= 1

    def test_timetable_action_links_correctly(self, nx_page):
        go(nx_page, self._route_url())
        expect(nx_page.locator(".route-actions").first).to_be_visible(timeout=TIMEOUT)
        timetable_btn = nx_page.locator(".route-actions .action-btn").first
        href = timetable_btn.get_attribute("href")
        assert href and "/timetable" in href, f"Timetable href: {href!r}"

    def test_back_link_respects_from_param(self, nx_page):
        from_enc = urllib.parse.quote("/station?c=4&s=149", safe="")
        go(nx_page, self._route_url() + f"&from={from_enc}")
        back_href = nx_page.locator(".back-link").get_attribute("href")
        assert "/station" in back_href, f"Back href: {back_href!r}"

    def test_stop_card_click_navigates_to_station(self, nx_page):
        go(nx_page, self._route_url())
        nx_page.wait_for_selector(".route-stop-card", timeout=TIMEOUT)
        # Click a non-current stop
        non_current = nx_page.locator(".route-stop-card:not(.route-stop-current)").first
        non_current.click()
        nx_page.wait_for_url("**/station**", timeout=TIMEOUT)
        assert "c=" in nx_page.url


# ══════════════════════════════════════════════════════════════════════════════
# Map page  /map
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.network
class TestNextMapUI:
    def test_region_overlay_shown_without_params(self, nx_page):
        go(nx_page, "/map")
        expect(nx_page.locator(".map-region-overlay")).to_be_visible(timeout=TIMEOUT)

    def test_region_overlay_lists_9_consortiums(self, nx_page):
        go(nx_page, "/map")
        expect(nx_page.locator(".map-overlay-item").first).to_be_visible(timeout=TIMEOUT)
        count = nx_page.locator(".map-overlay-item").count()
        assert count == 9, f"Expected 9 region items, got {count}"

    def test_select_region_hides_overlay(self, nx_page):
        go(nx_page, "/map")
        expect(nx_page.locator(".map-overlay-item").first).to_be_visible(timeout=TIMEOUT)
        nx_page.locator(".map-overlay-item").filter(has_text="Málaga").click()
        expect(nx_page.locator(".map-region-overlay")).not_to_be_visible(timeout=TIMEOUT)

    def test_leaflet_map_renders(self, nx_page):
        go(nx_page, "/map")
        expect(nx_page.locator(".map-overlay-item").first).to_be_visible(timeout=TIMEOUT)
        nx_page.locator(".map-overlay-item").filter(has_text="Málaga").click()
        # Wait for stop markers to appear
        nx_page.wait_for_selector(".map-stop-dot", timeout=25_000)
        box = nx_page.locator("#leaflet-map").bounding_box()
        assert box and box["width"] > 100 and box["height"] > 100, \
            "Leaflet map has no visible size"

    def test_stop_markers_appear(self, nx_page):
        go(nx_page, "/map")
        expect(nx_page.locator(".map-overlay-item").first).to_be_visible(timeout=TIMEOUT)
        nx_page.locator(".map-overlay-item").filter(has_text="Málaga").click()
        nx_page.wait_for_selector(".map-stop-dot", timeout=25_000)
        count = nx_page.locator(".map-stop-dot").count()
        assert count > 50, f"Expected many stop markers, got {count}"

    def test_region_pill_visible_after_selection(self, nx_page):
        go(nx_page, "/map")
        expect(nx_page.locator(".map-overlay-item").first).to_be_visible(timeout=TIMEOUT)
        nx_page.locator(".map-overlay-item").filter(has_text="Málaga").click()
        expect(nx_page.locator(".map-region-pill")).to_be_visible(timeout=TIMEOUT)
        expect(nx_page.locator(".map-region-pill")).to_contain_text("Málaga")

    def test_map_loaded_directly_with_c_param(self, nx_page):
        go(nx_page, f"/map?c={MALAGA_ID}")
        # With c= param, overlay should NOT appear — map should load directly
        nx_page.wait_for_selector(".map-stop-dot", timeout=25_000)
        expect(nx_page.locator(".map-region-overlay")).not_to_be_visible()

    def test_popup_opens_on_marker_click(self, nx_page):
        go(nx_page, f"/map?c={MALAGA_ID}")
        nx_page.wait_for_selector(".map-stop-dot", timeout=25_000)
        nx_page.locator(".map-stop-dot").first.click()
        nx_page.wait_for_selector(".map-popup", timeout=TIMEOUT)
        expect(nx_page.locator(".map-popup")).to_be_visible()

    def test_popup_view_departures_link(self, nx_page):
        go(nx_page, f"/map?c={MALAGA_ID}")
        nx_page.wait_for_selector(".map-stop-dot", timeout=25_000)
        nx_page.locator(".map-stop-dot").first.click()
        nx_page.wait_for_selector(".map-popup-btn", timeout=TIMEOUT)
        href = nx_page.locator(".map-popup-btn").get_attribute("href")
        assert href and "/station" in href, f"Popup btn href: {href!r}"


# ══════════════════════════════════════════════════════════════════════════════
# Planner page  /planner
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.network
class TestNextPlannerUI:
    def _load_malaga(self, page):
        go(page, "/planner")
        expect(page.locator(".card").first).to_be_visible(timeout=TIMEOUT)
        page.locator(".card").filter(has_text="Málaga").click()
        # Form step should be visible
        expect(page.locator("#from-input, .planner-input").first).to_be_visible(timeout=TIMEOUT)

    def test_region_cards_load(self, nx_page):
        go(nx_page, "/planner")
        expect(nx_page.locator(".card").first).to_be_visible(timeout=TIMEOUT)
        count = nx_page.locator(".card").count()
        assert count >= 9, f"Expected ≥9 region cards, got {count}"

    def test_select_region_shows_form(self, nx_page):
        self._load_malaga(nx_page)
        expect(nx_page.locator("#from-input, .planner-input").first).to_be_visible(timeout=TIMEOUT)
        expect(nx_page.locator("#to-input")).to_be_visible(timeout=TIMEOUT)

    def test_search_button_disabled_initially(self, nx_page):
        self._load_malaga(nx_page)
        btn = nx_page.locator("#search-btn")
        disabled = btn.get_attribute("disabled")
        assert disabled is not None, "Search button should be disabled until both nucleos selected"

    def test_coin_to_alhaurin_search_shows_results(self, nx_page):
        self._load_malaga(nx_page)

        # From: Coín — use press_sequentially so React onChange fires
        nx_page.locator("#from-input").click()
        nx_page.locator("#from-input").press_sequentially("Coin", delay=50)
        expect(nx_page.locator(".planner-dropdown-item").first).to_be_visible(timeout=TIMEOUT)
        nx_page.locator(".planner-dropdown-item").filter(has_text="Coín").first.click()

        # To: Alhaurín el Grande
        nx_page.locator("#to-input").click()
        nx_page.locator("#to-input").press_sequentially("Alhaurin", delay=50)
        expect(nx_page.locator("#to-results .planner-dropdown-item").first).to_be_visible(timeout=TIMEOUT)
        nx_page.locator("#to-results .planner-dropdown-item").first.click()

        # Search btn enabled
        nx_page.wait_for_function(
            "document.getElementById('search-btn') && "
            "!document.getElementById('search-btn').disabled",
            timeout=TIMEOUT,
        )
        nx_page.locator("#search-btn").click()

        # Wait for results
        nx_page.wait_for_selector(".planner-result-card", timeout=25_000)
        count = nx_page.locator(".planner-result-card").count()
        assert count >= 1, "Expected ≥1 result for Coín → Alhaurín"

    def test_url_restore_shows_results_directly(self, nx_page):
        url = f"/planner?c={MALAGA_ID}&fromN={NUCLEO_COIN}&toN={NUCLEO_ALHAURIN}"
        go(nx_page, url)
        nx_page.wait_for_selector(".planner-result-card, .departure-card", timeout=30_000)
        count = nx_page.locator(".planner-result-card, .departure-card").count()
        assert count >= 1

    def test_swap_button_swaps_inputs(self, nx_page):
        self._load_malaga(nx_page)
        nx_page.locator("#from-input").click()
        nx_page.locator("#from-input").press_sequentially("Coin", delay=50)
        expect(nx_page.locator(".planner-dropdown-item").first).to_be_visible(timeout=TIMEOUT)
        nx_page.locator(".planner-dropdown-item").filter(has_text="Coín").first.click()
        from_val = nx_page.locator("#from-input").input_value()

        nx_page.locator(".swap-btn").click()
        to_val = nx_page.locator("#to-input").input_value()
        assert "oín" in to_val or from_val == to_val, \
            "Swap did not move From value to To field"


# ══════════════════════════════════════════════════════════════════════════════
# Settings page  /settings
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.network
class TestNextSettingsUI:
    def test_settings_page_loads(self, nx_page):
        go(nx_page, "/settings")
        expect(nx_page.locator("h1").first).to_be_visible(timeout=TIMEOUT)
        h1 = nx_page.locator("h1").first.text_content()
        assert "Setting" in h1 or "Ajuste" in h1, f"Unexpected title: {h1!r}"

    def test_language_segmented_control_visible(self, nx_page):
        go(nx_page, "/settings")
        seg_btns = nx_page.locator(".settings-seg-btn")
        assert seg_btns.count() >= 2, "Expected EN/ES seg buttons"
        labels = [seg_btns.nth(i).text_content() for i in range(seg_btns.count())]
        assert "EN" in labels and "ES" in labels, f"Seg buttons: {labels}"

    def test_date_mode_seg_control_visible(self, nx_page):
        go(nx_page, "/settings")
        seg_btns = nx_page.locator(".settings-seg-btn")
        assert seg_btns.count() >= 4, "Expected Today/Tomorrow seg buttons too"

    def test_settings_card_structure(self, nx_page):
        go(nx_page, "/settings")
        # Cards (settings-card) should appear for each section
        cards = nx_page.locator(".settings-card")
        assert cards.count() >= 3, f"Expected ≥3 settings cards, got {cards.count()}"

    def test_language_switch_from_settings(self, nx_page):
        go(nx_page, "/settings")
        # Find the ES button
        es_btn = nx_page.locator(".settings-seg-btn").filter(has_text="ES")
        es_btn.click()
        nx_page.wait_for_timeout(400)
        # Header title should now be in Spanish
        h1 = nx_page.locator("h1").first.text_content()
        assert "Ajuste" in h1 or "Configuración" in h1, f"Title after ES: {h1!r}"
        # Switch back
        nx_page.locator(".settings-seg-btn").filter(has_text="EN").click()
        nx_page.wait_for_timeout(400)

    def test_install_guide_button_opens_modal(self, nx_page):
        go(nx_page, "/settings")
        view_btn = nx_page.locator(".settings-view-btn")
        expect(view_btn).to_be_visible(timeout=TIMEOUT)
        view_btn.click()
        expect(nx_page.locator(".install-guide-overlay")).to_be_visible(timeout=TIMEOUT)

    def test_install_guide_closes(self, nx_page):
        go(nx_page, "/settings")
        nx_page.locator(".settings-view-btn").click()
        expect(nx_page.locator(".install-guide-overlay")).to_be_visible(timeout=TIMEOUT)
        nx_page.locator(".install-guide-close").click()
        expect(nx_page.locator(".install-guide-overlay")).not_to_be_visible(timeout=TIMEOUT)

    def test_github_link_present(self, nx_page):
        go(nx_page, "/settings")
        gh_link = nx_page.locator("a[href*='github.com']")
        expect(gh_link).to_be_visible(timeout=TIMEOUT)
        href = gh_link.get_attribute("href")
        assert "andalusia" in href or "hendrikbgr" in href, f"GH link: {href!r}"


# ══════════════════════════════════════════════════════════════════════════════
# Timetable page  /timetable
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.network
class TestNextTimetableUI:
    def _timetable_url(self):
        return f"/timetable?c={MALAGA_ID}&l=1&code=M-110"

    def test_page_loads(self, nx_page):
        go(nx_page, self._timetable_url())
        # Should show freq tabs or the grid eventually
        nx_page.wait_for_selector(".tt-freq-tab, .tt-grid, .hint", timeout=30_000)

    def test_frequency_tabs_appear(self, nx_page):
        go(nx_page, self._timetable_url())
        nx_page.wait_for_selector(".tt-freq-tab", timeout=30_000)
        count = nx_page.locator(".tt-freq-tab").count()
        assert count >= 1, f"Expected ≥1 frequency tab, got {count}"

    def test_direction_tabs_appear(self, nx_page):
        go(nx_page, self._timetable_url())
        nx_page.wait_for_selector(".direction-tab, .dir-tab", timeout=30_000)

    def test_grid_has_stop_rows(self, nx_page):
        go(nx_page, self._timetable_url())
        nx_page.wait_for_selector(".tt-grid", timeout=30_000)
        stop_names = nx_page.locator(".tt-stop-name")
        assert stop_names.count() >= 2, f"Expected ≥2 stop rows, got {stop_names.count()}"


# ══════════════════════════════════════════════════════════════════════════════
# HTML redirect tests  (old .html URLs → clean paths)
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.network
class TestNextRedirects:
    def test_index_html_redirects(self, nx_page):
        go(nx_page, "/index.html")
        nx_page.wait_for_url(f"{NX_BASE}/", timeout=TIMEOUT)

    def test_stops_html_redirects(self, nx_page):
        go(nx_page, "/stops.html")
        nx_page.wait_for_url(f"{NX_BASE}/stops", timeout=TIMEOUT)

    def test_map_html_redirects(self, nx_page):
        go(nx_page, "/map.html")
        nx_page.wait_for_url(f"{NX_BASE}/map", timeout=TIMEOUT)

    def test_station_html_redirects(self, nx_page):
        go(nx_page, "/station.html")
        # station.html with no params → redirects to /station → redirects to /stops
        nx_page.wait_for_url(f"**/stops**", timeout=TIMEOUT)

    def test_settings_html_redirects(self, nx_page):
        go(nx_page, "/settings.html")
        nx_page.wait_for_url(f"{NX_BASE}/settings", timeout=TIMEOUT)

    def test_planner_html_redirects(self, nx_page):
        go(nx_page, "/planner.html")
        nx_page.wait_for_url(f"{NX_BASE}/planner", timeout=TIMEOUT)
