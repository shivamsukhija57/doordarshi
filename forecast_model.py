"""Excel-in / LightGBM-out forecast endpoint helper for the local prototype."""
import datetime as dt
import json
import math
import re
import sys
import traceback
from collections import defaultdict

import numpy as np
import lightgbm as lgb
from openpyxl import load_workbook
from openpyxl.utils.datetime import from_excel


FEATURES = [
    "sku_code", "market_code", "channel_code", "lag_1", "lag_7",
    "rolling_mean_7", "temperature_c", "promotion", "festival",
    "in_stock", "day_of_week", "day_of_year_sin", "day_of_year_cos",
]
REQUIRED = [
    "date", "sku", "market", "channel", "units_sold", "temperature_c",
    "promotion", "festival", "in_stock",
]
OPTIONAL = ["units_requested", "units_fulfilled", "on_hand_units", "search_intent", "platform", "qcom_category"]


def is_quick_commerce_channel(channel):
    normalized = str(channel or "").strip().lower().replace("-", " ").replace("_", " ")
    return normalized in {"quick commerce", "quickcommerce", "q commerce"}


def normalize_qcom_category(value):
    normalized = str(value or "").strip().lower().replace("_", "-").replace(" ", "-")
    if normalized == "dmef":
        return "DMEF"
    if normalized in {"non-dmef", "nondmef", "longer-shelf-life", "longer-shelf-life-products"}:
        return "Non-DMEF"
    return None


def parse_date(value):
    if isinstance(value, dt.datetime):
        return value.date()
    if isinstance(value, dt.date):
        return value
    if isinstance(value, (int, float)):
        return from_excel(value).date()
    if isinstance(value, str):
        return dt.date.fromisoformat(value[:10])
    raise ValueError("Date values must be valid Excel dates or YYYY-MM-DD text.")


def parse_flag(value):
    """Parse common spreadsheet booleans without treating the string 'false' as true."""
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)) and value in (0, 1):
        return int(value)
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"1", "true", "yes", "y"}:
            return 1
        if normalized in {"0", "false", "no", "n"}:
            return 0
    raise ValueError("Boolean fields must contain 0/1, true/false, or yes/no values.")


def read_history(filename):
    workbook = load_workbook(filename, read_only=True, data_only=True)
    sheet = workbook.active
    iterator = sheet.iter_rows(values_only=True)
    headers = [str(value or "").strip().lower() for value in next(iterator, ())]
    missing = [name for name in REQUIRED if name not in headers]
    if missing:
        raise ValueError("Missing required columns: " + ", ".join(missing))
    positions = {name: headers.index(name) for name in REQUIRED}
    positions.update({name: headers.index(name) for name in OPTIONAL if name in headers})
    groups = defaultdict(list)
    for excel_row, values in enumerate(iterator, start=2):
        try:
            row = {name: values[index] for name, index in positions.items()}
            day = parse_date(row["date"])
            sku, market, channel = (str(row[name]).strip() for name in ("sku", "market", "channel"))
            if not sku or not market or not channel:
                continue
            platform = str(row.get("platform") or "").strip()
            normalized_channel = channel.strip().lower().replace("-", " ").replace("_", " ")
            quick_commerce = is_quick_commerce_channel(channel)
            if platform and quick_commerce:
                channel = f"Quick commerce · {platform}"
            qcom_category = normalize_qcom_category(row.get("qcom_category")) if quick_commerce else None
            units = float(row["units_sold"])
            temperature = float(row["temperature_c"])
            promotion = parse_flag(row["promotion"])
            festival = parse_flag(row["festival"])
            in_stock = parse_flag(row["in_stock"])
            optional_values = {}
            for name in OPTIONAL:
                value = row.get(name)
                try:
                    number = float(value) if value is not None and str(value).strip() else None
                    optional_values[name] = number if number is not None and math.isfinite(number) and number >= 0 else None
                except (TypeError, ValueError):
                    optional_values[name] = None
            if not all(math.isfinite(number) for number in (units, temperature)) or units < 0:
                continue
            groups[(sku, market, channel)].append({
                "date": day, "units": units, "temperature": temperature,
                "promotion": promotion, "festival": festival, "in_stock": in_stock,
                "units_requested": optional_values["units_requested"],
                "units_fulfilled": optional_values["units_fulfilled"],
                "on_hand_units": optional_values["on_hand_units"],
                "search_intent": optional_values["search_intent"],
                "platform": platform or None,
                "qcom_category": qcom_category,
                "excel_row": excel_row,
            })
        except (ValueError, TypeError, IndexError):
            continue
    workbook.close()
    groups = {key: sorted(rows, key=lambda item: item["date"]) for key, rows in groups.items()}
    groups = {key: rows for key, rows in groups.items() if len(rows) >= 21}
    dates = sorted({row["date"] for rows in groups.values() for row in rows})
    if len(dates) < 35:
        raise ValueError("Upload at least 35 days of dated history for a useful forecast.")
    if not groups:
        raise ValueError("No product / market / channel series has at least 21 records.")
    return groups, dates


def build_category_maps(groups):
    dimensions = [sorted({key[i] for key in groups}) for i in range(3)]
    return [{value: index for index, value in enumerate(values)} for values in dimensions]


def feature_row(key, history, current_date, exog, category_maps):
    if len(history) < 7:
        raise ValueError("Each series needs seven initial observations.")
    day_of_year = current_date.timetuple().tm_yday
    angle = 2 * math.pi * day_of_year / 365.25
    lag_values = [item["units"] for item in history[-7:]]
    return [
        category_maps[0][key[0]], category_maps[1][key[1]], category_maps[2][key[2]],
        history[-1]["units"], history[-7]["units"], sum(lag_values) / 7,
        exog["temperature"], exog["promotion"], exog["festival"], exog["in_stock"],
        current_date.weekday(), math.sin(angle), math.cos(angle),
    ]


