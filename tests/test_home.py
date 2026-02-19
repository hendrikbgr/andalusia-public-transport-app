"""
UI tests — home.html (dashboard with feature cards).
"""

from playwright.sync_api import expect
from tests.conftest import BASE_URL, TIMEOUT


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

    def test_language_toggle_en_to_es(self, page):
        page.goto(f"{BASE_URL}/home.html", timeout=TIMEOUT)
        page.locator("#lang-toggle").click()
        expect(page.locator("#app-title")).to_contain_text("Rastreador")
        expect(page.locator("#feat-timetable")).to_contain_text("Salidas")

    def test_language_toggle_es_to_en(self, page):
        page.goto(f"{BASE_URL}/home.html", timeout=TIMEOUT)
        # Cookie may carry over from the previous test — ensure we end up in EN
        title = page.locator("#app-title").text_content(timeout=TIMEOUT)
        if "Rastreador" in title:
            page.locator("#lang-toggle").click()  # ES → EN
        else:
            page.locator("#lang-toggle").click()  # EN → ES
            page.locator("#lang-toggle").click()  # ES → EN
        expect(page.locator("#app-title")).to_contain_text("Bus Tracker")

    def test_live_departures_link(self, page):
        page.goto(f"{BASE_URL}/home.html", timeout=TIMEOUT)
        page.locator("a[href='index.html']").first.click()
        page.wait_for_url("**/index.html", timeout=TIMEOUT)

    def test_stop_map_link(self, page):
        page.goto(f"{BASE_URL}/home.html", timeout=TIMEOUT)
        page.locator("a[href='map.html']").click()
        page.wait_for_url("**/map.html", timeout=TIMEOUT)

    def test_planner_link(self, page):
        page.goto(f"{BASE_URL}/home.html", timeout=TIMEOUT)
        page.locator("a[href='planner.html']").click()
        page.wait_for_url("**/planner.html", timeout=TIMEOUT)
