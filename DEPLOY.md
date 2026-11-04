# Deploying DoorDarshi on Render

DoorDarshi runs as one Docker web service: Node serves the app and starts Python
(LightGBM) for each forecast. The repository already contains everything Render needs.

| File | Purpose |
|---|---|
| `Dockerfile` | Python 3.12 slim + Node 24 binary + `libgomp1` (needed by LightGBM); installs `requirements-forecast.txt`; listens on `0.0.0.0` |
| `.dockerignore` | Keeps `.env`, local `.python-deps`, `outputs/`, export folders, logs and unused data out of the image |
| `render.yaml` | Blueprint: one Docker web service, Singapore, Free plan (no card needed), single instance, health check on `/` |
| `requirements-forecast.txt` | Python packages; all pinned versions ship Linux wheels for Python 3.12 |

## Deploy

1. Push this repository to GitHub (already at `github.com/shivamsukhija57/doordarshi`).
2. In Render: **New → Blueprint**, pick the repository. Render reads `render.yaml`.
3. When asked, enter `GEMINI_API_KEY` (message drafts, audio, bank analysis and chat).
   Without it the app still runs, using labelled local fallbacks.
4. Click **Apply**. The first build takes about 5–10 minutes.
5. Open the `https://doordarshi-….onrender.com` link when the service is **Live**.

Every push to `main` redeploys automatically.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `GEMINI_API_KEY` | Optional | Set in the Render dashboard; never commit it |
| `GEMINI_TEXT_MODEL`, `GEMINI_TTS_MODEL`, `GEMINI_FALLBACK_MODELS` | Set by `render.yaml` | Change if a model is retired |
| `PORT` | Set by Render | `server.js` reads it |
| `HOST`, `PYTHON` | Set by `Dockerfile` | `0.0.0.0` and `python` |

## Check after deploying

- Login page loads with the "not affiliated with GCMMF or Amul" notice.
- Sign in as the operator, open Control tower → **Run high-temperature scenario**: a forecast proves Python and LightGBM work.
- Society console shows **GEMINI AVAILABLE** (only if the key is set).
- On a phone, a farmer account opens in Gujarati with Sign out visible.

## Limits to know

- **Forecast speed.** The free plan has a small share of one CPU, so training LightGBM takes about a minute per run. The image build runs `warm_forecast_cache.py` (about 1–2 minutes) to precompute the five sample scenarios, so those buttons answer instantly; repeats of any run come from memory. New uploads or other switch combinations still train live.
- **Free plan sleeps.** After about 15 idle minutes the service sleeps; the next visit takes 30–60 seconds to wake it. Open the link a few minutes before a demo and run the whole flow in one sitting.
- **State is in memory.** Sessions, consent grants and shared loan plans reset on every sleep, deploy or restart. For an always-on service, change `plan: free` to `plan: starter` in `render.yaml` (paid; Render asks for a card).
- **Memory.** The Free plan has 512 MB; a forecast uses LightGBM on about 13,000 rows, which fits. Move to a larger plan if forecasts fail with out-of-memory errors in the logs.
- **External services** the page and server call: Google Fonts, GTranslate, Open-Meteo, Nager.Date, Gemini, and the Amul logo from shop.amul.com.

## Before sharing the link publicly

These are known and not yet fixed:

- Demo usernames and passwords are in `server.js` and `README.md`, which are public.
- `/api/demo-accounts/select` returns any account's password without sign-in.
- Any signed-in user can download files from the app folder, including `server.js`.

Anyone with the link could sign in as the operator and use your Gemini key. Share the link only with people you trust until these are fixed.