def make_training_rows(groups, category_maps, cutoff=None):
    matrix, target = [], []
    for key, rows in groups.items():
        rows = [row for row in rows if cutoff is None or row["date"] <= cutoff]
        weekday_sales = defaultdict(list)
        available_sales = []
        history_rows = []
        for index, current in enumerate(rows):
            if index >= 7 and current["in_stock"] == 1:
                matrix.append(feature_row(key, history_rows, current["date"], current, category_maps))
                target.append(current["units"])
            if current["in_stock"] == 1:
                history_rows.append({**current, "units": current["units"]})
                weekday_sales[current["date"].weekday()].append(current["units"])
                available_sales.append(current["units"])
            else:
                prior_weekday = weekday_sales[current["date"].weekday()]
                baseline = float(np.median(prior_weekday)) if prior_weekday else (float(np.median(available_sales)) if available_sales else current["units"])
                history_rows.append({**current, "units": max(current["units"], baseline)})
    if len(target) < 40:
        raise ValueError("Not enough in-stock training examples. Provide more history or series.")
    return np.asarray(matrix, dtype=np.float32), np.asarray(target, dtype=np.float32)


def estimate_historical_demand(models, groups, category_maps):
    """Estimate unconstrained demand on out-of-stock dates; keep observed sales otherwise."""
    estimates = []
    adjusted_groups = {}
    for key, rows in groups.items():
        weekday_sales = defaultdict(list)
        available_sales = []
        history = []
        adjusted_rows = []
        for row in rows:
            estimated = row["units"]
            if row["in_stock"] != 1:
                if len(history) >= 7:
                    exog = {"temperature": row["temperature"], "promotion": row["promotion"], "festival": row["festival"], "in_stock": 1}
                    features = np.asarray([feature_row(key, history, row["date"], exog, category_maps)], dtype=np.float32)
                    estimated = max(row["units"], float(models[0.5].predict(features)[0]), 0.0)
                else:
                    same_weekday = weekday_sales[row["date"].weekday()]
                    estimated = max(row["units"], float(np.median(same_weekday)) if same_weekday else (float(np.median(available_sales)) if available_sales else row["units"]))
            adjusted = {**row, "units": estimated, "observed_units": row["units"], "estimated_demand": estimated}
            history.append(adjusted)
            if row["in_stock"] == 1:
                weekday_sales[row["date"].weekday()].append(row["units"])
                available_sales.append(row["units"])
            adjusted_rows.append(adjusted)
            estimates.append({
                "date": row["date"].isoformat(), "sku": key[0], "market": key[1], "channel": key[2],
                "observedUnits": round(row["units"], 1), "estimatedDemand": round(estimated, 1),
                "inStock": bool(row["in_stock"]), "estimatedLostDemand": round(max(0.0, estimated - row["units"]), 1) if row["in_stock"] != 1 else 0.0,
                "unitsRequested": row.get("units_requested"), "unitsFulfilled": row.get("units_fulfilled"),
                "onHandUnits": row.get("on_hand_units"), "searchIntent": row.get("search_intent"),
            })
        adjusted_groups[key] = adjusted_rows
    return estimates, adjusted_groups


def fit_models(groups, category_maps, cutoff=None):
    features, target = make_training_rows(groups, category_maps, cutoff)
    models = {}
    for quantile in (0.1, 0.5, 0.9):
        parameters = {
            "objective": "quantile", "alpha": quantile, "metric": "quantile",
            "learning_rate": 0.035, "num_leaves": 15, "max_depth": 5,
            "min_data_in_leaf": 18, "lambda_l2": 1.5, "verbosity": -1,
            "num_threads": 1, "seed": 42, "feature_fraction_seed": 42,
            "data_random_seed": 42,
        }
        training_set = lgb.Dataset(features, label=target, categorical_feature=[0, 1, 2], free_raw_data=True)
        model = lgb.train(parameters, training_set, num_boost_round=140)
        models[quantile] = model
    return models, len(target)


def predict_path(models, groups, category_maps, dates, scenario=None, realized_exog=False, exog_groups=None):
    scenario = scenario or {}
    predicted = []
    for key, rows in groups.items():
        history = list(rows)
        exog_rows = (exog_groups or groups).get(key, rows)
        row_by_date = {row["date"]: row for row in exog_rows}
        weekday_temps = defaultdict(list)
        for row in rows[-56:]:
            weekday_temps[row["date"].weekday()].append(row["temperature"])
        for forecast_date in dates:
            actual_exog = row_by_date.get(forecast_date) if realized_exog else None
            if actual_exog:
                temperature = actual_exog["temperature"]
                promotion = actual_exog["promotion"]
                festival = actual_exog["festival"]
                # Forecast unconstrained demand; availability must not suppress its target.
                in_stock = 1
            else:
                values = weekday_temps[forecast_date.weekday()]
                temperature = sum(values[-4:]) / max(1, len(values[-4:])) if values else 25.0
                temperature += 2.5 if scenario.get("heatwave") and key[0].lower().find("buttermilk") >= 0 else 0
                temperature += 1.8 if scenario.get("heatwave") and key[0].lower().find("dahi") >= 0 else 0
                promotion = int(bool(scenario.get("promotion", False)))
                festival = int(bool(scenario.get("festival", False)))
                in_stock = 1
            exog = {"temperature": temperature, "promotion": promotion, "festival": festival, "in_stock": in_stock}
            features = np.asarray([feature_row(key, history, forecast_date, exog, category_maps)], dtype=np.float32)
            p10 = max(0.0, float(models[0.1].predict(features)[0]))
            p50 = max(0.0, float(models[0.5].predict(features)[0]))
            p90 = max(p50, float(models[0.9].predict(features)[0]))
            p10 = min(p10, p50)
            predicted.append({
                "date": forecast_date.isoformat(), "sku": key[0], "market": key[1], "channel": key[2],
                "platform": next((row.get("platform") for row in rows if row.get("platform")), None),
                "qcomCategory": next(iter({row.get("qcom_category") for row in rows})) if len({row.get("qcom_category") for row in rows}) == 1 else None,
                "p10": round(p10, 1), "forecast": round(p50, 1), "p90": round(p90, 1),
            })
            history.append({"date": forecast_date, "units": p50, "temperature": temperature,
                            "promotion": promotion, "festival": festival, "in_stock": 1})
            weekday_temps[forecast_date.weekday()].append(temperature)
    return predicted


