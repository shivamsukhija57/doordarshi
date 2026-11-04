# Amul Setu — Complete Project Guide

> **What this file is:** a self-contained description of the Amul Setu prototype — the business problem, what the app does, how it is built, how the data and models work, how to run and host it, and its known limits. It is written so that a person *or another AI model* can understand the whole project without opening the code.
>
> **Status:** academic / interview prototype. All farmers, figures, and sales data are **synthetic**. Not affiliated with, endorsed by, or operated by GCMMF / Amul.

---

## 1. One-paragraph summary

**Amul Setu** ("bridge") is a role-based web prototype that links three groups in Amul's farmer-to-consumer chain: **(1) GCMMF demand planners**, who forecast consumer demand across general trade, institutional and quick-commerce channels; **(2) village cooperative societies and their member farmers**, who receive demand signals, their milk passbook, and plain-language messages in Gujarati/Hindi; and **(3) banks**, which can see a farmer's supply and financial data **only after the farmer personally grants purpose-limited, time-limited consent**. The analytical core is a **stockout-aware LightGBM quantile forecast (P10/P50/P90)** with scenario switches (heatwave, festival, promotion); the governance core is a **farmer-controlled consent flow** for bank data sharing.

---

## 2. The business case it answers

Source: *Case 7 — "How Should Amul Modernise Its Farmer-to-Consumer Supply Chain?"*

- **GCMMF** (brand: Amul) is owned by ~3.6 million dairy farmers in 18,000+ village cooperative societies in Gujarat. FY2025 revenue ≈ ₹65,911 crore.
- **Challenge:** shopping is moving to quick commerce (10-minute delivery) and e-commerce, which expect real-time inventory and demand data. Competitors use data-driven forecasting; Amul's demand visibility still runs mainly through distributors. Fresh, short-shelf-life products need cold chain built for on-demand hyperlocal drops.
- **Constraint:** any centralised digital demand sensing must **not sideline village societies** or undermine **farmer price transparency** — the cooperative's core trust.
- **Opportunity:** use digital-channel data (what sold, where, when) to give farmers earlier demand signals, plan procurement/processing capacity, and raise farmer price realisation.

**Discussion questions the project addresses**

| # | Question | Where the app addresses it |
|---|---|---|
| 1 | Review the digital / quick-commerce solution — what's right, what's missing | Control tower, Distribution channels, Q-Com forecasting, Digital demand pipeline |
| 2 | What data parameters, from which supply-chain points | Workbook schema (§7), pipeline inspection, consent field lists |
| 3 | Marketing & advertising to farmers and consumers | Society message studio (farmer side); consumer marketing is a known gap (§13) |
| 4 | Role of banks alongside GCMMF and societies | Bank console + farmer consent flow |
| 5 | Financial products for Farmer, Society, Consumer | Farmer products implemented (advance, repayment planning, chilling-equipment finance); society/consumer products are a gap (§13) |

---

## 3. Users, roles and access

| Role | Login type | Modules visible | Can do |
|---|---|---|---|
| **Amul Demo Operator** | 1 operator account | All 7 modules | Run forecasts, review signals, draft farmer messages, request bank data access, run consented analysis, share loan plans, reset demo |
| **Farmer** | 10 accounts (F-1001 … F-1010) | Farmer app only, own record only | View milk passbook, approve / decline / revoke bank data requests, view loan discussion shared with them |

- Farmers are blocked server-side from every `/api/*` operator route.
- The operator **cannot grant consent on a farmer's behalf** — consent requires the farmer's own login.
- Credentials are kept by the project owner and are **not included in this document**.

**Synthetic farmer personas** (5 societies, 2 farmers each):

| Society | Farmers |
|---|---|
| Anand Dairy Society | F-1001 Kokilaben Patel, F-1002 Rameshbhai Patel |
| Borsad Milk Society | F-1003 Meenaben Chaudhary, F-1004 Harishbhai Parmar |
| Nadiad Dairy Society | F-1005 Jigneshbhai Desai, F-1006 Kantaben Thakor |
| Petlad Milk Society | F-1007 Bharatbhai Rabari, F-1008 Shantaben Vankar |
| Umreth Dairy Society | F-1009 Dilipbhai Solanki, F-1010 Rupalben Patel |

Each persona has: 14-day milk volume (litres), average fat %, average SNF %, published milk rate (₹/L), other monthly income, household expenses, existing monthly EMI, outstanding loan balance — all fabricated.

---

## 4. Modules (screens)

