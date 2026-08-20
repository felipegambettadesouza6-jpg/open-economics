"""Fetch official Brazilian inflation observations from Open Economics API."""

from __future__ import annotations

import os
import requests

base_url = os.getenv("OPEN_ECONOMICS_URL", "http://localhost:3000")
response = requests.get(
    f"{base_url}/api/v1/indicators/br-ipca-monthly/observations",
    params={"start": "2024-01-01", "end": "2024-12-31"},
    timeout=30,
)
response.raise_for_status()

payload = response.json()
for observation in payload["data"]:
    print(observation["period"], observation["value"], payload["meta"]["indicator"]["unit_symbol"])

