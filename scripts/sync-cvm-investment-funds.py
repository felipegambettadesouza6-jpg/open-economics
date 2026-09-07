#!/usr/bin/env python3
"""Build a compact CVM investment-fund snapshot from official open-data files."""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import tempfile
import urllib.request
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


PACKAGE_API = "https://dados.cvm.gov.br/api/3/action/package_show?id=fi-doc-inf_diario"
REGISTRY_API = "https://dados.cvm.gov.br/api/3/action/package_show?id=fi-cad"
SOURCE_PAGE = "https://dados.cvm.gov.br/dataset/fi-doc-inf_diario"
REGISTRY_PAGE = "https://dados.cvm.gov.br/dataset/fi-cad"
OUTPUT = Path(__file__).resolve().parents[1] / "lib" / "catalog" / "generated" / "cvm-investment-funds.generated.json"
FUND_OUTPUT = Path(__file__).resolve().parents[1] / "lib" / "catalog" / "generated" / "cvm-investment-funds-latest.generated.json"
USER_AGENT = "Mozilla/5.0 OpenEconomicsCatalogSync/2.0"


def fetch_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def download(url: str, target: Path) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=180) as response, target.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)


def digits(value: str | None) -> str:
    return re.sub(r"\D", "", value or "")


def number(value: str | None) -> int | float | None:
    if value is None or not value.strip():
        return None
    parsed = float(value.replace(",", "."))
    return int(parsed) if parsed.is_integer() else parsed


def text_rows(archive: zipfile.ZipFile, member: str):
    # CVM bulk CSV files use semicolons and Windows-1252/Latin-1 text.
    stream = io.TextIOWrapper(archive.open(member), encoding="latin-1", newline="")
    try:
        yield from csv.DictReader(stream, delimiter=";")
    finally:
        stream.close()