The app is a single-page app with a left navigation rail. Operator sees all seven; farmers see only *Farmer app*.

### 4.1 Control tower — *Demand overview*
- **Excel upload → LightGBM forecast** (see §6). One-click "Run …" buttons for the five sample scenario workbooks.
- **Presenter switches:** heatwave, festival, promotion (sent as forecast scenario flags).
- **Signals this week:** live public signals — 4-day weather for selected markets (Open-Meteo) and upcoming Indian public holidays (Nager.Date), cached 15 min.
- **Demand outlook:** 7-day daily P10/P50/P90 chart, per-SKU forecasts, top series, feature importance.
- **Demand decomposition** (descriptive, last 56 days): level, linear weekly trend, weekday effects, residual RMSE.
- **Holt–Winters baseline:** additive trend + weekly seasonality on aggregate stockout-adjusted demand, with its own 7-day holdout score.
- **Accuracy panel:** WAPE, MAE, MAD, MAPE, bias on a 7-day rolling holdout (in-stock rows only).
- **Milk-solids requirement:** converts forecast units per SKU into kg of fat and SNF using benchmark compositions (e.g., toned milk 3% fat / 8.5% SNF; paneer 22% / 20%; buttermilk 0.5% / 6.5%).
- **Demand triage / price & promotion review:** operator approves a milk-solids action and records a price-parity decision (logged to the activity log).

### 4.2 Distribution channels — *Channel distribution*
Per channel (General trade, Institutional, Quick commerce · platform): 7-day forecast, recent sales vs stockout-adjusted demand, estimated lost demand, stockout series-days, **fill rate** (fulfilled ÷ requested), projected fulfilled units, **stock cover days**, and **search intent** (kept separate — never added to demand). Metrics show "unavailable" if the workbook lacks the optional fields.

### 4.3 Q-Com forecasting — *SKU cadence & city demand*
- **DMEF** (short-shelf-life, daily-cadence SKUs — synthetic labels: Taaza Milk, Buttermilk): daily SKU × city forecast for 7 days.
- **Non-DMEF** (Masti Dahi, Paneer): daily LightGBM outputs rolled up into a weekly total by SKU × city × platform.
- Lists Q-Com SKUs missing a category. Forecasts are at city level (dark stores aggregated by `market`), not per store.

### 4.4 Digital demand pipeline — *Source ingestion & quality*
Source connection cards (Blinkit, Zepto, Instamart, Amul Store — illustrative), workbook import with validation (`inspect_workbook.py`): required/optional column check, accepted vs rejected rows by reason, duplicates, source coverage, then hand-off of stockout-adjusted history to LightGBM.

### 4.5 Society console — *Member communication*
- **Forecast message studio:** operator prompt + forecast → Gemini drafts a short Gujarati or Hindi farmer message (guard-railed: no invented rates, schemes, quotas or guarantees). Editable.
- **Translation** (Hindi / Gujarati / English) via Google Cloud Translation or Gemini fallback.
- **Audio:** Gemini text-to-speech generates a Gujarati/Hindi voice note.
- **Delivery controls:** send to all or selected farmers → **local demo inbox only** (no SMS/WhatsApp).
- **Collection incentive planner:** forecast-driven, illustrative milk-collection incentive draft; Gemini can arithmetic-check it. Explicitly not an approved bonus, price or eligibility decision.

### 4.6 Farmer app — *Passbook & consent*
- **My milk passbook:** litres, fat, SNF, rate, period payout (volume × published rate).
- **Current milk rate calculation** and **ask for a record review**.
- **Consent inbox:** see a bank's request (purpose, exact field list, 30-day duration) → **Grant** or **Decline**; **Revoke** any time.
- **Loan discussion shared by Amul/bank:** EMI plan and analysis, refreshable. Labelled "discussion draft · not a loan offer".
- **Optional milk-bill repayment:** off by default, farmer opt-in only, 30% cap guide.

### 4.7 Bank console — *Credit assessment*
- Select farmer → **request access** for one of three purposes:

| Purpose key | Label | Fields requested |
|---|---|---|
| `advance` | Milk-payment advance affordability illustration | litres, rate, fat, SNF, other income, household expenses, existing EMI, loan balance |
| `repayment` | Loan repayment planning discussion | litres, rate, other income, household expenses, existing EMI, loan balance |
| `equipment` | Chilling equipment finance discussion | same 8 fields as `advance` |

