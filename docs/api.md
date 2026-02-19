# CTAN API Reference

**Base URL:** `https://api.ctan.es/v1/Consorcios`

All responses are JSON. No authentication required.

---

## Consortiums

### `GET /consorcios`

List all nine regional transport consortiums.

**Response**
```json
{
  "consorcios": [
    {
      "idConsorcio": "4",
      "nombre": "Área de Málaga",
      "nombreCorto": "CTMAM"
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `idConsorcio` | string | Unique consortium ID (1–9) |
| `nombre` | string | Full name |
| `nombreCorto` | string | Short code |

**Known values**

| ID | Name | Code |
|----|------|------|
| 1 | Área de Sevilla | CTAS |
| 2 | Bahía de Cádiz | CMTBC |
| 3 | Área de Granada | CTMGR |
| 4 | Área de Málaga | CTMAM |
| 5 | Campo de Gibraltar | CTMCG |
| 6 | Área de Almería | CTAL |
| 7 | Área de Jaén | CTJA |
| 8 | Área de Córdoba | CTCO |
| 9 | Costa de Huelva | CTHU |

---

## Stops

### `GET /:consortiumId/paradas/`

All stops in a consortium.

**Example:** `GET /4/paradas/`

**Response**
```json
{
  "paradas": [
    {
      "idParada": "149",
      "idNucleo": "1",
      "idZona": "A",
      "nombre": "Terminal Muelle Heredia",
      "latitud": "36.716200",
      "longitud": "-4.420500",
      "idMunicipio": "1",
      "municipio": "Málaga",
      "nucleo": "Málaga"
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `idParada` | string | Unique stop ID within consortium |
| `idNucleo` | string | Town/nucleus ID |
| `idZona` | string | Fare zone (A–E) |
| `nombre` | string | Stop name |
| `latitud` | string | Latitude (empty string if no GPS) |
| `longitud` | string | Longitude (empty string if no GPS) |
| `municipio` | string | Municipality name |
| `nucleo` | string | Neighbourhood/area name |

> **Note:** `latitud`/`longitud` can be `""` or `"0"` for stops without GPS data. Filter these out before plotting.

---

### `GET /:consortiumId/paradas/:stopId`

Details for a single stop.

**Example:** `GET /4/paradas/149`

**Response** — same fields as above, plus:

| Field | Type | Description |
|-------|------|-------------|
| `descripcion` | string | Stop type (e.g. "Autobus") |
| `principal` | string | `"1"` if main stop |
| `inactiva` | string | `"1"` if stop is decommissioned |
| `correspondecias` | string | Transfer connections (e.g. `"Correspondencia con: M-250,M-551"`) |

---

### `GET /:consortiumId/paradas/:stopId/servicios?horaIni=:datetime`

Upcoming departures at a stop from a given time.

**Parameter format:** `DD-MM-YYYY+HH:MM`

**Example:** `GET /4/paradas/149/servicios?horaIni=19-02-2026+14:30`

**Response**
```json
{
  "servicios": [
    {
      "idLinea": "1",
      "linea": "M-110",
      "servicio": "14:45",
      "destino": "Benalmádena Costa",
      "nombre": "Málaga - Torremolinos - Benalmádena Costa",
      "sentido": "1",
      "idParada": "149"
    }
  ],
  "horaFin": "2026-02-19 15:30:00"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `idLinea` | string | Line ID |
| `linea` | string | Line code (e.g. `"M-110"`) |
| `servicio` | string | Scheduled departure time `HH:MM` |
| `destino` | string | Final destination name |
| `nombre` | string | Full route name |
| `sentido` | string | Direction: `"1"` outbound, `"2"` inbound |
| `horaFin` | string | End of window covered by this response |

> **App behaviour:** If no services are returned, the app advances `horaIni` by the window returned in `horaFin` (or +15 min) and retries, up to 6 hours ahead. This is the "scanning" behaviour shown in the UI.

---

## Lines

### `GET /:consortiumId/lineas/:lineaId`

Line metadata.

**Example:** `GET /4/lineas/1`

**Response**
```json
{
  "idLinea": "1",
  "codigo": "M-110",
  "nombre": "Málaga-Torremolinos-Benalmádena Costa",
  "modo": "Autobús",
  "operadores": "Avanza Movilidad Integral, S.L.",
  "hayNoticias": 0,
  "termometroIda": "https://siu.ctmam.ctan.es/docs/term/t1i.png",
  "termometroVuelta": "https://siu.ctmam.ctan.es/docs/term/t1v.png",
  "polilinea": [...]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `idLinea` | string | Line ID |
| `codigo` | string | Line code (e.g. `"M-110"`) |
| `nombre` | string | Full route name |
| `modo` | string | Transport mode |
| `operadores` | string | Operating company |
| `polilinea` | array | Array of `[lat, lng]` pairs for route polyline |

---

### `GET /:consortiumId/lineas/:lineaId/paradas`

All stops on a line, for both directions.

**Example:** `GET /4/lineas/1/paradas`

**Response**
```json
{
  "paradas": [
    {
      "idParada": "149",
      "nombre": "Terminal Muelle Heredia",
      "sentido": "1",
      "orden": 1,
      "latitud": "36.716200",
      "longitud": "-4.420500"
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `sentido` | string | `"1"` = outbound (ida), `"2"` = inbound (vuelta) |
| `orden` | number | Stop sequence index within direction |

---

## Nucleos (towns)

### `GET /:consortiumId/nucleos`

All towns/neighbourhoods in a consortium — used by the route planner.

**Example:** `GET /4/nucleos`

**Response**
```json
{
  "nucleos": [
    {
      "idNucleo": "1",
      "idMunicipio": "1",
      "idZona": "A",
      "nombre": "Málaga"
    }
  ]
}
```

**Key Málaga nucleos**

| idNucleo | Name |
|----------|------|
| 1 | Málaga |
| 51 | Arroyo de la Miel |
| 83 | Alhaurín el Grande |
| 107 | Torremolinos |
| 111 | Fuengirola |
| 201 | Coín |
| 202 | Antequera |

---

## Timetables (origin → destination)

### `GET /:consortiumId/horarios_origen_destino?idNucleoOrigen=:id&idNucleoDestino=:id`

Inter-town timetable between two nucleos.

**Example:** `GET /4/horarios_origen_destino?idNucleoOrigen=201&idNucleoDestino=83`
(Coín → Alhaurín el Grande)

**Response structure**
```json
{
  "bloques": [...],
  "horario": [...],
  "frecuencias": [...],
  "nucleos": [...],
  "observacionesModoTransporte": []
}
```

---

#### `frecuencias` — service frequency codes

```json
[
  { "idfrecuencia": "1", "acronimo": "L-V",   "nombre": "Monday to friday working days" },
  { "idfrecuencia": "9", "acronimo": "lslab",  "nombre": "Monday to saturday" },
  { "idfrecuencia": "6", "acronimo": "sdf",    "nombre": "Saturdays, sundays and holidays" }
]
```

Known `acronimo` values:

| Acronimo | English name | Runs on |
|----------|-------------|---------|
| `L-V` | Monday to friday working days | Mon–Fri |
| `lslab` | Monday to saturday | Mon–Sat |
| `sdf` | Saturdays, sundays and holidays | Sat, Sun & holidays |
| `diari` | Daily | Every day |

> **App behaviour:** Day filtering is done by matching the `nombre` field (lowercase) against English and Spanish keywords, not the `acronimo` directly, because acronimo values are inconsistent across consortiums.

---

#### `nucleos` — column layout

```json
[
  { "colspan": 1, "nombre": "",                    "color": "#F2F2F2" },
  { "colspan": 2, "nombre": "Coín",                "color": "#F2F2F2" },
  { "colspan": 3, "nombre": "Alhaurín el Grande",  "color": "#F2F2F2" }
]
```

Defines how many columns in `horas[]` belong to each group:
- Index 0: always 1 column = the line code (skip when parsing times)
- Index 1: origin town columns (2 in this example)
- Index 2: destination town columns (3 in this example)

---

#### `bloques` — individual column headers

```json
[
  { "nombre": "Lineas",           "tipo": "1" },
  { "nombre": "El Palo (Coín)",   "tipo": "1" },
  { "nombre": "Coín",             "tipo": "1" },
  { "nombre": "Campíñuela",       "tipo": "1" },
  { "nombre": "Campíñuela",       "tipo": "1" },
  { "nombre": "Alhaurín el Grande","tipo": "1" }
]
```

One entry per column. Maps 1:1 to positions in each trip's `horas[]` array.

---

#### `horario` — individual trips

```json
[
  {
    "idlinea": "23",
    "codigo": "M-230",
    "horas": ["--", "06:20", "--", "06:27", "06:38"],
    "dias": "L-V",
    "observaciones": "",
    "demandahoras": "23,78774_1"
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `idlinea` | string | Line ID |
| `codigo` | string | Line code |
| `horas` | string[] | One time per column; `"--"` = does not serve that stop |
| `dias` | string | Frequency acronimo (matches `frecuencias[].acronimo`) |

**Parsing departure and arrival times:**

```
horas[0]           → always line code column (skip)
horas[1..colspan₁] → origin times   (use first non-"--" value)
horas[colspan₁+1..] → destination times (use last non-"--" value)
```

Example with `nucleos = [1, 2, 3]`:
- `horas[0]` = line label (skip)
- `horas[1]`, `horas[2]` = origin (Coín) columns
- `horas[3]`, `horas[4]`, `horas[5]` = destination (Alhaurín) columns

---

## Error responses

```json
{ "error": "No se encuentran los datos" }
```

Common error cases:
- Invalid `consortiumId` or `lineaId` → `"No se encuentran los datos"`
- Missing or malformed `horaIni` → `"El año es incorrecto, debe enviar un año correcto en formato YYYY"`