def build_qcom_forecast(forecast_rows):
    """Present the existing daily LightGBM path at the requested Q-Com cadence by SKU and city."""
    qcom_rows = [row for row in forecast_rows if is_quick_commerce_channel(str(row["channel"]).split("·", 1)[0])]
    if not qcom_rows:
        return {
            "dailyDmef": [], "weeklyNonDmef": [], "unclassified": [], "dailyDmefByCity": [],
            "coverage": {"qcomSkus": 0, "dmefSkus": 0, "nonDmefSkus": 0, "unclassifiedSkus": 0,
                         "platforms": [], "cities": [], "classifiedSkuCoveragePercent": 0},
        }

    categories_by_sku = defaultdict(set)
    missing_category_skus = set()
    for row in qcom_rows:
        if row.get("qcomCategory") in {"DMEF", "Non-DMEF"}:
            categories_by_sku[row["sku"]].add(row["qcomCategory"])
        else:
            missing_category_skus.add(row["sku"])
    sku_category = {
        sku: next(iter(categories)) if len(categories) == 1 and sku not in missing_category_skus else None
        for sku, categories in categories_by_sku.items()
    }
    for sku in missing_category_skus:
        sku_category.setdefault(sku, None)

    daily = defaultdict(lambda: {"p10": 0.0, "forecast": 0.0, "p90": 0.0})
    weekly = defaultdict(lambda: {"forecast7d": 0.0, "weekStart": None, "weekEnd": None})
    unknown = defaultdict(float)
    for row in qcom_rows:
        category = sku_category.get(row["sku"])
        platform = row.get("platform") or "All Q-Com"
        group = (row["sku"], row["market"], platform)
        if category == "DMEF":
            key = (*group, row["date"])
            daily[key]["p10"] += row["p10"]
            daily[key]["forecast"] += row["forecast"]
            daily[key]["p90"] += row["p90"]
        elif category == "Non-DMEF":
            item = weekly[group]
            item["forecast7d"] += row["forecast"]
            item["weekStart"] = row["date"] if item["weekStart"] is None else min(item["weekStart"], row["date"])
            item["weekEnd"] = row["date"] if item["weekEnd"] is None else max(item["weekEnd"], row["date"])
        else:
            unknown[group] += row["forecast"]

    daily_rows = [
        {"sku": sku, "market": market, "platform": platform, "date": date, **{name: round(value) for name, value in amounts.items()}}
        for (sku, market, platform, date), amounts in sorted(daily.items())
    ]
    weekly_rows = [
        {"sku": sku, "market": market, "platform": platform, "forecast7d": round(item["forecast7d"]),
         "weekStart": item["weekStart"], "weekEnd": item["weekEnd"]}
        for (sku, market, platform), item in sorted(weekly.items())
    ]
    unknown_rows = [
        {"sku": sku, "market": market, "platform": platform, "forecast7d": round(value)}
        for (sku, market, platform), value in sorted(unknown.items())
    ]
    dmef_city = defaultdict(lambda: {"p10": 0.0, "forecast": 0.0, "p90": 0.0, "seriesCount": 0})
    for row in daily_rows:
        item = dmef_city[(row["date"], row["market"])]
        for name in ("p10", "forecast", "p90"):
            item[name] += row[name]
        item["seriesCount"] += 1
    daily_by_city = [
        {"date": date, "market": market, **{name: round(value) if name != "seriesCount" else value for name, value in totals.items()}}
        for (date, market), totals in sorted(dmef_city.items())
    ]
    qcom_skus = {row["sku"] for row in qcom_rows}
    classified = {sku for sku in qcom_skus if sku_category.get(sku) in {"DMEF", "Non-DMEF"}}
    return {
        "dailyDmef": daily_rows,
        "dailyDmefByCity": daily_by_city,
        "weeklyNonDmef": weekly_rows,
        "unclassified": unknown_rows,
        "coverage": {
            "qcomSkus": len(qcom_skus), "dmefSkus": sum(value == "DMEF" for value in sku_category.values()),
            "nonDmefSkus": sum(value == "Non-DMEF" for value in sku_category.values()),
            "unclassifiedSkus": len(qcom_skus - classified),
            "classifiedSkuCoveragePercent": round(100 * len(classified) / len(qcom_skus), 1) if qcom_skus else 0,
            "platforms": sorted({row.get("platform") for row in qcom_rows if row.get("platform")}),
            "cities": sorted({row["market"] for row in qcom_rows}),
        },
    }


