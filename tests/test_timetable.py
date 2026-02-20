"""
UI tests — station.html (live departures board).
Covers loading, countdown, silent background refresh, and language switching.
"""

from playwright.sync_api import expect
from tests.conftest import BASE_URL, TIMEOUT, MALAGA_ID, STOP_MUELLE


class TestStationUI:
    def _url(self):
        return f"{BASE_URL}/station.html?c={MALAGA_ID}&s={STOP_MUELLE}"

    def _wait_for_content(self, page):
        """Wait for departures or no-service message to appear."""
        page.wait_for_selector(
            ".departure-card, #no-service:not(.hidden)",
            timeout=30_000,
        )

    def test_stop_name_loads(self, page):
        page.goto(self._url(), timeout=TIMEOUT)
        page.wait_for_function(
            "document.getElementById('station-name').textContent.trim() !== 'Loading…'",
            timeout=TIMEOUT,
        )
        assert "Muelle" in page.locator("#station-name").text_content()

    def test_station_meta_shows_zone(self, page):
        page.goto(self._url(), timeout=TIMEOUT)
        expect(page.locator("#station-meta")).not_to_be_empty(timeout=TIMEOUT)
        meta = page.locator("#station-meta").text_content()
        assert "Zone A" in meta or "Zona A" in meta

    def test_departures_or_no_service_shown(self, page):
        page.goto(self._url(), timeout=TIMEOUT)
        self._wait_for_content(page)

    def test_refresh_button_visible(self, page):
        """Manual refresh button replaces the old auto-refresh countdown."""
        page.goto(self._url(), timeout=TIMEOUT)
        expect(page.locator("#refresh-btn")).to_be_visible(timeout=TIMEOUT)
        # Button should not be spinning on initial load
        assert "spinning" not in (page.locator("#refresh-btn").get_attribute("class") or "")

    def test_live_clock_ticks(self, page):
        page.goto(self._url(), timeout=TIMEOUT)
        t1 = page.locator("#live-clock").text_content(timeout=TIMEOUT)
        page.wait_for_timeout(1500)
        assert t1 != page.locator("#live-clock").text_content()

    def test_silent_refresh_no_spinner(self, page):
        """Background refresh (every 30 s) must not flash a loading spinner."""
        page.goto(self._url(), timeout=TIMEOUT)
        self._wait_for_content(page)

        # Install MutationObserver to detect any spinner inside the board
        page.evaluate("""
            () => {
                window._spinnerFlashed = false;
                const obs = new MutationObserver(() => {
                    if (document.querySelector('#departures-board .loading-spinner'))
                        window._spinnerFlashed = true;
                });
                obs.observe(document.getElementById('departures-board'),
                            { childList: true, subtree: true });
                window._spinnerObs = obs;
            }
        """)

        page.wait_for_timeout(35_000)   # wait past one 30 s cycle
        spinner_appeared = page.evaluate("() => window._spinnerFlashed")
        page.evaluate("() => window._spinnerObs.disconnect()")
        assert not spinner_appeared, "Spinner appeared during silent background refresh"

    def test_language_toggle_no_api_call(self, page):
        """Language toggle re-renders from cached data — must not fetch the API."""
        page.goto(self._url(), timeout=TIMEOUT)
        self._wait_for_content(page)

        api_calls = []
        page.on("request", lambda r: api_calls.append(r.url) if "servicios" in r.url else None)
        page.locator("#lang-toggle").click()
        page.wait_for_timeout(500)
        assert len(api_calls) == 0, "Language toggle triggered an API call"

    def test_departure_card_navigates_to_route(self, page):
        page.goto(self._url(), timeout=TIMEOUT)
        # Only test if actual departure cards are present
        page.wait_for_selector(".departure-card", timeout=30_000)
        page.locator(".departure-card").first.click()
        page.wait_for_url("**/route.html**", timeout=TIMEOUT)
        assert "c=4" in page.url
        assert "l=" in page.url
