"""Precompute inspection and forecast results for the bundled sample workbooks.

Runs at Docker build time, where CPU is plentiful, so the deployed server can answer the
sample scenario buttons from forecast-cache/ instead of retraining LightGBM on a small
shared CPU. File names must match server.js cachedResult keys:
  inspect-<sha256 of workbook bytes>.json
  forecast-<sha256 of workbook bytes>-h<0|1>f<0|1>p<0|1>.json
"""
import hashlib
import json
import sys
from pathlib import Path

import forecast_model
import inspect_workbook

ROOT = Path(__file__).parent
DATA = ROOT / "forecast-data"
CACHE = ROOT / "forecast-cache"

# Scenario each sample button sends, plus the app's default switches (heatwave on),
# which the baseline button and uploads use.
DEFAULT = (True, False, False)
SAMPLES = {
    "01_baseline.xlsx": [(False, False, False), DEFAULT],
    "02_heatwave.xlsx": [(True, False, False)],
    "03_festival.xlsx": [(False, True, False), DEFAULT],
    "04_promotions.xlsx": [(False, False, True), DEFAULT],
    "05_combined.xlsx": [(True, True, True), DEFAULT],
}


def tag(heatwave, festival, promotion):
    return f"h{int(heatwave)}f{int(festival)}p{int(promotion)}"


def main():
    CACHE.mkdir(exist_ok=True)
    for name, scenarios in SAMPLES.items():
        path = DATA / name
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        (CACHE / f"inspect-{digest}.json").write_text(json.dumps(inspect_workbook.inspect(str(path))), encoding="utf-8")
        for heatwave, festival, promotion in dict.fromkeys(scenarios):
            scenario = {"heatwave": heatwave, "festival": festival, "promotion": promotion}
            result = forecast_model.run(str(path), scenario)
            (CACHE / f"forecast-{digest}-{tag(heatwave, festival, promotion)}.json").write_text(json.dumps(result, allow_nan=False), encoding="utf-8")
            print(f"cached {name} {tag(heatwave, festival, promotion)}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
