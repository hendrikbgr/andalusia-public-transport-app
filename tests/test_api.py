"""
API tests — hit the live CTAN API and validate response shapes + known data.
These tests require network access and verify the upstream API contract.
"""

import re
import requests
from tests.conftest import API, MALAGA_ID, STOP_MUELLE
from tests.conftest import NUCLEO_MALAGA, NUCLEO_FUENGIROLA, NUCLEO_COIN, NUCLEO_ALHAURIN


class TestConsortiums:
    def test_returns_nine_regions(self):
        r = requests.get(f"{API}/consorcios", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "consorcios" in data
        assert len(data["consorcios"]) == 9

    def test_known_names(self):
        data = requests.get(f"{API}/consorcios", timeout=10).json()
        by_id = {c["idConsorcio"]: c["nombre"] for c in data["consorcios"]}
        assert by_id["1"] == "Área de Sevilla"
        assert by_id["4"] == "Área de Málaga"
        assert by_id["9"] == "Costa de Huelva"


class TestStops:
    def test_malaga_stops_have_required_fields(self):
        r = requests.get(f"{API}/{MALAGA_ID}/paradas/", timeout=15)
        assert r.status_code == 200
        stops = r.json().get("paradas", [])
        assert len(stops) > 100
        for s in stops[:10]:
            assert "idParada" in s
            assert "nombre" in s
            assert "latitud" in s

    def test_terminal_muelle_heredia(self):
        """Stop 149 = Terminal Muelle Heredia, Zone A, Málaga."""
        r = requests.get(f"{API}/{MALAGA_ID}/paradas/{STOP_MUELLE}", timeout=10)
        assert r.status_code == 200
        s = r.json()
        assert s["idParada"] == STOP_MUELLE
        assert "Muelle Heredia" in s["nombre"]
        assert s["idZona"] == "A"
        assert s["municipio"].lower() in ("málaga", "malaga")


class TestLines:
    def test_line_1_details(self):
        """Line 1 = M-110 Málaga–Torremolinos–Benalmádena Costa."""
        r = requests.get(f"{API}/{MALAGA_ID}/lineas/1", timeout=10)
        assert r.status_code == 200
        line = r.json()
        assert line["idLinea"] == "1"
        assert line["codigo"] == "M-110"
        assert "Torremolinos" in line["nombre"] or "Benalm" in line["nombre"]

    def test_line_1_starts_at_muelle_heredia(self):
        """M-110 direction 1 must include stop 149 (Terminal Muelle Heredia)."""
        r = requests.get(f"{API}/{MALAGA_ID}/lineas/1/paradas", timeout=10)
        assert r.status_code == 200
        paradas = r.json().get("paradas", [])
        dir1 = [p for p in paradas if str(p.get("sentido")) == "1"]
        assert len(dir1) >= 10
        ids = [str(p["idParada"]) for p in dir1]
        assert STOP_MUELLE in ids


class TestNucleos:
    def test_malaga_nucleos_include_key_towns(self):
        r = requests.get(f"{API}/{MALAGA_ID}/nucleos", timeout=10)
        assert r.status_code == 200
        nucleos = r.json().get("nucleos", [])
        by_id = {n["idNucleo"]: n["nombre"] for n in nucleos}
        assert by_id.get(NUCLEO_MALAGA, "").lower() in ("málaga", "malaga")
        assert "Fuengirola" in by_id.get(NUCLEO_FUENGIROLA, "")
        assert "Coín" in by_id.get(NUCLEO_COIN, "") or "Coin" in by_id.get(NUCLEO_COIN, "")


class TestTimetables:
    def test_coin_to_alhaurin_structure(self):
        """Column layout: [1 Lines][2 Coín][3 Alhaurín]."""
        url = (f"{API}/{MALAGA_ID}/horarios_origen_destino"
               f"?idNucleoOrigen={NUCLEO_COIN}&idNucleoDestino={NUCLEO_ALHAURIN}")
        r = requests.get(url, timeout=15)
        assert r.status_code == 200
        data = r.json()
        for key in ("bloques", "horario", "frecuencias", "nucleos"):
            assert key in data

        acronimos = {f["acronimo"] for f in data["frecuencias"]}
        assert "L-V" in acronimos
        assert "lslab" in acronimos

        spans = [n["colspan"] for n in data["nucleos"]]
        assert spans[0] == 1   # line label column
        assert spans[1] == 2   # Coín columns
        assert spans[2] == 3   # Alhaurín columns
        assert len(data["horario"]) >= 3

    def test_m230_runs_weekdays_from_coin(self):
        """M-230 departs Coín at 06:20 on Monday–Friday."""
        url = (f"{API}/{MALAGA_ID}/horarios_origen_destino"
               f"?idNucleoOrigen={NUCLEO_COIN}&idNucleoDestino={NUCLEO_ALHAURIN}")
        data = requests.get(url, timeout=15).json()
        m230 = next((h for h in data["horario"] if h["codigo"] == "M-230"), None)
        assert m230 is not None, "M-230 not found in timetable"
        assert m230["dias"] == "L-V"
        actual_times = [h for h in m230["horas"] if re.match(r"\d{2}:\d{2}", h)]
        assert "06:20" in actual_times

    def test_malaga_to_fuengirola_has_trips(self):
        url = (f"{API}/{MALAGA_ID}/horarios_origen_destino"
               f"?idNucleoOrigen={NUCLEO_MALAGA}&idNucleoDestino={NUCLEO_FUENGIROLA}")
        r = requests.get(url, timeout=15)
        assert r.status_code == 200
        assert len(r.json().get("horario", [])) >= 5
