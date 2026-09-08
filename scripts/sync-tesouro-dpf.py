#!/usr/bin/env python3
"""Build a compact Federal Public Debt snapshot from the latest official RMD annex."""

from __future__ import annotations

import argparse
import html
import io
import json
import re
import tempfile
import unicodedata
import urllib.error
import urllib.request
import zipfile
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

import openpyxl


PUBLICATION_ROOT = "https://www.tesourotransparente.gov.br/publicacoes/relatorio-mensal-da-divida-rmd"
SOURCE_PAGE = "https://www.tesourotransparente.gov.br/temas/divida-publica-federal/estatisticas-e-relatorios-da-divida-publica-federal"
OUTPUT = Path(__file__).resolve().parents[1] / "lib" / "catalog" / "generated" / "tesouro-dpf.generated.json"
OBSERVATIONS_OUTPUT = Path(__file__).resolve().parents[1] / "lib" / "catalog" / "generated" / "tesouro-dpf-observations.generated.json"
USER_AGENT = "Mozilla/5.0 OpenEconomicsCatalogSync/2.0"
MONTHS = {"Jan": 1, "Fev": 2, "Mar": 3, "Abr": 4, "Mai": 5, "Jun": 6, "Jul": 7, "Ago": 8, "Set": 9, "Out": 10, "Nov": 11, "Dez": 12}

TABLES = {
    "composition": {"sheet": "2.4", "kind": "paired", "title": "Composição da DPF", "unit": "BRL billion"},
    "holders": {"sheet": "2.7", "kind": "paired", "title": "Detentores dos Títulos Públicos Federais - DPMFi", "unit": "BRL billion"},
    "average-maturity": {"sheet": "3.7", "kind": "wide", "title": "Prazo Médio da DPF", "unit": "years"},
    "average-maturity-by-indexer": {"sheet": "3.8", "kind": "wide", "title": "Prazo Médio da DPF, por Indexador", "unit": "years"},
    "monthly-cost": {"sheet": "4.1", "kind": "wide", "title": "Custo Médio Mensal da DPF", "unit": "% p.a."},
    "twelve-month-cost": {"sheet": "4.2", "kind": "wide", "title": "Custo Médio da DPF, Acumulado nos Últimos 12 Meses", "unit": "% p.a."},
}


def request(url: str):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": USER_AGENT}), timeout=120)


def previous_months(count: int = 18):
    current = date.today().replace(day=1)
    for _ in range(count):
        yield current.year, current.month
        current = (current.replace(day=1) - __import__("datetime").timedelta(days=1)).replace(day=1)


def discover_publication() -> tuple[str, str, str, str]:
    pattern = re.compile(r'href="([^"]*publicacao-anexo/\d+)"\s+title="([^"]*Anexo RMD_[^"]+\.zip)"', re.I)
    for year, month in previous_months():
        publication_url = f"{PUBLICATION_ROOT}/{year}/{month}"
        try:
            with request(publication_url) as response:
                document = response.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as error:
            if error.code == 404:
                continue
            raise
        match = pattern.search(document)
        if match:
            return publication_url, html.unescape(match.group(1)), html.unescape(match.group(2)), f"{year}-{month:02d}"
    raise RuntimeError("No recent RMD publication with an official annex ZIP was found.")


def month(value: object) -> str | None:
    if isinstance(value, datetime):
        return f"{value.year}-{value.month:02d}"
    if isinstance(value, str):
        match = re.fullmatch(r"([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2})/(\d{2})", value.strip())
        if match and match.group(1) in MONTHS:
            short_year = int(match.group(2))
            century = 2000 if short_year <= date.today().year % 100 + 1 else 1900
            return f"{century + short_year:04d}-{MONTHS[match.group(1)]:02d}"
    return None