- Locked until the farmer grants consent. Then: **Loan affordability & repayment planner** (illustrative EMI, monthly remainder, 30% guide), **Operator note + AI analysis** (Gemini, or a labelled rule-based fallback), **follow-up chat**, **share calculation with farmer**.
- AI is instructed never to approve/decline credit, infer missing data, or pressure the farmer.

### 4.8 Cross-cutting
- **Activity / audit log** of operator and farmer actions (browser session).
- **Reset demo** clears grants, requests and shared plans. **Sign out** returns to login.
- **Light/dark theme**; GTranslate language widget in the header.

---

## 5. Architecture

```
Browser (index.html + app.js + styles.css)
   │  fetch('/api/...')  · cookie session (HttpOnly, SameSite=Lax)
   ▼
Node.js server (server.js) — no npm dependencies, Node built-ins only
   ├── auth & sessions (in-memory Map)
   ├── role checks + consent enforcement (in-memory Maps)
   ├── static file serving
   ├── spawn → python forecast_model.py <xlsx> <scenario-json>   → JSON
   ├── spawn → python inspect_workbook.py <xlsx>                  → JSON
   ├── HTTPS → Google Gemini (text + TTS)            [optional key]
   ├── HTTPS → Google Cloud Translation             [optional key]
   └── HTTPS → Open-Meteo (weather), Nager.Date (holidays)  [no key]
```

**Tech stack**

| Layer | Technology |
|---|---|
| Front end | Vanilla JavaScript SPA (template strings → `innerHTML`, `escapeHtml` for user/AI text), CSS, Google Fonts (Inter, Plus Jakarta Sans) |
| Server | Node.js ≥ 18 (`http`, `fs`, `crypto`, `child_process`) — tested on Node 24 |
| Forecasting | Python ≥ 3.10 — `lightgbm==4.7.0`, `numpy`, `scipy`, `openpyxl==3.1.5`, `statsmodels>=0.15,<0.16` (tested on Python 3.14) |
| AI | Gemini text model (`GEMINI_TEXT_MODEL`, default `gemini-3.8-flash`), Gemini TTS (`GEMINI_TTS_MODEL`, default `gemini-3.8-flash-tts`) via the `v1beta/interactions` endpoint |
| State | All in server memory (sessions, requests, grants, shared plans) — lost on restart |

**File map**

| File / folder | Purpose |
|---|---|
| `server.js` | HTTP server, accounts, sessions, all API routes, consent logic, Gemini/translation calls, static serving, login page HTML |
| `app.js` | Entire front end: state, 7 module renderers, charts, planners, consent UI, message studio |
| `index.html` | Shell: nav rail, header, screen containers, GTranslate widget |
| `styles.css` | Styling, light/dark themes |
| `forecast_model.py` | LightGBM training, backtest, stockout adjustment, forecasting, Q-Com rollup, decomposition, Holt–Winters |
| `inspect_workbook.py` | Read-only validation and coverage report for uploaded workbooks |
| `generate_forecast_samples.py` | Regenerates the 4 event-scenario workbooks from the baseline |
| `forecast-data/01…05_*.xlsx` | Synthetic sample workbooks: baseline, heatwave, festival, promotions, combined |
| `requirements-forecast.txt` | Python dependencies |
| `.env.example` | Template for `GEMINI_API_KEY`, `GOOGLE_TRANSLATE_API_KEY`, model overrides |
| `README.md` | Short local run guide |
| `outputs/`, `.sheet_work/`, `.ui-export-preview/`, `.chrome-export-profile/` | Working/export artefacts — not needed to run the app |

---

## 6. Forecasting model (the analytical core)

**Type:** one *global* LightGBM gradient-boosted model across all SKU × market × channel series, trained three times with the **quantile objective** (α = 0.1, 0.5, 0.9) → **P10 / P50 / P90**.

**Features (13):** `sku_code`, `market_code`, `channel_code` (categorical), `lag_1`, `lag_7`, `rolling_mean_7`, `temperature_c`, `promotion`, `festival`, `in_stock`, `day_of_week`, `day_of_year_sin`, `day_of_year_cos`.

**Hyper-parameters:** learning_rate 0.035, num_leaves 15, max_depth 5, min_data_in_leaf 18, lambda_l2 1.5, 140 boosting rounds, seed 42, single thread (deterministic).

