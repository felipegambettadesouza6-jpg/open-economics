"""Fetch BCB IBC-Br and IBGE GDP through one normalized response contract."""

from __future__ import annotations

import os

import requests


BASE_URL = os.getenv(
    "OPEN_ECONOMICS_URL",
    "https://open-economics-data.knbf982hkn.chatgpt.site",
)

SERIES = {
    # BCB SGS 24363
    "ibc_br": "br-ibc-br",
    # IBGE/SIDRA table 5932, variable 6561
    "gdp_yoy": "br-gdp-real-yoy",
}


def fetch_series(indicator_id: str, start: str) -> dict:
    response = requests.get(
        f"{BASE_URL}/api/v1/indicators/{indicator_id}/observations",
        params={"start": start, "order": "asc", "limit": 5000},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


for name, indicator_id in SERIES.items():
    payload = fetch_series(indicator_id, "2003-01-01")
    latest = payload["data"][-1]
    print(
        name,
        latest["period"],
        latest["value"],
        payload["meta"]["indicator"]["unit_symbol"],
        "stale=" + str(payload["meta"]["stale"]).lower(),
    )
    print("  official source:", payload["meta"]["provenance"]["upstream_url"])
