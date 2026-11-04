"""Regenerate the clearly differentiated, fictional forecast scenario workbooks."""
from datetime import datetime
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.utils.datetime import from_excel


ROOT = Path(__file__).parent
DATA = ROOT / "forecast-data"
BASELINE = DATA / "01_baseline.xlsx"
SYNTHETIC_QCOM_CATEGORIES = {
    "amul taaza milk 1l": "DMEF",
    "amul buttermilk 500ml": "DMEF",
    "amul masti dahi 400g": "Non-DMEF",
    "amul paneer 200g": "Non-DMEF",
}


def as_date(value):
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, (int, float)):
        return from_excel(value).date()
    return value


def product_factor(sku, channel, scenario, days_before_end):
    name = str(sku).lower()
    channel = str(channel).lower()
    if scenario == "heatwave" and days_before_end <= 35:
        return 1.65 if "buttermilk" in name else 1.35 if "dahi" in name else 1.06
    if scenario == "festival" and days_before_end <= 21:
        return 1.35 if "milk" in name else 1.70 if "dahi" in name else 1.85 if "paneer" in name else 1.45
    if scenario == "promotions" and days_before_end <= 28:
        if "taaza milk" in name and "quick commerce" in channel:
            return 1.80
        if "dahi" in name and "general trade" in channel:
            return 1.75
        if "paneer" in name and "institutional" in channel:
            return 1.70
        if "buttermilk" in name and "general trade" in channel:
            return 1.60
        return 1.04
    if scenario == "combined" and days_before_end <= 35:
        factor = 1.65 if "buttermilk" in name else 1.35 if "dahi" in name else 1.06
        if days_before_end <= 21:
            factor *= 1.25 if "milk" in name else 1.45 if "dahi" in name else 1.55 if "paneer" in name else 1.25
        if days_before_end <= 28:
            if "taaza milk" in name and "quick commerce" in channel:
                factor *= 1.45
            elif "dahi" in name and "general trade" in channel:
                factor *= 1.4
            elif "paneer" in name and "institutional" in channel:
                factor *= 1.4
            elif "buttermilk" in name and "general trade" in channel:
                factor *= 1.35
        return factor
    return 1.0


def add_fill_rate_columns(sheet):
    headers = {str(cell.value).strip().lower(): cell.column for cell in sheet[1] if cell.value}
    for name in ("units_requested", "units_fulfilled"):
        if name not in headers:
            column = sheet.max_column + 1
            sheet.cell(1, column).value = name
            headers[name] = column
    units_col, stock_col = headers["units_sold"], headers["in_stock"]
    for row in range(2, sheet.max_row + 1):
        sold = max(0, round(float(sheet.cell(row, units_col).value or 0)))
        in_stock = bool(sheet.cell(row, stock_col).value)
        unfulfilled_rate = 0.015 + (row % 4) * 0.01 if in_stock else 0.10 + (row % 5) * 0.04
        unfulfilled = round(sold * unfulfilled_rate) if in_stock else max(1, round(max(sold, 10) * unfulfilled_rate))
        sheet.cell(row, headers["units_requested"]).value = sold + unfulfilled
        sheet.cell(row, headers["units_fulfilled"]).value = sold
    return headers


def add_synthetic_qcom_category(sheet):
    """Tag sample Q-Com rows for cadence demonstrations; this is not an approved product master."""
    headers = {str(cell.value).strip().lower(): cell.column for cell in sheet[1] if cell.value}
    if "qcom_category" not in headers:
        headers["qcom_category"] = sheet.max_column + 1
        sheet.cell(1, headers["qcom_category"]).value = "qcom_category"
    for row in range(2, sheet.max_row + 1):
        channel = str(sheet.cell(row, headers["channel"]).value or "").strip().lower()
        if channel.replace("-", " ").replace("_", " ") != "quick commerce":
            continue
        sku = str(sheet.cell(row, headers["sku"]).value or "").strip().lower()
        sheet.cell(row, headers["qcom_category"]).value = SYNTHETIC_QCOM_CATEGORIES.get(sku, "")
    return headers


def generate(scenario, filename):
    workbook = load_workbook(BASELINE)
    sheet = workbook.active
    headers = add_fill_rate_columns(sheet)
    headers = add_synthetic_qcom_category(sheet)
    end = max(as_date(sheet.cell(row, headers["date"]).value) for row in range(2, sheet.max_row + 1))
    for row in range(2, sheet.max_row + 1):
        day = as_date(sheet.cell(row, headers["date"]).value)
        age = (end - day).days
        sku = sheet.cell(row, headers["sku"]).value
        channel = sheet.cell(row, headers["channel"]).value
        factor = product_factor(sku, channel, scenario, age)
        if factor == 1:
            continue
        units_cell = sheet.cell(row, headers["units_sold"])
        units_cell.value = max(0, round(float(units_cell.value) * factor))
        if scenario in ("heatwave", "combined") and age <= 35:
            temp = sheet.cell(row, headers["temperature_c"])
            temp.value = round(float(temp.value) + 7.0, 1)
        if scenario in ("festival", "combined") and age <= 21:
            sheet.cell(row, headers["festival"]).value = 1
        if scenario in ("promotions", "combined") and age <= 28:
            sheet.cell(row, headers["promotion"]).value = 1
    add_fill_rate_columns(sheet)
    workbook.save(DATA / filename)


if __name__ == "__main__":
    baseline_book = load_workbook(BASELINE)
    add_fill_rate_columns(baseline_book.active)
    add_synthetic_qcom_category(baseline_book.active)
    baseline_book.save(BASELINE)
    baseline_book.close()
    for name, filename in (
        ("heatwave", "02_heatwave.xlsx"),
        ("festival", "03_festival.xlsx"),
        ("promotions", "04_promotions.xlsx"),
        ("combined", "05_combined.xlsx"),
    ):
        generate(name, filename)
    print("Regenerated four scenario workbooks from the baseline. All figures are synthetic.")