**Stockout handling (key design choice)**
1. Out-of-stock days are **excluded as training targets** — sales on those days understate demand.
2. For lag history, stockout days are imputed from the median of prior in-stock same-weekday sales.
3. After fitting, the P50 model estimates **counterfactual (unconstrained) demand** for each stockout day with `in_stock=1` and that day's weather/event flags; floored at observed sales.
4. The difference is reported as **estimated lost (unmet) demand** — a modelled estimate, not observed lost orders.
5. Future forecasts always assume `in_stock=1` → they predict demand, not constrained sales.

**Forecasting procedure**
- Recursive 7-day path per series; each day's P50 feeds the next day's lags.
- Future temperature = mean of the last 4 same-weekday temperatures; **heatwave** adds +2.5 °C for buttermilk and +1.8 °C for dahi; **festival** / **promotion** set their flags to 1.
- P10 ≤ P50 ≤ P90 enforced; negatives floored at 0.

**Evaluation**
- Rolling 7-day holdout: fit on earlier data, score last 7 days (in-stock only) → WAPE, MAE, MAD, MAPE (zero actuals excluded), bias (forecast − actual).
- Holdout uses recorded temperature/event flags → conditional score, possibly optimistic.
- Then refit on all history for the live forecast.

**Companion analyses**
- **Holt–Winters** (statsmodels `ExponentialSmoothing`, additive trend, additive seasonality period 7; built-in fallback if statsmodels unavailable) on aggregate 56-day stockout-adjusted demand.
- **Decomposition:** level, weekly trend, centred weekday effects, residual RMSE (descriptive only).

**Output JSON (main keys):** `daily`, `topSeries`, `productTotals`, `skuDaily`, `recentProductTotals`, `marketSummary`, `channelSummary` (fill rate, stock cover, lost demand, search intent), `qcomForecast`, `featureImportance`, `evaluation`, `holtWinters`, `decomposition`, `assumptions`.

**Minimum data:** ≥ 35 distinct dates, ≥ 21 observations per series, ≥ 40 in-stock training rows.

---

## 7. Data

### 7.1 Upload workbook schema (`.xlsx`, first sheet, one header row, daily rows per SKU × market × channel)

| Column | Required | Type | Meaning |
|---|---|---|---|
| `date` | ✅ | date | Day |
| `sku` | ✅ | text | Product |
| `market` | ✅ | text | City |
| `channel` | ✅ | text | General trade / Institutional / Quick commerce |
| `units_sold` | ✅ | number | Observed sales |
| `temperature_c` | ✅ | number | Daily temperature |
| `promotion` | ✅ | 0/1 | Promotion active |
| `festival` | ✅ | 0/1 | Festival day |
| `in_stock` | ✅ | 0/1 | Product available |
| `units_requested` | optional | number | Orders requested (fill rate) |
| `units_fulfilled` | optional | number | Orders fulfilled (fill rate) |
| `on_hand_units` | optional | number | Inventory (stock cover) |
| `search_intent` | optional | number | Platform searches (separate signal) |
| `platform` | optional | text | Blinkit / Zepto / Instamart / Amul Store |
| `qcom_category` | optional | DMEF / Non-DMEF | Q-Com cadence class |

Upload limit 12 MB. Operator only.

### 7.2 Sample data
Five fictional workbooks (`forecast-data/`), each 180 days × 4 SKUs × 3 markets × 3 channels (≈ 12,960 rows):
- **SKUs:** Amul Taaza Milk 1L, Amul Buttermilk 500ml, Amul Masti Dahi 400g, Amul Paneer 200g
- **Markets:** Ahmedabad, Anand, Pune
- **Channels:** General trade, Institutional, Quick commerce (platforms: Blinkit, Zepto, Instamart, Amul Store)
- **Scenarios:** `01_baseline`, `02_heatwave`, `03_festival`, `04_promotions`, `05_combined` — event workbooks contain deliberate product-specific shifts in their closing weeks.

### 7.3 Data parameters by supply-chain point (case Q2)

| Point in chain | Parameters | In prototype? |
|---|---|---|
| Farmer | litres, fat %, SNF %, rate, payout | ✅ synthetic personas |
| Farmer (financial, consent-gated) | other income, household expenses, existing EMI, loan balance | ✅ synthetic |
| Village society | member list, collection volumes | Partial (society names only) |
| Plant / processing | milk-solids requirement (fat/SNF kg) | ✅ derived from forecast |
| Distribution channels | units sold, requested, fulfilled, on-hand, stockouts | ✅ workbook |
| Quick-commerce platforms | platform, city, search intent, DMEF class | ✅ workbook |
| External signals | weather, public holidays | ✅ live APIs |

---

## 8. Consent model (bank data sharing)

