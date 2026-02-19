"""
UI tests — planner.html (route planner between towns).
Covers region selection, autocomplete dropdowns, search results, and state restoration.
"""

from playwright.sync_api import expect
from tests.conftest import BASE_URL, TIMEOUT, MALAGA_ID, NUCLEO_COIN, NUCLEO_ALHAURIN


class TestPlannerUI:
    def _load_malaga(self, page):
        """Open planner and select the Área de Málaga region."""
        page.goto(f"{BASE_URL}/planner.html", timeout=TIMEOUT)
        expect(page.locator("#planner-region-list .card").first).to_be_visible(timeout=TIMEOUT)
        page.locator("#planner-region-list .card").filter(has_text="Málaga").click()
        expect(page.locator("#from-input")).to_be_visible(timeout=TIMEOUT)

    def test_nine_regions_shown(self, page):
        page.goto(f"{BASE_URL}/planner.html", timeout=TIMEOUT)
        expect(page.locator("#planner-region-list .card").first).to_be_visible(timeout=TIMEOUT)
        assert page.locator("#planner-region-list .card").count() == 9

    def test_select_region_shows_form(self, page):
        self._load_malaga(page)
        expect(page.locator("#from-input")).to_be_visible()
        expect(page.locator("#to-input")).to_be_visible()

    def test_search_button_disabled_until_both_selected(self, page):
        self._load_malaga(page)
        assert page.locator("#search-btn").get_attribute("disabled") is not None

    def test_coin_to_alhaurin_search(self, page):
        self._load_malaga(page)

        # From: Coín
        page.locator("#from-input").fill("Coin")
        expect(page.locator("#from-results .planner-dropdown-item").first).to_be_visible(timeout=TIMEOUT)
        page.locator("#from-results .planner-dropdown-item").filter(
            has=page.locator("text=Coín")
        ).first.click()

        # To: Alhaurín el Grande
        page.locator("#to-input").fill("Alhaurin el Grande")
        expect(page.locator("#to-results .planner-dropdown-item").first).to_be_visible(timeout=TIMEOUT)
        page.locator("#to-results .planner-dropdown-item").first.click()

        # Search button should now be enabled
        page.wait_for_function(
            "document.getElementById('search-btn').disabled === false",
            timeout=TIMEOUT,
        )
        page.locator("#search-btn").click()

        # Results must appear
        page.wait_for_function(
            "!document.getElementById('step-results').classList.contains('hidden')",
            timeout=20_000,
        )
        page.wait_for_function(
            "document.getElementById('results-list').querySelector('.loading-spinner') === null",
            timeout=20_000,
        )
        assert page.locator("#results-list .card").count() >= 1

    def test_dropdown_attached_to_input(self, page):
        """Dropdown must have no visible gap with its input field."""
        self._load_malaga(page)
        page.locator("#from-input").fill("Mal")
        expect(page.locator("#from-results .planner-dropdown-item").first).to_be_visible(timeout=TIMEOUT)

        input_box = page.locator("#from-input").bounding_box()
        dropdown  = page.locator("#from-results").bounding_box()
        gap = abs(dropdown["y"] - (input_box["y"] + input_box["height"]))
        assert gap <= 2, f"Gap between input and dropdown is {gap}px"

    def test_state_restored_from_url(self, page):
        """planner.html?c=4&fromN=201&toN=83 should jump straight to results."""
        url = (f"{BASE_URL}/planner.html"
               f"?c={MALAGA_ID}&fromN={NUCLEO_COIN}&toN={NUCLEO_ALHAURIN}")
        page.goto(url, timeout=TIMEOUT)
        page.wait_for_selector(".departure-card, .planner-result-card, #results-list .card",
                               timeout=30_000)
        assert page.locator("#results-list .card").count() >= 1

    def test_result_card_navigates_to_route(self, page):
        """Tapping a result card opens the route detail page."""
        url = (f"{BASE_URL}/planner.html"
               f"?c={MALAGA_ID}&fromN={NUCLEO_COIN}&toN={NUCLEO_ALHAURIN}")
        page.goto(url, timeout=TIMEOUT)
        page.wait_for_selector("#results-list .card", timeout=30_000)
        page.locator("#results-list .card").first.click()
        page.wait_for_url("**/route.html**", timeout=TIMEOUT)
        assert "c=4" in page.url
        assert "l=" in page.url