def backtest(groups, all_dates, category_maps):
    if len(all_dates) < 49:
        return {"mae": None, "mad": None, "mape": None, "bias": None, "wape": None, "testedDays": 0, "note": "At least 49 distinct days are needed for the seven-day holdout."}
    cutoff_index = len(all_dates) - 8
    cutoff = all_dates[cutoff_index]
    test_dates = all_dates[cutoff_index + 1:cutoff_index + 8]
    train_groups = {key: [row for row in rows if row["date"] <= cutoff] for key, rows in groups.items()}
    train_groups = {key: rows for key, rows in train_groups.items() if len(rows) >= 21}
    models, _ = fit_models(train_groups, category_maps)
    _, adjusted_train_groups = estimate_historical_demand(models, train_groups, category_maps)
    forecasts = predict_path(models, adjusted_train_groups, category_maps, test_dates, realized_exog=True, exog_groups=groups)
    actuals = {(key, row["date"]): row["units"] for key, rows in groups.items() for row in rows if row["date"] in test_dates and row["in_stock"] == 1}
    errors, signed_errors, percentage_errors, actual_values = [], [], [], []
    for item in forecasts:
        key = (item["sku"], item["market"], item["channel"])
        actual = actuals.get((key, dt.date.fromisoformat(item["date"])))
        if actual is not None:
            signed_error = float(item["forecast"] - actual)
            errors.append(abs(signed_error))
            signed_errors.append(signed_error)
            if actual > 0:
                percentage_errors.append(abs(signed_error) / actual)
            actual_values.append(actual)
    if not errors:
        return {"mae": None, "mad": None, "mape": None, "bias": None, "wape": None, "testedDays": 0, "note": "No matching held-out records were available."}
    denominator = sum(actual_values)
    return {
        "mae": round(sum(errors) / len(errors), 2),
        "mad": round(sum(errors) / len(errors), 2),
        "mape": round(100 * sum(percentage_errors) / len(percentage_errors), 2) if percentage_errors else None,
        "bias": round(sum(signed_errors) / len(signed_errors), 2),
        "wape": round(100 * sum(errors) / denominator, 2) if denominator else None,
        "testedDays": len(test_dates), "testedPoints": len(errors), "mapePoints": len(percentage_errors),
        "note": "Seven-day rolling holdout scored only on in-stock observations; stockout sales are excluded. MAPE excludes zero-actual points. Bias is forecast minus actual, so positive values indicate over-forecasting.",
    }


def fit_holt_winters_additive(values, horizon, period=7):
    values = np.asarray(values, dtype=float)
    if len(values) < period * 3:
        return None
    try:
        from statsmodels.tsa.holtwinters import ExponentialSmoothing
    except ImportError:
        ExponentialSmoothing = None
    if ExponentialSmoothing is not None:
        fitted = ExponentialSmoothing(
            values,
            trend="add",
            seasonal="add",
            seasonal_periods=period,
            initialization_method="estimated",
        ).fit(optimized=True, use_brute=True)
        forecasts = np.maximum(0.0, np.asarray(fitted.forecast(horizon), dtype=float)).tolist()
        parameters = fitted.params
        return {
            "forecasts": forecasts,
            "parameters": {
                "alpha": round(float(parameters["smoothing_level"]), 3),
                "beta": round(float(parameters["smoothing_trend"]), 3),
                "gamma": round(float(parameters["smoothing_seasonal"]), 3),
            },
            "level": float(np.asarray(fitted.level)[-1]),
            "trendPerDay": float(np.asarray(fitted.trend)[-1]),
            "seasonal": np.asarray(fitted.season, dtype=float)[-period:].tolist(),
            "implementation": "statsmodels ExponentialSmoothing",
        }

    def initialize(series):
        first, second = series[:period], series[period:period * 2]
        mean_first, mean_second = float(np.mean(first)), float(np.mean(second))
        seasonal = [((float(first[i]) - mean_first) + (float(second[i]) - mean_second)) / 2 for i in range(period)]
        center = float(np.mean(seasonal))
        return mean_second, (mean_second - mean_first) / period, [value - center for value in seasonal]

    best, best_error = (0.3, 0.1, 0.1), float("inf")
    for alpha in (0.1, 0.3, 0.5, 0.7, 0.9):
        for beta in (0.1, 0.3, 0.5, 0.7, 0.9):
            for gamma in (0.1, 0.3, 0.5, 0.7, 0.9):
                level, trend, seasonal = initialize(values)
                error = 0.0
                for index in range(period * 2, len(values)):
                    effect = seasonal[index % period]
                    actual = float(values[index])
                    error += (actual - level - trend - effect) ** 2
                    updated_level = alpha * (actual - effect) + (1 - alpha) * (level + trend)
                    updated_trend = beta * (updated_level - level) + (1 - beta) * trend
                    seasonal[index % period] = gamma * (actual - updated_level) + (1 - gamma) * effect
                    level, trend = updated_level, updated_trend
                if error < best_error:
                    best, best_error = (alpha, beta, gamma), error
    alpha, beta, gamma = best
    level, trend, seasonal = initialize(values)
    for index in range(period * 2, len(values)):
        effect, actual = seasonal[index % period], float(values[index])
        updated_level = alpha * (actual - effect) + (1 - alpha) * (level + trend)
        updated_trend = beta * (updated_level - level) + (1 - beta) * trend
        seasonal[index % period] = gamma * (actual - updated_level) + (1 - gamma) * effect
        level, trend = updated_level, updated_trend
    forecasts = [max(0.0, level + step * trend + seasonal[(len(values) + step - 1) % period]) for step in range(1, horizon + 1)]
    return {
        "forecasts": forecasts,
        "parameters": {"alpha": round(alpha, 3), "beta": round(beta, 3), "gamma": round(gamma, 3)},
        "level": level,
        "trendPerDay": trend,
        "seasonal": seasonal,
        "implementation": "Built-in fallback · statsmodels is not installed",
    }


def score_daily_forecast(predicted, actual):
    pairs = [(float(p), float(a)) for p, a in zip(predicted, actual)]
    if not pairs:
        return {"wape": None, "mad": None, "mape": None, "bias": None, "testedDays": 0}
    errors = [p - a for p, a in pairs]
    absolute_errors = [abs(error) for error in errors]
    nonzero_actuals = [abs(error) / actual for error, (_, actual) in zip(errors, pairs) if actual > 0]
    actual_total = sum(actual for _, actual in pairs)
    return {
        "wape": round(100 * sum(absolute_errors) / actual_total, 2) if actual_total else None,
        "mad": round(float(np.mean(absolute_errors)), 2),
        "mape": round(100 * float(np.mean(nonzero_actuals)), 2) if nonzero_actuals else None,
        "bias": round(float(np.mean(errors)), 2),
        "testedDays": len(pairs),
    }


