"""Build the compact EPE electricity-consumption snapshot used at runtime.

Requires Python 3 and openpyxl. The generated data remains attributed to EPE
and keeps the source workbook URL and its embedded version date.
"""

from __future__ import annotations

import json
import tempfile
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    import openpyxl
except ImportError as error:
    raise SystemExit("openpyxl is required: python -m pip install openpyxl") from error


SOURCE_URL = "https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/dados-abertos/Documents/Dados_abertos_Consumo_Mensal.xlsx"
SOURCE_PAGE = "https://www.epe.gov.br/pt/publicacoes-dados-abertos/dados-abertos/dados-do-consumo-mensal-de-energia-eletrica"
OUTPUT = Path(__file__).resolve().parents[1] / "lib" / "catalog" / "generated" / "epe-electricity.generated.json"


def date_key(value: object) -> str:
    return str(int(value))[:6]


with tempfile.TemporaryDirectory(prefix="open-economics-epe-") as temporary:
    workbook_path = Path(temporary) / "source.xlsx"
    request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "OpenEconomicsAPI/2.0"})
    with urllib.request.urlopen(request, timeout=60) as response, workbook_path.open("wb") as target:
        target.write(response.read())

    workbook = openpyxl.load_workbook(workbook_path, read_only=True, data_only=True)
    sheet = workbook["CONSUMO E NUMCONS SAM UF"]
    rows = sheet.iter_rows(values_only=True)
    header = next(rows)
    expected = ("Data", "DataExcel", "UF", "Regiao", "Sistema", "Classe", "TipoConsumidor", "Consumo", "Consumidores", "DataVersao")
    if tuple(header) != expected:
        raise SystemExit(f"EPE workbook schema changed: {header!r}")

    compact_rows = []
    versions = set()
    for row in rows:
        if not row[0] or not row[2] or row[7] is None:
            continue
        version = row[9]
        if isinstance(version, datetime):
            versions.add(version.date().isoformat())
        compact_rows.append([
            date_key(row[0]),
            str(row[2]),
            str(row[3]),
            str(row[5]),
            str(row[6]),
            round(float(row[7]), 3),
            int(row[8] or 0),
        ])
    workbook.close()

    compact_rows.sort(key=lambda item: (item[0], item[1], item[3], item[4]))
    payload = {
        "schema_version": 1,
        "synced_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source_version": max(versions) if versions else None,
        "source_url": SOURCE_URL,
        "source_page": SOURCE_PAGE,
        "columns": ["period", "state", "region", "class", "market", "consumption_mwh", "consumers"],
        "rows": compact_rows,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT), "rows": len(compact_rows), "source_version": payload["source_version"]}, ensure_ascii=False))
