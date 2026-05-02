"""
VAIZO OPS Dashboard - data.json builder

GitHub Actions から定時/手動で起動される。
サービスアカウント (Secrets.GOOGLE_SA_KEY) でスプレッドシートを読取り、
TASKS / GOALS / MASTERS / SALES / BUDGET を data.json に書き出す。
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone

from google.oauth2 import service_account
from googleapiclient.discovery import build

SHEETS = ["TASKS", "GOALS", "MASTERS", "SALES", "BUDGET"]


def load_credentials():
    raw = os.environ.get("GOOGLE_SA_KEY")
    if not raw:
        sys.exit("ERROR: GOOGLE_SA_KEY env var is empty")
    info = json.loads(raw)
    return service_account.Credentials.from_service_account_info(
        info,
        scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"],
    )


def fetch_sheet(svc, sheet_id: str, name: str) -> list[list]:
    try:
        resp = (
            svc.spreadsheets()
            .values()
            .get(
                spreadsheetId=sheet_id,
                range=name,
                valueRenderOption="FORMATTED_VALUE",
                dateTimeRenderOption="FORMATTED_STRING",
            )
            .execute()
        )
        return resp.get("values", [])
    except Exception as e:
        print(f"WARN: failed to read {name}: {e}")
        return []


def trim_trailing_empty_tasks(rows: list[list]) -> list[list]:
    """TASKS は空行が大量にあるので末尾を整理（ヘッダー行は残す）"""
    while len(rows) > 1:
        last = rows[-1]
        # ID 列(B=index 1) が空なら捨てる
        if len(last) < 2 or not str(last[1]).strip():
            rows.pop()
        else:
            break
    return rows


def main() -> None:
    sheet_id = os.environ.get("SHEET_ID")
    if not sheet_id:
        sys.exit("ERROR: SHEET_ID env var is empty")

    creds = load_credentials()
    svc = build("sheets", "v4", credentials=creds, cache_discovery=False)

    payload: dict = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }

    for name in SHEETS:
        rows = fetch_sheet(svc, sheet_id, name)
        if name == "TASKS":
            rows = trim_trailing_empty_tasks(rows)
        payload[name.lower()] = rows
        print(f"  {name}: {len(rows)} rows")

    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    task_count = max(0, len(payload.get("tasks", [])) - 1)
    print(f"✅ Wrote data.json ({task_count} task rows)")


if __name__ == "__main__":
    main()