def holt_winters_widget(adjusted_history, all_dates, future_dates):
    totals = defaultdict(float)
    for item in adjusted_history:
        totals[dt.date.fromisoformat(item["date"])] += item["estimatedDemand"]
    window_dates = all_dates[-56:]
    values = [totals[day] for day in window_dates]
    if len(values) < 28:
        return None
    training, holdout = values[:-7], values[-7:]
    validation = fit_holt_winters_additive(training, len(holdout))
    final = fit_holt_winters_additive(values, len(future_dates))
    if validation is None or final is None:
        return None
    weekday_names = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
    seasonal_dates = window_dates[-7:]
    seasonal_by_weekday = {weekday_names[seasonal_dates[index].weekday()]: round(value, 1) for index, value in enumerate(final["seasonal"])}
    return {
        "model": "Holt–Winters additive exponential smoothing",
        "implementation": final["implementation"],
        "windowDays": len(window_dates),
        "windowStart": window_dates[0].isoformat(),
        "windowEnd": window_dates[-1].isoformat(),
        "seasonLengthDays": 7,
        "levelDailyUnits": round(final["level"]),
        "trendUnitsPerWeek": round(final["trendPerDay"] * 7, 1),
        "weekdaySeasonality": [{"day": day, "effectUnits": seasonal_by_weekday.get(day, 0.0)} for day in weekday_names],
        "parameters": final["parameters"],
        "forecast7d": round(sum(final["forecasts"])),
        "daily": [{"date": day.isoformat(), "forecast": round(value)} for day, value in zip(future_dates, final["forecasts"])],
        "evaluation": score_daily_forecast(validation["forecasts"], holdout),
        "scope": "Aggregate stockout-adjusted daily demand across all products, markets, and channels.",
    }



def holt_winters_milk_widget(adjusted_history, all_dates, future_dates):
    """Fit additive Holt-Winters to daily SKU-derived milk-equivalent demand."""
    rows_by_date = defaultdict(list)
    for item in adjusted_history:
        rows_by_date[item["date"]].append({"sku": item["sku"], "units": item["estimatedDemand"]})
    window_dates = all_dates[-56:]
    window_rows = [row for day in window_dates for row in rows_by_date[day.isoformat()]]
    total_units = sum(max(0.0, float(row.get("units", 0.0))) for row in window_rows)
    mapped_units = sum(max(0.0, float(row.get("units", 0.0))) for row in window_rows if estimate_milk_recipe(row["sku"]))
    coverage_percent = round(100 * mapped_units / total_units, 1) if total_units else 0.0
    daily_values = [milk_requirement_for_rows(rows_by_date[day.isoformat()])["milkLitres"] for day in window_dates]
    if len(daily_values) < 28 or not any(daily_values):
        return None
    training, holdout = daily_values[:-7], daily_values[-7:]
    validation = fit_holt_winters_additive(training, len(holdout))
    final = fit_holt_winters_additive(daily_values, len(future_dates))
    if validation is None or final is None:
        return None
    weekday_names = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
    seasonal_dates = window_dates[-7:]
    seasonal_by_weekday = {weekday_names[seasonal_dates[index].weekday()]: round(value, 1) for index, value in enumerate(final["seasonal"])}
    return {
        "model": "Holt–Winters additive exponential smoothing · milk-equivalent demand",
        "implementation": final["implementation"],
        "windowDays": len(window_dates),
        "windowStart": window_dates[0].isoformat(),
        "windowEnd": window_dates[-1].isoformat(),
        "seasonLengthDays": 7,
        "coveragePercent": coverage_percent,
        "levelDailyUnits": round(final["level"], 1),
        "trendUnitsPerWeek": round(final["trendPerDay"] * 7, 1),
        "weekdaySeasonality": [{"day": day, "effectUnits": seasonal_by_weekday.get(day, 0.0)} for day in weekday_names],
        "parameters": final["parameters"],
        "forecast7d": round(sum(final["forecasts"]), 1),
        "daily": [{"date": day.isoformat(), "forecast": round(value, 1)} for day, value in zip(future_dates, final["forecasts"])],
        "evaluation": score_daily_forecast(validation["forecasts"], holdout),
        "scope": f"SKU-derived milk-equivalent demand from stockout-adjusted product units; {coverage_percent}% of units had a mapped conversion recipe. Conversion recipes are draft assumptions, not a measured raw-milk procurement feed.",
    }

def decompose_demand(groups, all_dates, adjusted_demand=None, window_days=56):
    """Estimate additive level, linear trend, weekday seasonality, and residual noise."""
    selected_dates = all_dates[-window_days:]
    daily_totals = defaultdict(float)
    demand_lookup = {(item["sku"], item["market"], item["channel"], dt.date.fromisoformat(item["date"])): item["estimatedDemand"] for item in (adjusted_demand or [])}
    for key, rows in groups.items():
        for row in rows:
            if row["date"] in selected_dates:
                daily_totals[row["date"]] += demand_lookup.get((*key, row["date"]), row["units"])
    dates = sorted(daily_totals)
    if len(dates) < 14:
        return None

    values = np.asarray([daily_totals[day] for day in dates], dtype=float)
    time = np.arange(len(dates), dtype=float)
    centered_time = time - float(np.mean(time))
    slope, _ = np.polyfit(centered_time, values, 1)
    slope = float(slope)
    detrended = values - slope * centered_time
    weekday_values = defaultdict(list)
    for day, residual in zip(dates, detrended):
        weekday_values[day.weekday()].append(float(residual))
    raw_effects = {day: float(np.mean(weekday_values[day])) for day in range(7) if weekday_values[day]}
    effect_center = float(np.mean(list(raw_effects.values()))) if raw_effects else 0.0
    effects = {day: value - effect_center for day, value in raw_effects.items()}
    level = float(np.mean([value - slope * t - effects.get(day.weekday(), 0.0)
                           for day, value, t in zip(dates, values, centered_time)]))
    current_level = level + slope * float(centered_time[-1])
    errors = np.asarray([
        value - (level + slope * t + effects.get(day.weekday(), 0.0))
        for day, value, t in zip(dates, values, centered_time)
    ], dtype=float)
    noise_rmse = float(np.sqrt(np.mean(np.square(errors))))
    return {
        "windowDays": len(dates),
        "levelDailyUnits": round(current_level),
        "trendUnitsPerWeek": round(slope * 7, 1),
        "trendPercentPerWeek": round(100 * slope * 7 / current_level, 2) if current_level > 0 else None,
        "weekdaySeasonality": [
            {"day": name, "effectUnits": round(effects.get(index, 0.0), 1)}
            for index, name in enumerate(("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"))
        ],
        "noiseRmseUnits": round(noise_rmse, 1),
        "noisePercentOfLevel": round(100 * noise_rmse / current_level, 2) if current_level > 0 else None,
        "method": "Additive OLS trend with centered weekday effects; noise is residual RMSE over observed daily totals.",
    }