```
Operator/Bank: request(farmer, purpose) ──► status: pending
Farmer (own login): review purpose + full field list + 30-day duration
      ├─ Grant   → grant {fields, purpose, grantedAt, expiresAt = +30 days}
      ├─ Decline → status: declined
      └─ Revoke (any time later) → grant deleted, status: revoked
Bank-side reads (/api/bank/profile, /analyze, chat, share-plan)
      → server checks an active, unexpired grant every time
      → only the granted fields are returned / sent to the AI
```

- Fields are bundled per purpose (all-or-nothing approval).
- AI receives only consented fields plus the purpose — not the farmer's name or ID.
- Nothing is auto-deducted; milk-bill repayment is a separate farmer opt-in.

---

## 9. API reference (server.js)

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /api/demo-accounts` | none | Usernames/roles for the login helper |
| `POST /api/login` · `POST /api/logout` | none / session | Sign in (sets `amul_setu_session` cookie, 8 h) / sign out |
| `GET /api/session` | any | Current user (+ farmer list for operator) |
| `GET /api/gemini/status` | any | Whether Gemini is configured |
| `GET /api/public-signals?markets=A\|B` | operator | Weather + holidays |
| `POST /api/ui/translate` | any signed-in | Translate up to 35 strings to hi/gu/en |
| `POST /api/forecast?heatwave=&festival=&promotion=` | operator | Upload xlsx → LightGBM result |
| `POST /api/pipeline/inspect` | operator | Upload xlsx → validation report |
| `POST /api/gemini` (`task`: message, translate, audio, collection_review, chat) | operator | AI drafting, translation, TTS, arithmetic review, consented bank chat |
| `GET /api/operator/farmer-profile?farmerId=` | operator | Internal milk record (procurement purpose) |
| `GET /api/bank/status?farmerId=` | operator / own farmer | Request & grant status |
| `POST /api/bank/request` | operator | Create access request `{farmerId, purpose}` |
| `POST /api/bank/consent` · `/decline` · `/revoke` | farmer | Respond to / withdraw consent |
| `GET /api/bank/profile?farmerId=` | operator + active grant | Consented fields only |
| `POST /api/bank/analyze` | operator + active grant | AI or rule-based affordability discussion |
| `POST /api/bank/share-plan` | operator + active grant | Share EMI calculation to farmer |
| `GET /api/farmer/loan-plan` | farmer | View shared plan |
| `POST /api/demo/reset` | operator | Clear requests, grants, plans |

---

## 10. Running locally

**Prerequisites:** Node.js ≥ 18, Python ≥ 3.10.

```bash
cd Prototype/farmer-price-transparency
python -m pip install --target .python-deps -r requirements-forecast.txt
node server.js
```
Open `http://127.0.0.1:4173`.

**Environment variables**

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 4173 | Listen port |
| `HOST` | 127.0.0.1 | Bind address (`0.0.0.0` for LAN/container) |
| `PYTHON` | `python` | Python executable |
| `GEMINI_API_KEY` | — | Enables AI drafting, analysis, chat, TTS |
| `GOOGLE_TRANSLATE_API_KEY` | — | Society message translation (Gemini fallback otherwise) |
| `GEMINI_TEXT_MODEL` / `GEMINI_TTS_MODEL` | see §5 | Model overrides |

Keys can go in a local `.env` (git-ignored). Without a key the app runs in **demo mode** with labelled local fallbacks.

**Demo script (≈ 6 min):** operator → run heatwave sample → review signals, approve milk-solids action, record price decision → Bank console: request access for a farmer → sign in as that farmer → grant → sign back in as operator → analyze, plan EMI, share → Society console: draft Gujarati message, generate audio, send to demo inbox → Reset demo.

---

## 11. Hosting options

| Option | When | Notes |
|---|---|---|
| **Tunnel from laptop** (`cloudflared tunnel --protocol http2 --url http://127.0.0.1:4173`, or `ngrok http 4173`) | Live demo/interview | Works only while laptop runs; use `--protocol http2` on networks that block QUIC/UDP |
| **Docker on Render / Railway / Fly.io / VM** | Always-on link | Single always-on instance (state is in memory); ~1 GB RAM; image = Python slim + Node binary + `libgomp1`; exclude `.python-deps`, `outputs`, export folders, `.env` |
| **Netlify** | Only as a proxy front door | Netlify cannot run the Node+Python server; use a `netlify.toml` redirect `/* → backend URL` with status 200 |
| Serverless (Vercel/Netlify Functions) | ❌ | In-memory state + Python LightGBM + long runtimes don't fit |

