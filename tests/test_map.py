"""
UI tests — map.html (interactive Leaflet stop map).
Covers region overlay, marker rendering, popups, and region switching.
"""

from playwright.sync_api import expect
from tests.conftest import BASE_URL, TIMEOUT


class TestMapUI:
    def _open_malaga_map(self, page):
        """Helper: open map page and select Málaga region."""
        page.goto(f"{BASE_URL}/map.html", timeout=TIMEOUT)
        expect(page.locator(".map-overlay-item").first).to_be_visible(timeout=TIMEOUT)
        page.locator(".map-overlay-item").filter(has_text="Málaga").click()
        expect(page.locator("#map-container")).to_be_visible(timeout=TIMEOUT)

    def test_region_overlay_shown_on_first_load(self, page):
        page.goto(f"{BASE_URL}/map.html", timeout=TIMEOUT)
        expect(page.locator("#region-overlay")).to_be_visible(timeout=TIMEOUT)
        expect(page.locator("#map-container")).not_to_be_visible()

    def test_nine_regions_in_overlay(self, page):
        page.goto(f"{BASE_URL}/map.html", timeout=TIMEOUT)
        expect(page.locator(".map-overlay-item").first).to_be_visible(timeout=TIMEOUT)
        assert page.locator(".map-overlay-item").count() == 9

    def test_select_region_hides_overlay(self, page):
        self._open_malaga_map(page)
        expect(page.locator("#region-overlay")).not_to_be_visible()
        expect(page.locator("#map-container")).to_be_visible()

    def test_map_has_visible_dimensions(self, page):
        self._open_malaga_map(page)
        page.wait_for_selector(".map-stop-dot", timeout=20_000)
        box = page.locator("#leaflet-map").bounding_box()
        assert box is not None
        assert box["width"] > 100 and box["height"] > 100

    def test_stop_markers_appear(self, page):
        self._open_malaga_map(page)
        page.wait_for_selector(".map-stop-dot", timeout=20_000)
        assert page.locator(".map-stop-dot").count() > 50

    def test_popup_shows_on_marker_click(self, page):
        self._open_malaga_map(page)
        page.wait_for_selector(".map-stop-dot", timeout=20_000)
        page.locator(".map-stop-dot").first.click()
        expect(page.locator(".map-popup")).to_be_visible(timeout=TIMEOUT)

    def test_popup_button_text_is_white(self, page):
        self._open_malaga_map(page)
        page.wait_for_selector(".map-stop-dot", timeout=20_000)
        page.locator(".map-stop-dot").first.click()
        page.wait_for_selector(".map-popup-btn", timeout=TIMEOUT)
        color = page.eval_on_selector(
            ".map-popup-btn",
            "el => window.getComputedStyle(el).color",
        )
        assert color == "rgb(255, 255, 255)", f"Popup button text is not white: {color}"

    def test_popup_departures_link(self, page):
        self._open_malaga_map(page)
        page.wait_for_selector(".map-stop-dot", timeout=20_000)
        page.locator(".map-stop-dot").first.click()
        page.wait_for_selector(".map-popup-btn", timeout=TIMEOUT)
        href = page.locator(".map-popup-btn").get_attribute("href")
        assert "station.html" in href
        assert "from=map.html" in href

    def test_region_pill_shows_selected_name(self, page):
        self._open_malaga_map(page)
        expect(page.locator("#region-btn")).to_be_visible(timeout=TIMEOUT)
        expect(page.locator("#region-pill-name")).to_contain_text("Málaga")

    def test_region_pill_reopens_overlay(self, page):
        self._open_malaga_map(page)
        page.locator("#region-btn").click()
        expect(page.locator("#region-overlay")).to_be_visible(timeout=TIMEOUT)