def estimate_milk_recipe(sku):
    """Illustrative raw-milk equivalent and planning solids targets per finished SKU unit."""
    match = re.search(r"(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b", str(sku), re.I)
    if not match:
        return None
    amount, unit = float(match.group(1)), match.group(2).lower()
    size_kg = amount if unit == "kg" else amount / 1000 if unit in ("g", "ml") else amount
    name = str(sku).lower()
    if "paneer" in name:
        return {"litresPerUnit": size_kg / 0.16, "fatPercent": 4.5, "snfPercent": 8.5, "basis": "16% draft milk yield; verify plant recipe"}
    if "buttermilk" in name or "chaas" in name:
        return {"litresPerUnit": size_kg, "fatPercent": 3.0, "snfPercent": 8.5, "basis": "finished volume as milk-equivalent proxy; verify recipe"}
    if any(word in name for word in ("dahi", "curd", "yogurt")):
        return {"litresPerUnit": size_kg * 1.03, "fatPercent": 3.0, "snfPercent": 8.5, "basis": "1.03 L/kg draft yield; verify standardization"}
    if "milk" in name:
        return {"litresPerUnit": size_kg, "fatPercent": 3.0, "snfPercent": 8.5, "basis": "1 L/L draft yield; verify product standard"}
    if "ghee" in name:
        return {"litresPerUnit": size_kg * 0.995 / (0.04 * 0.90), "fatPercent": 4.0, "snfPercent": 8.5, "basis": "4% milk fat and 90% recovery mass-balance estimate"}
    if "butter" in name:
        return {"litresPerUnit": size_kg * 0.80 / (0.04 * 0.90), "fatPercent": 4.0, "snfPercent": 8.5, "basis": "4% milk fat and 90% recovery mass-balance estimate"}
    return None


def milk_requirement_for_rows(rows):
    by_sku = defaultdict(lambda: {"units": 0.0, "milkLitres": 0.0, "fatKg": 0.0, "snfKg": 0.0})
    for row in rows:
        recipe = estimate_milk_recipe(row["sku"])
        if not recipe:
            continue
        units = max(0.0, float(row.get("units", 0.0)))
        milk = units * recipe["litresPerUnit"]
        target = by_sku[row["sku"]]
        target["units"] += units
        target["milkLitres"] += milk
        target["fatKg"] += milk * recipe["fatPercent"] / 100
        target["snfKg"] += milk * recipe["snfPercent"] / 100
    milk = sum(item["milkLitres"] for item in by_sku.values())
    fat = sum(item["fatKg"] for item in by_sku.values())
    snf = sum(item["snfKg"] for item in by_sku.values())
    return {
        "milkLitres": round(milk, 1), "fatKg": round(fat, 1), "snfKg": round(snf, 1),
        "fatPercent": round(100 * fat / milk, 2) if milk else 0,
        "snfPercent": round(100 * snf / milk, 2) if milk else 0,
        "skuBreakdown": [{"sku": sku, **{k: round(v, 1) for k, v in vals.items()}} for sku, vals in sorted(by_sku.items())],
    }


def build_milk_planning(stockout_adjusted_history, forecast_rows, all_dates):
    """Build a clearly estimated procurement proxy from daily stockout-adjusted SKU demand."""
    history_days = defaultdict(list)
    for row in stockout_adjusted_history:
        history_days[row["date"]].append({"sku": row["sku"], "units": row["estimatedDemand"]})
    # all_dates contains datetime.date values while history_days is keyed by ISO strings.
    # Normalize before selecting recent days; otherwise this silently produced an empty series.
    recent_dates = [day.isoformat() for day in all_dates if day.isoformat() in history_days][-14:]
    daily_history = [{"date": day, **milk_requirement_for_rows(history_days[day])} for day in recent_dates]
    future_days = defaultdict(list)
    for row in forecast_rows:
        future_days[row["date"]].append({"sku": row["sku"], "units": row["forecast"]})
    daily_forecast = [{"date": day, **milk_requirement_for_rows(future_days[day])} for day in sorted(future_days)]
    avg_litres = sum(day["milkLitres"] for day in daily_history) / len(daily_history) if daily_history else 0.0
    avg_fat = (sum(day["fatKg"] for day in daily_history) / sum(day["milkLitres"] for day in daily_history) * 100) if sum(day["milkLitres"] for day in daily_history) else 0.0
    avg_snf = (sum(day["snfKg"] for day in daily_history) / sum(day["milkLitres"] for day in daily_history) * 100) if sum(day["milkLitres"] for day in daily_history) else 0.0
    forecast_litres = sum(day["milkLitres"] for day in daily_forecast)
    forecast_fat = sum(day["fatKg"] for day in daily_forecast)
    forecast_snf = sum(day["snfKg"] for day in daily_forecast)
    return {
        "basis": "Synthetic demand-derived estimate from stockout-adjusted units by SKU; this is not measured milk procurement.",
        "historyDays": daily_history,
        "forecastDays": daily_forecast,
        "recent14dAverageLitresPerDay": round(avg_litres, 1),
        "recent14dAverageFatPercent": round(avg_fat, 2),
        "recent14dAverageSnfPercent": round(avg_snf, 2),
        "forecastAverageFatPercent": round(100 * forecast_fat / forecast_litres, 2) if forecast_litres else 0,
        "forecastAverageSnfPercent": round(100 * forecast_snf / forecast_litres, 2) if forecast_litres else 0,
        "latestHistoryDay": daily_history[-1] if daily_history else None,
        "skuAssumptions": [
            {"sku": sku, "litresPerUnit": recipe["litresPerUnit"], "fatPercent": recipe["fatPercent"], "snfPercent": recipe["snfPercent"], "basis": recipe["basis"]}
            for sku in sorted({row["sku"] for row in stockout_adjusted_history}) if (recipe := estimate_milk_recipe(sku))
        ],
    }