def slug(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", normalized).strip("-") or "category"


def categories(labels: list[str]) -> dict[int, tuple[str, str]]:
    counts: dict[str, int] = defaultdict(int)
    result: dict[int, tuple[str, str]] = {}
    for row, label in enumerate(labels):
        base = slug(label)
        counts[base] += 1
        identifier = base if counts[base] == 1 else f"{base}-{counts[base]}"
        result[row] = (identifier, label.strip())
    return result


def paired_table(sheet) -> tuple[list[list[object]], list[list[str]], list[str]]:
    matrix = list(sheet.iter_rows(values_only=True))
    header = matrix[4]
    header_columns = [column for column in range(1, len(header)) if isinstance(header[column], str)]
    category_by_column = {column: re.sub(r"\s+\d+$", "", header[column].strip()) for column in header_columns}
    category_ids = categories(list(category_by_column.values()))
    id_by_column = {column: category_ids[index] for index, column in enumerate(header_columns)}
    rows: list[list[object]] = []
    last_data_index = 5
    for row_index, source_row in enumerate(matrix[5:], start=5):
        period = month(source_row[0])
        if not period:
            continue
        last_data_index = row_index
        for index, column in enumerate(header_columns):
            value = source_row[column]
            if not isinstance(value, (int, float)):
                continue
            next_header = header_columns[index + 1] if index + 1 < len(header_columns) else len(source_row)
            share = source_row[column + 1] if column + 1 < next_header and column + 1 < len(source_row) else None
            identifier, label = id_by_column[column]
            rows.append([period, identifier, label, value, share * 100 if isinstance(share, (int, float)) else None])
    notes = [row[0].strip() for row in matrix[last_data_index + 1:] if row and isinstance(row[0], str) and row[0].strip()]
    return rows, [[identifier, label] for identifier, label in id_by_column.values()], notes


def wide_table(sheet) -> tuple[list[list[object]], list[list[str]], list[str]]:
    matrix = list(sheet.iter_rows(values_only=True))
    header = matrix[4]
    period_columns = [(column, month(header[column])) for column in range(1, len(header))]
    period_columns = [(column, period) for column, period in period_columns if period]
    source_rows: list[tuple[int, str]] = []
    for row_index, source_row in enumerate(matrix[5:], start=5):
        label = source_row[0]
        if not isinstance(label, str) or not label.strip():
            continue
        if any(column < len(source_row) and isinstance(source_row[column], (int, float)) for column, _ in period_columns):
            source_rows.append((row_index, label))
    category_ids = categories([label for _, label in source_rows])
    rows: list[list[object]] = []
    output_categories: list[list[str]] = []
    for index, (row, _) in enumerate(source_rows):
        identifier, label = category_ids[index]
        output_categories.append([identifier, label])
        for column, period in period_columns:
            value = matrix[row][column]
            if isinstance(value, (int, float)):
                rows.append([period, identifier, label, value, None])
    last_data_index = max((row for row, _ in source_rows), default=5)
    notes = [row[0].strip() for row in matrix[last_data_index + 1:] if row and isinstance(row[0], str) and row[0].strip()]
    return rows, output_categories, notes


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workbook", type=Path, help="Optional downloaded RMD annex workbook for a reproducible local rebuild.")
    arguments = parser.parse_args()
    publication_url, annex_url, source_file, publication_period = discover_publication()

    manager = tempfile.TemporaryDirectory(prefix="open-economics-dpf-")
    workbook = None
    try:
        if arguments.workbook:
            workbook_path = arguments.workbook.resolve()
            source_version = publication_period
        else:
            with request(annex_url) as response:
                archive_bytes = response.read()
                source_version = response.headers.get("Last-Modified") or publication_period
            with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
                members = [member for member in archive.namelist() if member.lower().endswith(".xlsx")]
                if len(members) != 1:
                    raise RuntimeError("The RMD annex ZIP no longer contains exactly one XLSX workbook.")
                workbook_path = Path(manager.name) / Path(members[0]).name
                workbook_path.write_bytes(archive.read(members[0]))

        workbook = openpyxl.load_workbook(workbook_path, read_only=True, data_only=True)
        tables: dict[str, dict[str, object]] = {}
        observations: dict[str, list[list[object]]] = {}
        all_periods: list[str] = []
        total_rows = 0
        for table_id, config in TABLES.items():
            sheet = workbook[config["sheet"]]
            rows, table_categories, notes = paired_table(sheet) if config["kind"] == "paired" else wide_table(sheet)
            periods = [str(row[0]) for row in rows]
            if not periods:
                raise RuntimeError(f"Official RMD table {config['sheet']} contained no observations.")
            tables[table_id] = {
                "sheet": config["sheet"], "title": config["title"], "unit": config["unit"],
                "coverage": {"start": min(periods), "end": max(periods)},
                "categories": table_categories,
                "footnotes": notes,
                "observations": len(rows),
            }
            observations[table_id] = rows
            all_periods.extend(periods)
            total_rows += len(rows)

        if max(all_periods) != publication_period:
            raise RuntimeError(f"Latest RMD table period {max(all_periods)} did not match publication period {publication_period}.")
        payload = {
            "schema_version": 1,
            "synced_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "source_version": source_version,
            "publication_period": publication_period,
            "publication_url": publication_url,
            "annex_url": annex_url,
            "source_page": SOURCE_PAGE,
            "source_file": source_file,
            "coverage": {"start": min(all_periods), "end": max(all_periods)},
            "row_columns": ["period", "category_id", "category_label", "value", "share_percent"],
            "tables": tables,
        }
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        OBSERVATIONS_OUTPUT.write_text(json.dumps({"schema_version": 1, "tables": observations}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        print(json.dumps({
            "output": str(OUTPUT), "observations_output": str(OBSERVATIONS_OUTPUT),
            "publication_period": publication_period, "tables": len(tables), "observations": total_rows,
            "coverage": payload["coverage"], "bytes": OUTPUT.stat().st_size,
            "observations_bytes": OBSERVATIONS_OUTPUT.stat().st_size,
        }, ensure_ascii=False))
    finally:
        if workbook is not None:
            workbook.close()
        manager.cleanup()


if __name__ == "__main__":
    main()
