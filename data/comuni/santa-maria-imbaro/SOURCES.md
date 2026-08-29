# Santa Maria Imbaro — data sources

Seed snapshot for LocalManager v0. Numbers are for educational simulation only.

## Identity & geography

| Field | Source |
|-------|--------|
| ISTAT comune code `069084` | [ISTAT — Codici statistici dei comuni](https://www.istat.it/it/archivio/6789) |
| Cadastral code `I244`, province `CH`, region Abruzzo | ISTAT / official comune registry |
| Area 5.71 km² | ISTAT territorial data |
| Map center & OSM query | OpenStreetMap contributors; basemap via [prettymaps](https://github.com/martinjc/prettymaps) |

## Demographics

| Field | Value | Source |
|-------|-------|--------|
| Population (2022) | 2 022 | [Tuttitalia — Santa Maria Imbaro](https://www.tuttitalia.it/abruzzo/69-santa-maria-imbaro/) snapshot 01/01/2026 (ISTAT) |
| Mean age (43.1) | 43.1 | [Urbistat — Santa Maria Imbaro](https://www.urbistat.it/Comune/SANTA_MARIA_IMBARO/) 2024 — verify against ISTAT before claiming precision |

## Budget & projects

Opening cash, monthly income/maintenance, and project costs/effects are **simplified educational placeholders**, not derived from the comune's real bilancio or deliberations. Hydrated runs may set `openingDebt` from BDAP Conto del Patrimonio (debiti di finanziamento).

## Map slots

Slot offsets are approximate degree offsets from `meta.center` for v0 overlay dots — not cadastral parcels or official zoning.

## Disclaimer

This dataset powers a mayor simulation game. Do not use it for civic, financial, or planning decisions.
