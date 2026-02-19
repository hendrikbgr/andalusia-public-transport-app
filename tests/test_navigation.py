"""
UI tests — stop selector (index.html) and navigation / back-button chain.
"""

import urllib.parse
from playwright.sync_api import expect
from tests.conftest import BASE_URL, TIMEOUT, MALAGA_ID, STOP_MUELLE


class TestStopSelector:
    def test_regions_load(self, page):
        page.goto(f"{BASE_URL}/index.html", timeout=TIMEOUT)
        expect(page.locator(".consortium-card").first).to_be_visible(timeout=TIMEOUT)
        assert page.locator(".consortium-card").count() == 9

    def test_select_malaga_shows_search(self, page):
        page.goto(f"{BASE_URL}/index.html", timeout=TIMEOUT)
        expect(page.locator(".consortium-card").first).to_be_visible(timeout=TIMEOUT)
        page.locator(".consortium-card").filter(has_text="Málaga").click()
        expect(page.locator("#stop-search")).to_be_visible(timeout=TIMEOUT)

    def _load_malaga_stops(self, page):
        page.goto(f"{BASE_URL}/index.html", timeout=TIMEOUT)
        expect(page.locator(".consortium-card").first).to_be_visible(timeout=TIMEOUT)
        page.locator(".consortium-card").filter(has_text="Málaga").click()
        expect(page.locator("#step-stop")).not_to_have_class("hidden", timeout=20_000)
        page.wait_for_function(
            "document.getElementById('stop-list').querySelector('.loading-spinner') === null",
            timeout=20_000,
        )

    def test_stop_search_filters(self, page):
        self._load_malaga_stops(page)
        page.locator("#stop-search").fill("muelle")
        page.wait_for_timeout(400)
        results = page.locator("#stop-list .card")
        assert results.count() >= 1
        expect(results.first).to_contain_text("Muelle", ignore_case=True)

    def test_stop_navigates_to_station(self, page):
        self._load_malaga_stops(page)
        page.locator("#stop-search").fill("Muelle Heredia")
        page.wait_for_timeout(400)
        page.locator("#stop-list .card").first.click()
        page.wait_for_url("**/station.html**", timeout=TIMEOUT)
        assert "c=4" in page.url
        assert "s=" in page.url


class TestBackButtonChain:
    def test_station_back_defaults_to_index(self, page):
        url = f"{BASE_URL}/station.html?c={MALAGA_ID}&s={STOP_MUELLE}"
        page.goto(url, timeout=TIMEOUT)
        href = page.locator("#back-btn").get_attribute("href")
        assert href == "index.html"

    def test_station_back_uses_from_param(self, page):
        url = f"{BASE_URL}/station.html?c={MALAGA_ID}&s={STOP_MUELLE}&from=map.html"
        page.goto(url, timeout=TIMEOUT)
        assert page.locator("#back-btn").get_attribute("href") == "map.html"

    def test_station_missing_params_redirects(self, page):
        page.goto(f"{BASE_URL}/station.html", timeout=TIMEOUT)
        page.wait_for_url("**/index.html", timeout=TIMEOUT)

    def test_route_back_uses_from_param(self, page):
        from_url = f"{BASE_URL}/station.html?c=4&s=149"
        encoded = urllib.parse.quote(from_url, safe="")
        url = (f"{BASE_URL}/route.html?c={MALAGA_ID}&l=1&s={STOP_MUELLE}"
               f"&code=M-110&dest=Torremolinos&sentido=1&from={encoded}")
        page.goto(url, timeout=TIMEOUT)
        href = page.locator("#back-btn, .back-btn, .back-link").first.get_attribute("href")
        assert "station.html" in href