---

## 12. Security, privacy and compliance status

**Implemented well**
- 256-bit random session tokens; HttpOnly, SameSite=Lax cookie; `Cache-Control: no-store`; `X-Content-Type-Options: nosniff`.
- Server-side role checks; farmers blocked from operator APIs; consent enforced on every bank-side call.
- Purpose limitation, 30-day expiry, farmer-only grant, revoke.
- API keys stay server-side; AI output escaped before rendering; AI gets only consented fields.
- Upload size limits, temp files deleted after processing, path-traversal guard.

**Known issues (open)**

| Severity | Issue |
|---|---|
| Critical | Static handler serves **any file in the app folder** to any signed-in user (incl. `server.js`, `.env`) — must be replaced with an allowlist before public hosting |
| High | Plain-text passwords in source; no login rate limiting; username list public; operator role combines Amul and bank; revoke doesn't delete derived shared plans; third-party GTranslate script on authenticated pages; no CSP / frame-ancestors |
| Medium | No server-side session expiry; no `Secure` cookie flag; no Origin check; no rate limits on AI endpoints; no Python process timeout; error detail returned to client; audit log is browser-only |

**Compliance roadmap (India)**
- **DPDP Act 2023 / DPDP Rules 2025:** full multilingual notice (named bank, AI processor, grievance route), data minimisation per purpose, persistent consent artefacts, erasure on withdrawal/expiry, grievance officer/DPO, access-history view, correction and nomination rights, 72-hour breach reporting, cross-border disclosure for Gemini; consider **RBI Account Aggregator** as the consent manager for financial data.
- **IT Act s.43A / SPDI Rules**, **CERT-In** (6-hour incident reporting, 180-day logs in India), **RBI Digital Lending Directions** (need-based data, explicit consent, India storage, KFS, grievance officer).
- **Production:** OTP login and OTP-confirmed consent, separate bank role, India-region hosting with encryption at rest, hashed credentials, server-side immutable audit log, VAPT before go-live.

---

## 13. Limitations and roadmap

**Prototype limits:** synthetic data only; forecasts and financial figures are illustrative (not operational forecasts, prices, underwriting or loan offers); state resets on restart; Gujarati text unreviewed by a native speaker; backtest scores on fabricated data say nothing about real accuracy; DMEF/Non-DMEF labels and milk-solids benchmarks are assumptions.

**Planned features**
1. **Price realisation trail** — channel economics (MRP, platform/retailer/distributor margins, cold-chain cost) → net realisation per litre of farmer milk → "where your milk rupee goes" waterfall; management proposes a farmer pass-through % of digital surplus, a **farmer-elected board role** approves, farmers see a provisional (P10-based) then settled price difference.
2. **Society planning console** — society master data (members, collection, chilling capacity, fat/SNF); forecast → raw-milk requirement vs expected supply (heatwave lowers supply); allocation by spare capacity; society secretary confirms or flags constraints; no individual quotas, no milk rejected.
3. **Marketing insights** — consumer campaign suggestions from growth, lost demand and event uplifts; farmer pride messaging.
4. **Society and consumer financial products** — society working capital against GCMMF receivables, BMC/cold-chain finance; consumer milk-subscription wallet, co-branded card with farmer-welfare contribution; cattle loans and insurance for farmers.
5. **Data-parameter map** and **cold-chain stock-cover alerts**.

---

## 14. Glossary

| Term | Meaning |
|---|---|
| GCMMF | Gujarat Cooperative Milk Marketing Federation (Amul) |
| Society | Village dairy cooperative that collects members' milk twice daily |
| Fat / SNF | Milk fat % and solids-not-fat %; drive the milk price |
| BMC | Bulk milk cooler (chilling at society level) |
| Q-Com | Quick commerce (Blinkit, Zepto, Instamart) |
| DMEF / Non-DMEF | Daily-cadence short-shelf-life SKUs vs weekly-planned SKUs (prototype labels) |
| P10 / P50 / P90 | Low / median / high forecast quantiles |
| Stockout-adjusted demand | Observed sales with modelled unconstrained demand substituted on out-of-stock days |
| WAPE / MAPE / MAE / Bias | Forecast error metrics (weighted % error, mean % error, mean absolute error, mean signed error) |
| DPDP | India's Digital Personal Data Protection Act, 2023 |
| Account Aggregator | RBI-regulated consent manager for sharing financial data |
| EMI | Equated monthly instalment |