def run(filename, scenario):
    groups, all_dates = read_history(filename)
    category_maps = build_category_maps(groups)
    evaluation = backtest(groups, all_dates, category_maps)
    models, training_rows = fit_models(groups, category_maps)
    stockout_adjusted_history, demand_groups = estimate_historical_demand(models, groups, category_maps)
    last_date = max(all_dates)
    future_dates = [last_date + dt.timedelta(days=offset) for offset in range(1, 8)]
    forecast_rows = predict_path(models, demand_groups, category_maps, future_dates, scenario)
    holt_winters = holt_winters_widget(stockout_adjusted_history, all_dates, future_dates)
    holt_winters_milk = holt_winters_milk_widget(stockout_adjusted_history, all_dates, future_dates)
    daily = []
    for day in future_dates:
        entries = [row for row in forecast_rows if row["date"] == day.isoformat()]
        daily.append({
            "date": day.isoformat(),
            "p10": round(sum(row["p10"] for row in entries)),
            "forecast": round(sum(row["forecast"] for row in entries)),
            "p90": round(sum(row["p90"] for row in entries)),
        })
    totals = defaultdict(float)
    product_totals = defaultdict(float)
    product_ranges = defaultdict(lambda: {"p10": 0.0, "p50": 0.0, "p90": 0.0})
    sku_daily = defaultdict(lambda: {"p10": 0.0, "forecast": 0.0, "p90": 0.0})
    sku_market_daily = defaultdict(lambda: {"p10": 0.0, "forecast": 0.0, "p90": 0.0})
    recent_product_totals = defaultdict(float)
    channel_totals = defaultdict(float)
    market_totals = defaultdict(float)
    market_series = defaultdict(set)
    channel_recent = defaultdict(lambda: {"sales": 0.0, "adjustedDemand": 0.0, "stockoutSeriesDays": 0, "seriesDays": 0, "lostDemandEstimate": 0.0, "requested": 0.0, "fulfilled": 0.0, "searchIntent": 0.0, "requestedRows": 0, "fulfilledRows": 0, "searchRows": 0})
    recent_dates = set(all_dates[-7:])
    for row in forecast_rows:
        totals[(row["sku"], row["market"], row["channel"])] += row["forecast"]
        product_totals[row["sku"]] += row["forecast"]
        product_ranges[row["sku"]]["p10"] += row["p10"]
        product_ranges[row["sku"]]["p50"] += row["forecast"]
        product_ranges[row["sku"]]["p90"] += row["p90"]
        sku_day = sku_daily[(row["sku"], row["date"])]
        sku_day["p10"] += row["p10"]
        sku_day["forecast"] += row["forecast"]
        sku_day["p90"] += row["p90"]
        market_day = sku_market_daily[(row["sku"], row["market"], row["date"])]
        market_day["p10"] += row["p10"]
        market_day["forecast"] += row["forecast"]
        market_day["p90"] += row["p90"]
        channel_totals[row["channel"]] += row["forecast"]
        market_totals[row["market"]] += row["forecast"]
        market_series[row["market"]].add((row["sku"], row["channel"]))
    for item in stockout_adjusted_history:
        if dt.date.fromisoformat(item["date"]) in recent_dates:
            summary = channel_recent[item["channel"]]
            summary["sales"] += item["observedUnits"]
            summary["adjustedDemand"] += item["estimatedDemand"]
            summary["lostDemandEstimate"] += item["estimatedLostDemand"]
            summary["seriesDays"] += 1
            if not item["inStock"]:
                summary["stockoutSeriesDays"] += 1
            if item["unitsRequested"] is not None:
                summary["requested"] += item["unitsRequested"]
                summary["requestedRows"] += 1
            if item["unitsFulfilled"] is not None:
                summary["fulfilled"] += item["unitsFulfilled"]
                summary["fulfilledRows"] += 1
            if item["searchIntent"] is not None:
                summary["searchIntent"] += item["searchIntent"]
                summary["searchRows"] += 1
    for item in stockout_adjusted_history:
        if dt.date.fromisoformat(item["date"]) in recent_dates:
            recent_product_totals[item["sku"]] += item["estimatedDemand"]
    top_series = [
        {"sku": key[0], "market": key[1], "channel": key[2], "forecast_7d": round(value)}
        for key, value in sorted(totals.items(), key=lambda item: item[1], reverse=True)[:12]
    ]
    importance = sorted(zip(FEATURES, models[0.5].feature_importance(importance_type="gain").tolist()), key=lambda pair: pair[1], reverse=True)[:6]
    latest_inventory = {}
    channel_series_count = defaultdict(int)
    for key, rows in groups.items():
        channel_series_count[key[2]] += 1
        inventory_rows = [row for row in rows if row["on_hand_units"] is not None]
        if inventory_rows:
            latest_inventory[key] = max(inventory_rows, key=lambda row: row["date"])["on_hand_units"]
    inventory_by_channel = defaultdict(float)
    inventory_series_count = defaultdict(int)
    for key, quantity in latest_inventory.items():
        inventory_by_channel[key[2]] += quantity
        inventory_series_count[key[2]] += 1
    return {
        "model": "LightGBM global gradient-boosted regression · quantile P10/P50/P90",
        "horizonDays": 7, "trainingRows": training_rows, "seriesCount": len(groups),
        "historyStart": min(all_dates).isoformat(), "historyEnd": last_date.isoformat(),
        "evaluation": evaluation, "daily": daily, "topSeries": top_series,
        "qcomForecast": build_qcom_forecast(forecast_rows),
        "milkPlanning": build_milk_planning(stockout_adjusted_history, forecast_rows, all_dates),
        "marketSummary": [{"market": market, "forecast7d": round(value), "seriesCount": len(market_series[market])}
                          for market, value in sorted(market_totals.items(), key=lambda item: item[1], reverse=True)],
        "holtWinters": holt_winters,
        "holtWintersMilk": holt_winters_milk,
        "productTotals": [{"sku": sku, "forecast_7d": round(value), **{key: round(amount) for key, amount in product_ranges[sku].items()}} for sku, value in sorted(product_totals.items(), key=lambda item: item[1], reverse=True)],
        "skuDaily": [{"sku": sku, "date": day, **{key: round(amount) for key, amount in values.items()}} for (sku, day), values in sorted(sku_daily.items(), key=lambda item: (item[0][0], item[0][1]))],
        "skuMarketDaily": [{"sku": sku, "market": market, "date": day, **{key: round(amount) for key, amount in values.items()}} for (sku, market, day), values in sorted(sku_market_daily.items(), key=lambda item: (item[0][0], item[0][1], item[0][2]))],
        "recentProductTotals": [{"sku": sku, "demand_7d": round(value)} for sku, value in sorted(recent_product_totals.items(), key=lambda item: item[1], reverse=True)],
        "featureImportance": [{"feature": name, "importance": int(score)} for name, score in importance],
        "decomposition": decompose_demand(groups, all_dates, stockout_adjusted_history),
        "channelSummary": [{
            "channel": channel,
            "channelGroup": "Quick commerce" if channel.lower().startswith("quick commerce · ") else channel,
            "platform": channel.split("·", 1)[1].strip() if channel.lower().startswith("quick commerce · ") else None,
            "forecast7d": round(channel_totals[channel]),
            "recent7dSales": round(channel_recent[channel]["sales"]),
            "recent7dAdjustedDemand": round(channel_recent[channel]["adjustedDemand"]),
            "estimatedLostDemand": round(channel_recent[channel]["lostDemandEstimate"]),
            "stockoutSeriesDays": channel_recent[channel]["stockoutSeriesDays"],
            "seriesDays": channel_recent[channel]["seriesDays"],
            "fillRatePercent": round(100 * channel_recent[channel]["fulfilled"] / channel_recent[channel]["requested"], 1) if channel_recent[channel]["seriesDays"] and channel_recent[channel]["requestedRows"] == channel_recent[channel]["seriesDays"] and channel_recent[channel]["fulfilledRows"] == channel_recent[channel]["seriesDays"] and channel_recent[channel]["requested"] > 0 else None,
            "forecastFillRatePercent": round(100 * channel_recent[channel]["fulfilled"] / channel_recent[channel]["requested"], 1) if channel_recent[channel]["seriesDays"] and channel_recent[channel]["requestedRows"] == channel_recent[channel]["seriesDays"] and channel_recent[channel]["fulfilledRows"] == channel_recent[channel]["seriesDays"] and channel_recent[channel]["requested"] > 0 else None,
            "projectedFulfilledUnits": round(channel_totals[channel] * channel_recent[channel]["fulfilled"] / channel_recent[channel]["requested"]) if channel_recent[channel]["seriesDays"] and channel_recent[channel]["requestedRows"] == channel_recent[channel]["seriesDays"] and channel_recent[channel]["fulfilledRows"] == channel_recent[channel]["seriesDays"] and channel_recent[channel]["requested"] > 0 else None,
            "stockCoverDays": round(inventory_by_channel[channel] / (channel_totals[channel] / 7), 1) if channel_series_count[channel] and inventory_series_count[channel] == channel_series_count[channel] and channel_totals[channel] > 0 else None,
            "searchIntent7d": round(channel_recent[channel]["searchIntent"]) if channel_recent[channel]["seriesDays"] and channel_recent[channel]["searchRows"] == channel_recent[channel]["seriesDays"] else None,
            "requestedUnits7d": round(channel_recent[channel]["requested"]) if channel_recent[channel]["requestedRows"] == channel_recent[channel]["seriesDays"] else None,
            "fulfilledUnits7d": round(channel_recent[channel]["fulfilled"]) if channel_recent[channel]["fulfilledRows"] == channel_recent[channel]["seriesDays"] else None,
            "onHandUnits": round(inventory_by_channel[channel]) if channel_series_count[channel] and inventory_series_count[channel] == channel_series_count[channel] else None,
        } for channel in sorted(set(channel_totals) | set(channel_recent))],
        "fillRateForecastMethod": "Channel weighted fill rate from the latest 7 observed days carried forward as a baseline; requires complete units_requested and units_fulfilled data.",
        "assumptions": "Future demand is forecast assuming product availability; promotion/festival use the selected scenario; temperature uses recent same-weekday averages with a heatwave uplift. Historical stockout demand is a modelled counterfactual, not observed lost orders.",
    }


if __name__ == "__main__":
    try:
        print(json.dumps(run(sys.argv[1], json.loads(sys.argv[2] if len(sys.argv) > 2 else "{}")), allow_nan=False))
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        sys.exit(1)