def registry_identity(registry_zip: Path, legacy_csv: Path) -> dict[str, dict[str, str | None]]:
    identities: dict[str, dict[str, str | None]] = {}
    with zipfile.ZipFile(registry_zip) as archive:
        for row in text_rows(archive, "registro_fundo.csv"):
            cnpj = digits(row.get("CNPJ_Fundo"))
            if cnpj:
                identities[cnpj] = {
                    "name": (row.get("Denominacao_Social") or "").strip() or None,
                    "classification": None,
                    "anbima": None,
                    "status": (row.get("Situacao") or "").strip() or None,
                }
        for row in text_rows(archive, "registro_classe.csv"):
            cnpj = digits(row.get("CNPJ_Classe"))
            if cnpj:
                identities[cnpj] = {
                    "name": (row.get("Denominacao_Social") or "").strip() or None,
                    "classification": (row.get("Classificacao") or "").strip() or None,
                    "anbima": (row.get("Classificacao_Anbima") or "").strip() or None,
                    "status": (row.get("Situacao") or "").strip() or None,
                }
    with legacy_csv.open("r", encoding="latin-1", newline="") as stream:
        for row in csv.DictReader(stream, delimiter=";"):
            cnpj = digits(row.get("CNPJ_FUNDO"))
            if cnpj and cnpj not in identities:
                identities[cnpj] = {
                    "name": (row.get("DENOM_SOCIAL") or "").strip() or None,
                    "classification": (row.get("CLASSE") or "").strip() or None,
                    "anbima": (row.get("CLASSE_ANBIMA") or "").strip() or None,
                    "status": (row.get("SIT") or "").strip() or None,
                }
    return identities


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--months", type=int, default=13, help="Most recent monthly resources to aggregate (default: 13).")
    parser.add_argument("--cache-dir", type=Path, help="Optional persistent download cache.")
    arguments = parser.parse_args()
    if arguments.months < 1 or arguments.months > 24:
        raise RuntimeError("--months must be between 1 and 24.")

    fund_package = fetch_json(PACKAGE_API)["result"]
    registry_package = fetch_json(REGISTRY_API)["result"]
    resources = sorted(
        [resource for resource in fund_package["resources"] if resource.get("format") == "ZIP" and re.search(r"inf_diario_fi_\d{6}\.zip$", resource["url"])],
        key=lambda resource: resource["url"],
    )[-arguments.months:]
    if not resources:
        raise RuntimeError("CVM package metadata contained no monthly daily-report resources.")
    registry_resource = next(
        resource for resource in registry_package["resources"]
        if "/DADOS/" in resource["url"] and resource["url"].endswith("registro_fundo_classe.zip")
    )
    legacy_resource = next(
        resource for resource in registry_package["resources"]
        if "/DADOS/" in resource["url"] and resource["url"].endswith("cad_fi.csv")
    )

    manager = tempfile.TemporaryDirectory(prefix="open-economics-cvm-") if arguments.cache_dir is None else None
    work = arguments.cache_dir.resolve() if arguments.cache_dir else Path(manager.name)
    work.mkdir(parents=True, exist_ok=True)
    try:
        registry_zip = work / "registro_fundo_classe.zip"
        legacy_csv = work / "cad_fi.csv"
        if not registry_zip.exists():
            download(registry_resource["url"], registry_zip)
        if not legacy_csv.exists():
            download(legacy_resource["url"], legacy_csv)
        identities = registry_identity(registry_zip, legacy_csv)

        aggregates: dict[tuple[str, str], dict[str, int | float]] = defaultdict(lambda: {
            "portfolio": 0, "net_assets": 0, "subscriptions": 0, "redemptions": 0, "holders": 0, "reports": 0,
        })
        latest: dict[tuple[str, str], tuple[str, list[object]]] = {}
        source_files: list[dict[str, object]] = []
        source_rows = 0

        for resource in resources:
            match = re.search(r"(\d{6})\.zip$", resource["url"])
            if not match:
                continue
            archive_path = work / f"inf_diario_fi_{match.group(1)}.zip"
            if not archive_path.exists():
                download(resource["url"], archive_path)
            with zipfile.ZipFile(archive_path) as archive:
                members = [name for name in archive.namelist() if name.lower().endswith(".csv")]
                if len(members) != 1:
                    raise RuntimeError(f"Unexpected CVM archive layout in {archive_path.name}.")
                for row in text_rows(archive, members[0]):
                    source_rows += 1
                    cnpj = digits(row.get("CNPJ_FUNDO_CLASSE"))
                    date = (row.get("DT_COMPTC") or "").strip()
                    subclass = (row.get("ID_SUBCLASSE") or "").strip()
                    source_type = (row.get("TP_FUNDO_CLASSE") or "").strip()
                    if len(cnpj) != 14 or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
                        continue
                    identity = identities.get(cnpj, {})
                    classification = str(identity.get("classification") or "Não classificado")
                    values = [
                        number(row.get("VL_TOTAL")), number(row.get("VL_QUOTA")), number(row.get("VL_PATRIM_LIQ")),
                        number(row.get("CAPTC_DIA")), number(row.get("RESG_DIA")), number(row.get("NR_COTST")),
                    ]
                    bucket = aggregates[(date, classification)]
                    for field, value in zip(("portfolio", "quota", "net_assets", "subscriptions", "redemptions", "holders"), values):
                        if field != "quota" and value is not None:
                            bucket[field] += value
                    bucket["reports"] += 1
                    fund_row: list[object] = [
                        date, cnpj, subclass or None, source_type or None,
                        identity.get("name"), identity.get("classification"), identity.get("anbima"), identity.get("status"),
                        *values,
                    ]
                    key = (cnpj, subclass)
                    if key not in latest or date > latest[key][0]:
                        latest[key] = (date, fund_row)
            source_files.append({
                "period": match.group(1), "url": resource["url"], "last_modified": resource.get("last_modified"),
                "bytes": archive_path.stat().st_size,
            })

        class_rows = [
            [date, classification, values["reports"], values["portfolio"], values["net_assets"], values["subscriptions"], values["redemptions"], values["holders"]]
            for (date, classification), values in sorted(aggregates.items())
        ]
        fund_rows = [value[1] for _, value in sorted(latest.items())]
        dates = [row[0] for row in class_rows]
        if not dates or len(fund_rows) < 1000:
            raise RuntimeError("CVM source coverage changed unexpectedly.")
        reports_by_date: dict[str, int] = defaultdict(int)
        for row in class_rows:
            reports_by_date[row[0]] += int(row[2])
        peak_reports = max(reports_by_date.values())
        complete_dates = [date for date, reports in reports_by_date.items() if reports >= peak_reports * 0.80]
        if not complete_dates:
            raise RuntimeError("Could not identify a substantially complete CVM reference date.")
        payload = {
            "schema_version": 1,
            "synced_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "source_version": fund_package["metadata_modified"],
            "source_page": SOURCE_PAGE,
            "registry_page": REGISTRY_PAGE,
            "package_api": PACKAGE_API,
            "registry_api": REGISTRY_API,
            "coverage": {"start": min(dates), "end": max(complete_dates), "source_end": max(dates)},
            "source_files": source_files,
            "source_rows": source_rows,
            "latest_fund_records": len(fund_rows),
            "class_columns": ["date", "classification", "reporting_entries", "portfolio_value_brl", "net_assets_brl", "subscriptions_brl", "redemptions_brl", "reported_holder_accounts"],
            "class_rows": class_rows,
        }
        fund_payload = {
            "schema_version": 1,
            "source_version": fund_package["metadata_modified"],
            "coverage": {"start": min(dates), "end": max(dates)},
            "fund_columns": ["date", "cnpj", "subclass_id", "source_type", "name", "classification", "anbima_classification", "status", "portfolio_value_brl", "quota_value_brl", "net_assets_brl", "subscriptions_brl", "redemptions_brl", "reported_holders"],
            "fund_rows": fund_rows,
        }
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        FUND_OUTPUT.write_text(json.dumps(fund_payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        print(json.dumps({
            "output": str(OUTPUT), "fund_output": str(FUND_OUTPUT), "source_rows": source_rows,
            "class_rows": len(class_rows), "fund_rows": len(fund_rows), "coverage": payload["coverage"],
            "bytes": OUTPUT.stat().st_size, "fund_bytes": FUND_OUTPUT.stat().st_size,
        }, ensure_ascii=False))
    finally:
        if manager is not None:
            manager.cleanup()


if __name__ == "__main__":
    main()
