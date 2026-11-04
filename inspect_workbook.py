"""Read-only validation and coverage inspection for pipeline workbook imports."""
import datetime as dt
import json
import math
import sys
from collections import Counter

from openpyxl import load_workbook
from openpyxl.utils.datetime import from_excel

REQUIRED = ["date", "sku", "market", "channel", "units_sold", "temperature_c", "promotion", "festival", "in_stock"]
OPTIONAL = ["units_requested", "units_fulfilled", "on_hand_units", "search_intent", "platform", "qcom_category"]


def parse_date(value):
    if isinstance(value, dt.datetime):
        return value.date()
    if isinstance(value, dt.date):
        return value
    if isinstance(value, (int, float)):
        return from_excel(value).date()
    if isinstance(value, str):
        return dt.date.fromisoformat(value[:10])
    raise ValueError("invalid date")


def inspect(filename):
    book = load_workbook(filename, read_only=True, data_only=True)
    sheet = book.active
    iterator = sheet.iter_rows(values_only=True)
    headers = [str(value or "").strip().lower() for value in next(iterator, ())]
    missing_columns = [name for name in REQUIRED if name not in headers]
    if missing_columns:
        book.close()
        return {"accepted": False, "error": "Required columns are missing.", "missingColumns": missing_columns,
                "requiredColumns": REQUIRED, "optionalColumns": OPTIONAL}
    positions = {name: headers.index(name) for name in REQUIRED + [name for name in OPTIONAL if name in headers]}
    accepted = 0
    rejected = Counter()
    duplicates = 0
    keys = set()
    dates, skus, markets, channels, platforms = set(), set(), set(), set(), set()
    market_stats = {}
    series_days = Counter()
    valid_availability = valid_requested = valid_fulfilled = valid_on_hand = valid_search = valid_platform = 0
    qcom_rows = qcom_categorized_rows = 0
    qcom_category_counts = Counter()
    qcom_sku_categories = {}
    qcom_skus = set()
    qcom_skus_with_uncategorized_rows = set()
    parsed_rows = 0
    for values in iterator:
        parsed_rows += 1
        row = {name: (values[index] if index < len(values) else None) for name, index in positions.items()}
        try:
            day = parse_date(row["date"])
        except (ValueError, TypeError, OverflowError):
            rejected["invalid date"] += 1
            continue
        sku, market, channel = (str(row[name] or "").strip() for name in ("sku", "market", "channel"))
        if not sku or not market or not channel:
            rejected["missing SKU/market/channel"] += 1
            continue
        def valid_flag(value):
            if isinstance(value, bool):
                return True
            if isinstance(value, (int, float)):
                return value in (0, 1)
            return str(value or "").strip().lower() in {"0", "1", "true", "false", "yes", "no", "y", "n"}
        if not all(valid_flag(row[name]) for name in ("promotion", "festival", "in_stock")):
            rejected["invalid promotion/festival/availability flag"] += 1
            continue
        try:
            units, temp = float(row["units_sold"]), float(row["temperature_c"])
            if not math.isfinite(units) or not math.isfinite(temp):
                raise ValueError()
            if units < 0:
                rejected["negative units"] += 1
                continue
        except (ValueError, TypeError):
            rejected["invalid numeric fields"] += 1
            continue
        platform = str(row.get("platform") or "").strip()
        normalized_channel = channel.strip().lower().replace("-", " ").replace("_", " ")
        is_qcom = normalized_channel in {"quick commerce", "quickcommerce", "q commerce"}
        if platform:
            if normalized_channel not in {"quick commerce", "quickcommerce", "q commerce"}:
                rejected["platform is only valid for quick-commerce rows"] += 1
                continue
            platforms.add(platform)
        qcom_category = str(row.get("qcom_category") or "").strip().lower().replace("_", "-").replace(" ", "-")
        if is_qcom:
            qcom_rows += 1
            qcom_skus.add(sku)
            if qcom_category in {"dmef", "non-dmef", "nondmef", "longer-shelf-life", "longer-shelf-life-products"}:
                normalized_category = "DMEF" if qcom_category == "dmef" else "Non-DMEF"
                qcom_category_counts[normalized_category] += 1
                qcom_categorized_rows += 1
                qcom_sku_categories.setdefault(sku, set()).add(normalized_category)
            else:
                qcom_skus_with_uncategorized_rows.add(sku)
        elif qcom_category:
            rejected["qcom_category is only valid for quick-commerce rows"] += 1
            continue
        key = (day.isoformat(), sku, market, channel, platform)
        if key in keys:
            duplicates += 1
        keys.add(key)
        series_days[(sku, market, channel, platform)] += 1
        accepted += 1
        dates.add(day)
        skus.add(sku)
        markets.add(market)
        channels.add(channel)
        if market not in market_stats:
            market_stats[market] = {"rows": 0, "skus": set(), "channels": set(), "platforms": set()}
        market_stats[market]["rows"] += 1
        market_stats[market]["skus"].add(sku)
        market_stats[market]["channels"].add(channel)
        if platform:
            market_stats[market]["platforms"].add(platform)
        def present_nonnegative(name):
            try:
                value = float(row.get(name))
                return math.isfinite(value) and value >= 0
            except (ValueError, TypeError):
                return False
        valid_availability += str(row.get("in_stock", "")).strip().lower() in {"1", "true", "yes", "y", "0", "false", "no", "n"}
        valid_requested += present_nonnegative("units_requested")
        valid_fulfilled += present_nonnegative("units_fulfilled")
        valid_on_hand += present_nonnegative("on_hand_units")
        valid_search += present_nonnegative("search_intent")
        valid_platform += bool(platform)
    book.close()
    date_values = sorted(dates)
    qcom_classified_skus = {sku for sku in qcom_skus
                            if len(qcom_sku_categories.get(sku, set())) == 1
                            and sku not in qcom_skus_with_uncategorized_rows}
    return {
        "accepted": len(dates) >= 35 and len(skus) > 0 and duplicates == 0 and bool(series_days) and min(series_days.values()) >= 21,
        "rowCount": parsed_rows,
        "acceptedRows": accepted,
        "rejectedRows": parsed_rows - accepted,
        "rejectionReasons": [{"reason": key, "count": value} for key, value in rejected.most_common()],
        "duplicateSeriesDays": duplicates,
        "dateStart": date_values[0].isoformat() if date_values else None,
        "dateEnd": date_values[-1].isoformat() if date_values else None,
        "dateCount": len(date_values),
        "skuCount": len(skus),
        "marketCount": len(markets),
        "channelCount": len(channels),
        "channels": sorted(channels),
        "platformCount": len(platforms),
        "platforms": sorted(platforms),
        "qcomCategoryCoverage": round(100 * len(qcom_classified_skus) / len(qcom_skus), 1) if qcom_skus else 0,
        "qcomCategoryCounts": dict(qcom_category_counts),
        "qcomUnclassifiedSkus": sorted(qcom_skus - qcom_classified_skus),
        "qcomRows": qcom_rows,
        "marketCoverage": [{"market": market, "rows": stats["rows"], "skuCount": len(stats["skus"]),
                            "channelCount": len(stats["channels"]), "platforms": sorted(stats["platforms"])}
                           for market, stats in sorted(market_stats.items())],
        "stockAvailabilityCoverage": round(100 * valid_availability / accepted, 1) if accepted else 0,
        "requestedUnitsCoverage": round(100 * valid_requested / accepted, 1) if accepted else 0,
        "fulfilledUnitsCoverage": round(100 * valid_fulfilled / accepted, 1) if accepted else 0,
        "onHandUnitsCoverage": round(100 * valid_on_hand / accepted, 1) if accepted else 0,
        "searchIntentCoverage": round(100 * valid_search / accepted, 1) if accepted else 0,
        "platformCoverage": round(100 * valid_platform / accepted, 1) if accepted else 0,
        "missingColumns": [],
        "requiredColumns": REQUIRED,
        "optionalColumns": OPTIONAL,
        "note": "Workbook values are inspected only; no source-system connection or consumer-level data is created.",
    }


if __name__ == "__main__":
    try:
        print(json.dumps(inspect(sys.argv[1])))
    except Exception as error:
        print(json.dumps({"accepted": False, "error": str(error) or "Could not inspect this workbook."}))
        sys.exit(1)
