# DoorDarshi by Amul: Complete Application Guide

> **What this is.** A single, self-contained description of the DoorDarshi prototype: every screen, panel, metric, formula, workflow, API, model and file, plus the strategy, governance, responsible-design, execution, case-alignment, innovation and defence arguments around it. A person or another AI model should be able to understand the whole project from this file alone, without opening the code.
>
> **Status.** This is an academic case-competition prototype for BDA Case 7, *"How Should Amul Modernise Its Farmer-to-Consumer Supply Chain?"*. All farmers, loans and sales figures are **synthetic**. It is **not affiliated with, endorsed by, or operated by GCMMF or Amul.**
>
> **Code state described:** 4 November 2026, GitHub `shivamsukhija57/doordarshi` (branch `main`) plus the local working copy. Demo **passwords are deliberately left out** of this document. Usernames are listed.

---

## Contents

**Part A: The application**

1. Summary
2. The case it answers
3. Roles, accounts and synthetic people
4. App shell (navigation, header, theme, language, session)
5. Sign-in page
6. Modules, screen by screen
7. Loan and consent workflows (state machines)
8. Forecasting engine
9. Data: workbook contract, inspection, sample data
10. Formula sheet
11. Generative AI (Gemini)
12. Translation and voice
13. API reference
14. Architecture, stack and files
15. Security and privacy: what is built and what is open
16. Running, deploying and performance
17. Visual design system
18. Dormant code, known limits and glossary

**Part B: Strategy and defence**

19. The ecosystem it creates
20. Strategic business solution
21. Data governance
22. Responsible design
23. Technical execution
24. Case-to-prototype alignment
25. Innovation
26. Defence: hard questions and answers

---

# PART A: THE APPLICATION

## 1. Summary

**DoorDarshi** ("far-sight", *door* = far, *darshi* = one who sees) **by Amul** is a login-gated, role-based web workspace that links five groups in Amul's farmer-to-consumer chain:

| Group | Role in the app |
|---|---|
| **GCMMF / Amul operations** | Forecast consumer demand by SKU, city and channel (General trade, Institutional, Quick commerce). Read channel service and quick-commerce cadence. Turn demand into a milk-collection plan. Draft member messages. Release milk records to a bank only when a society asks for a specific application. |
| **Village cooperative societies** | A society manager sees only their own members, prepares loan applications for them, forwards farmer-confirmed applications to the bank and answers lender questions. |
| **Farmer members** | See their milk passbook, rate breakdown, society messages (with audio) and loan journey. They confirm or decline applications and bank data access **from their own login**, and choose milk-bill repayment themselves. |
| **Cooperative bank** (fictional *Sahakaar Cooperative Bank*) | A loan desk with an application queue, separated verified-supply and farmer-provided facts, an assessment worksheet without any credit score, a second-person review, offer drafting, repayment tracking and a hardship pause. |
| **Consumers** (indirectly) | Their purchases are the demand signal, and stockout-aware forecasting aims to keep products available. |

It has two cores:

1. **Analytical core:** a **stockout-aware LightGBM quantile forecast (P10/P50/P90, 7 days)** with heatwave, festival and promotion scenarios. It carries a classical **Holt–Winters** milk-equivalent baseline and a **DMEF (daily) / Non-DMEF (weekly)** quick-commerce cadence split, and turns product demand into **milk-equivalent litres, fat and SNF**.
2. **Governance core:** **farmer-controlled, purpose-limited, time-limited data sharing**. Amul releases only the milk record, only for one named application. The farmer separately confirms, and only then are private financial details shared, for 30 days. Nothing is auto-deducted, AI output is labelled as discussion support, and no credit score exists anywhere.

---

## 2. The case it answers

The source is *Case 7: "How Should Amul Modernise Its Farmer-to-Consumer Supply Chain?"*

- **GCMMF** (brand Amul) is owned by about **3.6 million** dairy farmers in **18,000+** village cooperative societies in Gujarat. FY2025 revenue was about **₹65,911 crore**.
- **The shift:** consumers are moving to quick commerce (10-minute delivery) and e-commerce, which expect real-time inventory and demand data. Competitors use data-driven forecasting, while Amul's demand visibility runs mainly through distributors. Fresh, short-shelf-life products need cold-chain readiness for hyperlocal, on-demand drops.
- **The constraint:** centralised digital demand sensing must **not sideline village societies** or weaken **farmer price transparency**, the cooperative's core trust.
- **The opportunity:** use digital-channel data (what sold, where, when) to give farmers earlier demand signals, plan procurement and processing capacity, and improve farmer price realisation.

**Discussion questions and where the app answers them**

| # | Case question | Where the app answers it |
|---|---|---|
| Q1 | Review the digital / quick-commerce solution: what's right and what's missing | Control tower, Distribution channels, Q-Com forecasting, workbook inspection |
| Q2 | Which data parameters, from which supply-chain points | Workbook contract (§9), inspection coverage, milk-equivalent mapping, consent field lists (§7) |
| Q3 | Marketing and advertising to farmers and consumers | Society console message studio (farmer side: AI draft, translation, voice). Consumer marketing is out of scope (§18). |
| Q4 | Role of banks alongside GCMMF and societies | Society → Amul → Farmer → Bank application flow, Sahakaar Loan Desk |
| Q5 | Financial products for farmers, societies and consumers | Milk-payment advance, cattle-care, chilling-equipment finance, dairy equipment, working capital, emergency household loan, animal-health cover (example), consumer offers (example) |

---

## 3. Roles, accounts and synthetic people

### 3.1 Roles and access

| Role | Accounts (usernames) | Modules in the left rail | Rail label |
|---|---|---|---|
| **Amul operator** (`operator`) | `amul.operator`, shown as "Amul Operations Officer" | Control tower, Distribution channels, Q-Com forecasting, Society console, **Farmer records** | OPERATOR MODULES |
| **Bank officer** (`bankOfficer`) | `cooperative.bank`, shown as "Sahakaar Loan Officer", bank: Sahakaar Cooperative Bank | Sahakaar Loan Desk only | BANK WORKSPACE |
| **Society manager** (`societyManager`) | `society.anand`, `society.borsad`, `society.nadiad`, `society.petlad`, `society.umreth` | Society manager only | SOCIETY WORKSPACE |
| **Farmer** (`farmer`) | `farmer01` … `farmer10` | Farmer app, My loan journey | YOUR FARMER ACCOUNT |

- The full module list in code (in order) is: Control tower ▦, Distribution channels ⇄, Q-Com forecasting ◉, Society console ⌂, Farmer app ◉, My loan journey ↗, Bank console ▤, Sahakaar Loan Desk ₹, Society manager ▣.
- The operator's "Farmer app" entry is relabelled **Farmer records** and shows a read-only member record, not the farmer's own app.
- The operator has a "My loan journey" read-only renderer, reachable in code, but the rail filter hides it from the operator.
- The **Bank console** module still exists in code but is hidden from every role (see §18.1).
- **Server-side enforcement:**
  - Each API checks `user.role`.
  - Farmers get HTTP 403 on every `/api/*` route not explicitly opened to them.
  - Society managers see only rows where `society === user.society`.
  - The operator cannot confirm or consent for a farmer, and the society manager cannot either.
- The user badge in the header shows:
  - operator: name
  - society manager: name · society
  - bank officer: name · bank
  - farmer: name · farmer ID

### 3.2 Synthetic farmer personas (5 societies × 2 farmers)

Columns, all values fabricated:
- 14-day litres
- average fat / SNF %
- listed rate ₹/L
- **14-day receipts** = litres × rate
- **monthly milk receipts** = litres × rate × 2
- other monthly income
- **total monthly income**
- essential household expenses
- existing monthly EMI
- outstanding loan balance
- **30% guide** = 30% of total monthly income
- rate breakdown, shown in the Farmer app as fat / SNF component over the ₹32 base

| ID | Name | Society | L/14d | Fat / SNF | ₹/L | 14-day receipts | Monthly milk | Other income | Total income | Expenses | EMI | Balance | 30% guide | Fat / SNF component |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F-1001 | Kokilaben Patel | Anand Dairy Society | 182.4 | 4.2 / 8.6 | 36.50 | 6,657.60 | 13,315.20 | 4,500 | 17,815.20 | 18,000 | 2,500 | 42,000 | 5,344.56 | +2.24 / +2.26 |
| F-1002 | Rameshbhai Patel | Anand Dairy Society | 216.8 | 4.0 / 8.5 | 35.90 | 7,783.12 | 15,566.24 | 3,000 | 18,566.24 | 19,500 | 1,800 | 28,000 | 5,569.87 | +1.82 / +2.08 |
| F-1003 | Meenaben Chaudhary | Borsad Milk Society | 154.2 | 4.5 / 8.7 | 37.40 | 5,767.08 | 11,534.16 | 6,500 | 18,034.16 | 16,500 | 3,200 | 76,000 | 5,410.25 | +2.87 / +2.53 |
| F-1004 | Harishbhai Parmar | Borsad Milk Society | 201.6 | 3.9 / 8.4 | 35.30 | 7,116.48 | 14,232.96 | 2,500 | 16,732.96 | 21,000 | 0 | 0 | 5,019.89 | +1.40 / +1.90 |
| F-1005 | Jigneshbhai Desai | Nadiad Dairy Society | 238.1 | 4.3 / 8.6 | 36.80 | 8,762.08 | 17,524.16 | 5,000 | 22,524.16 | 22,000 | 4,100 | 1,18,000 | 6,757.25 | +2.45 / +2.35 |
| F-1006 | Kantaben Thakor | Nadiad Dairy Society | 142.7 | 4.1 / 8.5 | 36.10 | 5,151.47 | 10,302.94 | 1,800 | 12,102.94 | 15,500 | 2,200 | 35,000 | 3,630.88 | +1.96 / +2.14 |
| F-1007 | Bharatbhai Rabari | Petlad Milk Society | 264.5 | 4.6 / 8.8 | 38.00 | 10,051.00 | 20,102.00 | 7,200 | 27,302.00 | 23,000 | 5,000 | 1,45,000 | 8,190.60 | +3.29 / +2.71 |
| F-1008 | Shantaben Vankar | Petlad Milk Society | 168.9 | 3.8 / 8.3 | 34.90 | 5,894.61 | 11,789.22 | 2,000 | 13,789.22 | 17,000 | 0 | 0 | 4,136.77 | +1.12 / +1.78 |
| F-1009 | Dilipbhai Solanki | Umreth Dairy Society | 223.3 | 4.2 / 8.6 | 36.50 | 8,150.45 | 16,300.90 | 3,800 | 20,100.90 | 20,500 | 2,800 | 63,000 | 6,030.27 | +2.24 / +2.26 |
| F-1010 | Rupalben Patel | Umreth Dairy Society | 187.6 | 4.4 / 8.7 | 37.10 | 6,959.96 | 13,919.92 | 5,400 | 19,319.92 | 18,500 | 1,600 | 24,000 | 5,795.98 | +2.66 / +2.44 |

> **Observation worth using in a defence:** for **all ten** personas, household expenses plus existing EMI exceed the estimated total monthly income (for example F-1001: ₹17,815 income vs ₹20,500 outgoings), so the "monthly remainder" is negative before any new loan. The app shows this honestly ("Review budget") instead of hiding it. That is exactly why it refuses to auto-score or auto-approve.

### 3.3 Society managers

| Username | Name | Society | Sees |
|---|---|---|---|
| `society.anand` | Anand Society Manager | Anand Dairy Society | F-1001, F-1002 |
| `society.borsad` | Borsad Society Manager | Borsad Milk Society | F-1003, F-1004 |
| `society.nadiad` | Nadiad Society Manager | Nadiad Dairy Society | F-1005, F-1006 |
| `society.petlad` | Petlad Society Manager | Petlad Milk Society | F-1007, F-1008 |
| `society.umreth` | Umreth Society Manager | Umreth Dairy Society | F-1009, F-1010 |

The roster API returns `farmerId, name, society, litres, fat, snf, rate` and each member's milk passbook (milk, earnings and society deductions). It **never** returns household income, expenses, EMI or loan balance.

---

## 4. App shell

- **Left rail:**
  - Amul logo (loaded from `shop.amul.com`).
  - **DoorDarshi / by Amul / "Dairy demand & collection planning"**.
  - Role-specific label and module buttons.
  - Footer: "● Training environment ⌑".
- **Header:**
  - Mobile brand block and breadcrumb, *Module / sub-title*. Sub-titles:
    - Demand overview
    - Channel distribution
    - SKU cadence & city demand
    - Member communication
    - Member profile (operator) or Passbook & consent (farmer)
    - Loan application & repayment
    - Application workflow
    - Assigned members & loan support
    - Credit assessment
  - "Training environment" pill.
  - **GTranslate language dropdown:** en, es, fr, de, ja, ko, zh-CN, gu, hi.
  - **Theme toggle:** ☼ Light theme / ◐ Dark theme. Stored in `localStorage['amul-setu-theme-v2']`, default light. The sign-in page uses the same key and default.
  - User badge and **Sign out**.
- **Footer:** "DoorDarshi by Amul · Dairy demand & collection planning", "Planning forecasts support review; published cooperative schedules remain authoritative." and the non-affiliation notice.
- **Toast:** bottom status line (`role="status" aria-live="polite"`), 2.4 s.
- **Dialog:** a native `<dialog>` for explanations and confirmations, closed with × or a backdrop click.
- **Session expiry:** a global `fetch` wrapper catches any 401 from `/api/*` (except login), shows "Your session has ended · sign in again to continue" and redirects to `/` after 1.8 s.
- **Mobile (≤700 px):**
  - two-row header, 44 px touch targets
  - rail hidden for farmers
  - environment pill hidden
  - theme icon drawn with CSS `::before` so translation cannot break it
- **Farmer language default:** the first time a farmer signs in on a browser, the page switches to **Gujarati** once through `doGTranslate('en|gu')`, flagged with `localStorage['doordarshi-farmer-language-defaulted']`. After that, the farmer's own choice in the dropdown wins.
- **`file://` guard:** opening `index.html` directly redirects to `http://127.0.0.1:4173/`.

---

## 5. Sign-in page

The sign-in page is served by `server.js` itself (inline HTML and CSS) at `/` when there is no session.

- **Left (intro) panel:**
  - Amul logo, DoorDarshi / by Amul / tagline.
  - Headline: "One cooperative network. A clearer view of demand, service, and member outcomes."
  - Sub-line: "A unified workspace for cooperative operations, society teams, farmer services, and partner workflows."
  - Badge: "TRAINING ENVIRONMENT · Sample member records are used in this workspace."
- **Right (form) panel:**
  - Eyebrow "WORKSPACE ACCESS", heading "Welcome back".
  - Username and password fields, button "Sign in to DoorDarshi by Amul" (shows "Signing in…" while waiting), and an error line.
- **"Available team accounts"** (collapsible):
  - One button per account showing the name, role line and username:
    - "Amul operations · all modules"
    - "<Society> · Society manager"
    - "<Bank> · Loan desk"
    - "F-100x · Farmer workspace"
  - Clicking a button fills the fields; the password stays masked. Feedback: "Sign-in fields filled for … Password stays masked. Select "Sign in" to continue."
- **Footer:** "Academic case-competition prototype with synthetic data. Not affiliated with, endorsed by, or operated by GCMMF or Amul."
- **Theme:** opens light, and shares its dark/light choice with the app.
- **Session:** login sets cookie `amul_setu_session` (32 random bytes hex, `HttpOnly; SameSite=Lax; Path=/; Max-Age=28800` = **8 hours**).

---

## 6. Modules, screen by screen

### 6.1 Control tower (operator): "Demand & supply overview"

The heading is "DOORDARSHI · OPERATIONS". Quick buttons: **⇄ Distribution channels**, **◉ Q-Com forecasting**.

**A. LightGBM demand forecast panel** ("DEMAND PLANNING · LIGHTGBM", tag P10 · P50 · P90)

- **Dataset controls** (collapsible, open until a forecast exists):
  - Summary: "Loaded: <file>" or "No file loaded".
  - Shared dataset status:
    - status tag: INSPECTING WORKBOOK / INSPECTION PASSED · FORECASTING / READY · SHARED DATASET / INSPECTION PASSED · FORECAST PENDING / REVIEW REQUIRED / WORKBOOK SELECTED
    - accepted rows · rejected · SKUs · markets
    - platforms in the file
    - "Open Q-Com forecasting" button
  - **Excel upload** (`.xlsx`). Choosing a file auto-runs **inspection → forecast**. Tag: AUTO-INSPECT ENABLED / INSPECTING & FORECASTING / DATASET LOADED.
  - Hints: "Choosing a workbook starts inspection automatically…" and "Heatwave and festival use the presenter switches. Set whether a promotion is planned for the next week."
  - Checkbox **"Assume next-week promotions"**.
- **"Load an example demand workbook":** five buttons and five download links. Each button sets its own scenario switches before running:

  | Button | File | heatwave | festival | promotion |
  |---|---|---|---|---|
  | Run standard scenario | 01_baseline.xlsx | off | off | off |
  | Run high-temperature scenario | 02_heatwave.xlsx | on | off | off |
  | Run festival scenario | 03_festival.xlsx | off | on | off |
  | Run promotion scenario | 04_promotions.xlsx | off | off | on |
  | Run combined scenario | 05_combined.xlsx | on | on | on |

  A second row, **Metro portfolio · 15 SKUs, 5 cities**, has the same five scenarios as "Run metro … scenario" buttons using `06_metro_baseline.xlsx`, `07_metro_heatwave.xlsx`, `08_metro_festival.xlsx`, `09_metro_promotions.xlsx` and `10_metro_combined.xlsx`. Sample buttons name the bundled file (`?sample=<file>`) rather than uploading it.

  An upload uses the current switches. The app's default state is heatwave **on**, festival off, promotion off.
- **Errors** appear in a red notice: missing columns, duplicates, Python missing, and so on.
- **"Forecast ready"**: history start to end · N series. Then a **model metrics tile row**:

  | Tile | Value | Note |
  |---|---|---|
  | NEXT 7 DAYS | Σ daily P50 units | "Most likely (P50) units · all products, cities and channels" |
  | NEXT 7 DAYS · MILK DEMAND | Σ forecast milk-equivalent litres | "Milk-equivalent · X% of forecast units mapped" |
  | FORECAST ERROR · WAPE | % | "Units missed as a share of actual demand in last week's test · lower is better" |
  | AVERAGE MISS · MAE | units | "Units per product, city and channel per day" |
  | MAD | units | "Same calculation as MAE, under its planning name" |
  | AVERAGE % MISS · MAPE | % (2 dp) | "Days with zero sales are left out" |
  | BIAS | ±units | "Positive: forecast runs high · negative: forecast runs low" |

- **SKU forecast widget** ("SKU LEVEL · LIGHTGBM OUTPUT", "What demand is building over the next 7 days"):
  - **Product cards** with illustrated SVG packaging, chosen by name:
    - milk pouch
    - buttermilk pouch
    - butter pack
    - ghee tin
    - dahi cup
    - buttermilk cup
    - paneer pack
    - generic pack
  - Each card shows 7-day P50 units, average per day, **share of total %**, and the **P10–P90 range**.
  - Tag: "N SKUs · P10 / P50 / P90".
  - A **CSV download** icon (BOM-prefixed UTF-8, file `amul-sku-daily-forecast.csv`, columns SKU, Location, Date, P10, P50, P90, respecting filters).
  - Collapsible **"Daily forecast by product and city · chart, filters and table"**:
    - location and SKU filter chips
    - an SVG **daily P50 line chart**, by SKU or by location when one SKU and all locations are selected, with hover tooltips showing the P10–P90 range
    - a nested **detailed table** (SKU, location, date, P50, P10–P90)
    - note: "Showing X of Y rows… Intervals are additive sums of per-series quantile predictions, so treat ranges as planning ranges rather than calibrated SKU-level confidence intervals."
- **"Supporting detail · Holt–Winters comparison and LightGBM daily tables"** (collapsible). Holt–Winters is a separate comparison and does not feed the LightGBM forecast:
  - **Milk-equivalent references** (links): NIFTEM paneer handbook, NDDB ghee manufacturing, Tetra Pak AMF process, NIFTEM dahi processing. These describe processing and yields; they do not validate Amul recipes. The same note also appears under Estimated milk-solids demand and the Society console's Milk collection incentive plan.
  - **Holt–Winters milk-equivalent demand panel** ("SEPARATE COMPARISON · MILK DEMAND", tag "N-DAY FIT · WEEKLY SEASON"):
    - tiles LEVEL (L/day), TREND (L/week), NEXT 7 DAYS (L), HOLDOUT WAPE
    - weekly seasonal effects by weekday (bars)
    - α, β, γ
    - next-7-day table
    - holdout MAD, MAPE and bias
    - implementation (statsmodels or built-in fallback)
  - **Daily forecast · all series** table (date, P50, P10–P90).
  - **Highest forecast series · 7 days** table (top 12 product × market × channel).
  - **"What drives this forecast most, strongest first"**: the top-6 LightGBM gain importances in plain words. For example, the heatwave sample shows:
    - last 7-day average
    - same day last week
    - yesterday's demand
    - day of the week
    - season
    - temperature
  - The assumptions text, the evaluation note and "Forecasts are planning estimates, not guarantees."

**B. Tile row** (shown under the forecast panel)

| Tile | Value | Note |
|---|---|---|
| 7-DAY DEMAND | Σ P50 units | LightGBM P50 · selected workbook |
| SKU COVERAGE | number of SKUs | Products included |
| CHANNEL COVERAGE | number of channel rows | Distribution channels represented (each Q-com platform counts as a channel) |
| HISTORY WINDOW | start to end | Workbook observation period |
| BACKTEST MAPE | % | Seven-day rolling holdout · model accuracy |

**C. Demand outlook**: a 7-bar chart, with the summed P10–P90 band behind and the P50 bar in front, and date labels (MM-DD). With no forecast it shows "No forecast loaded".

**D. Demand mix planning signal** ("PLANNING SIGNAL · RULE-BASED")
- Next 7-day demand and the **% change vs the prior 7-day stockout-adjusted demand**.
- The largest contributor SKU and the SKU with the strongest increase.
- **Planner suggestion** (rules):
  - buttermilk or dahi → "review chilled stock cover and cold-chain capacity"
  - paneer → "review paneer inventory cover and production allocation"
  - otherwise → "review daily production and replenishment plans"
- Then: "validate collection and processing capacity". It explicitly **refuses to assert a milk-solids shortfall** without collection-supply data.
- **Acknowledge** button. It logs "Demand signal reviewed · GCMMF planner" in the audit.

**E. Signals this week** (cards)
1. **DEMAND CHANGE:** seven-day outlook %, forecast vs previous 7 days.
2. **CHANNEL MIX:** the leading channel or platform and its units.
3. **AVAILABILITY:** estimated unmet demand. "Historical counterfactual estimate… not observed lost orders."
4. **AVAILABILITY:** stockout exposure, in "out-of-stock days" (product-city-channel days out of stock, summed over the latest 7 days).
5. **DIGITAL INTENT:** search intent. Shown only if the workbook has `search_intent`.

**F. Estimated milk-solids demand** ("DEMAND-TO-SUPPLY · SKU BASED")
- Tiles:
  - EST. FAT IN FORECAST MIX (kg)
  - EST. SNF IN FORECAST MIX (kg)
  - SKU PROFILE COVERAGE (x / y)
  - UNITS COVERED (%)
- Table: product · 7-day P50 · pack size assumption · fat % and kg · SNF % and kg · profile.
- **Category composition benchmarks** (fat % / SNF %):
  - buttermilk 0.5 / 6.5
  - paneer 22 / 20
  - butter 80 / 1.5
  - ghee 99.5 / 0.2
  - dahi 3 / 8.5
  - toned milk 3 / 8.5
- The pack size is parsed from the SKU name (`200g`, `1L`, `500ml`, `400g`). Formula: units × pack kg × benchmark %.
- A notice lists unmapped SKUs.
- The **Farmer incentive · forecast planning cue** card:
  - "Prepare collection communication for <top SKU>"
  - units, share and window
  - "Not calculated · bonus or farmer eligibility"
  - the caveat that it does not prove a shortage, set a bonus or change milk prices

**G. Operational activity**: the latest 5 audit entries (time · role · reason).

### 6.2 Distribution channels (operator): "Channel demand & fulfilment"

The heading is "DISTRIBUTION CHANNELS · MODEL OUTPUT". With no forecast it prompts you to run one in Control tower.

**Tiles**

| Tile | Meaning |
|---|---|
| NEXT 7-DAY FORECAST | Σ channel P50, "N channels · active workbook model" |
| LAST 7-DAY SALES | observed units sold |
| OUT-OF-STOCK DAYS | product-city days out of stock, latest 7 days |
| ESTIMATED UNMET DEMAND | counterfactual estimate · latest 7 days |
| NEXT 7-DAY FILL RATE | forecast-weighted average of channel fill rates ("Recent weighted rate carried forward") |

**Two tabs:**
- **Demand & availability** table:
  - channel
  - next 7-day forecast
  - last 7-day sales
  - stockout-adjusted demand
  - estimated unmet demand
  - availability tag: "N out-of-stock days · x% of product-city days", or "No stockouts in recent window"
- **Fulfilment & intent** table:
  - channel
  - search intent 7d
  - last 7d fill rate
  - next 7d fill rate (baseline)
  - projected fulfilled units
  - stock cover (days)

Any input that is missing shows **"Not provided"**. Nothing is inferred.

The **Availability signals** list shows channels with stockouts, sorted by unmet demand, each with a "Review" tag. The method note explains the counterfactual, the carried-forward fill rate and the completeness requirements. An action bar reads "Model input: … · Run another workbook".

Sample-data facts:
- **6 channel rows:** General trade, Institutional, Quick commerce · Amul Store, Quick commerce · Blinkit, Quick commerce · Instamart, Quick commerce · Zepto
- the samples include `units_requested` and `units_fulfilled`, so fill rates appear
- they have no `on_hand_units` or `search_intent`, so stock cover and search show "Not provided"

### 6.3 Q-Com forecasting (operator): "Q-Com demand forecast"

The heading is "QUICK COMMERCE · SKU PLANNING", tag "LightGBM · selected workbook".

- **Tiles:**
  - **DMEF · TOP SKU** (next 7 daily P50)
  - **NON-DMEF · TOP SKU** (weekly P50)
  - **CLASSIFIED Q-COM SKUs** (x / y, % with a usable category)
  - **DATA COVERAGE** (N cities · N platforms)
- **Cadence tabs:**
  - **Daily · DMEF**: short shelf life · dark-store replenishment.
  - **Weekly · Non-DMEF**: longer shelf life · fulfilment-centre planning.
- **Filters:**
  - SKU, City, Platform.
  - DMEF only: **From date / To date**, with an **Apply dates** button that rejects from > to.
  - Non-DMEF only: **Forecast week**.
  - **Reset filters**.
  - Filters are remembered per cadence.
- **Filtered total:** "FILTERED 7-DAY TOTAL" or "FILTERED WEEKLY TOTAL".
- **Charts:**
  - DMEF: an SVG multi-line chart of daily P50 by SKU, top 6 unless one SKU is filtered.
  - Non-DMEF: horizontal bars of weekly P50 by SKU, top 8.
- **Forecast data** (collapsible, remembered):
  - DMEF: SKU-level daily table (date, SKU, city, platform, P10, P50, P90) and a city-level daily totals table (date, city, daily P50, number of SKU / platform series).
  - Non-DMEF: SKU, city, platform, forecast period, weekly P50.
- **"Q-Com SKUs needing classification"** panel: lists any series without a single consistent category.
- **Note:** sample categories and platform splits are synthetic. Values are city-level aggregates and do **not** forecast individual dark stores.

In the samples:
- 4 Q-Com SKUs, 100% classified
- **DMEF:** Amul Taaza Milk 1L, Amul Buttermilk 500ml
- **Non-DMEF:** Amul Masti Dahi 400g, Amul Paneer 200g
- 3 cities: Ahmedabad, Anand, Pune
- 4 platforms: Amul Store, Blinkit, Instamart, Zepto

### 6.4 Society console (operator): "Member updates & approvals"

The heading is "SOCIETY OPERATIONS · MEMBER COMMUNICATION".

**Tiles**
- **VILLAGE SOCIETIES**: 5 societies, listed by name (Anand, Borsad, Nadiad, Petlad, Umreth).
- **AVAILABLE MEMBERS**: 10 members.
- **MESSAGE AUDIENCE**: all or selected.
- **PLAN REVIEW**: Awaiting review / Reviewed ("Secretary approval required before delivery").

**Layout:** Review checklist on the left; Member delivery and Activity log stacked on the right, matching its height.

**Review checklist**
- forecast context (units · 7 days)
- plan status
- the prepared plan summary: L/day, fat %, SNF %, ₹/qualifying L, max-cost check vs budget
- **Record plan review** button (disabled until a plan is prepared). It re-validates the plan; if the values changed, it refreshes the draft and asks for review again.

**Member delivery**
- In-app message: **Available**.
- SMS / assisted delivery: **Not connected** (external integration required).

**Activity log**: the audit trail.

**Milk collection incentive plan** ("SOCIETY COLLECTION PLANNING · INTERNAL DRAFT", tag HUMAN REVIEW REQUIRED)
- **Daily milk procurement estimate**, demand-derived and not measured:
  - latest historical day's milk-equivalent litres, from stockout-adjusted SKU units
  - the next 7-day LightGBM run rate in L/day
  - the gap in L/day and %
  - the draft incremental target
  - the implied fat % and SNF % of the product mix
  - recipe coverage
- Collapsibles:
  - *Latest day · SKU-level estimated procurement calculation* (SKU, adjusted units, milk-equivalent, fat/SNF target)
  - *Estimated procurement-equivalent by day · recent 14 days* (date, milk-equivalent, fat mass, SNF mass)
  - *Compare next 7 forecast days*
- Tiles:
  - **LATEST HISTORICAL DAY** (L)
  - **NEXT 7-DAY FORECAST** (L/day, ± vs the latest day)
- **Form** (pre-filled with draft defaults):

  | Field | Default and rule |
  |---|---|
  | Program period | 14 or 21 days |
  | Start date | tomorrow |
  | Forecast milk-equivalent demand (L/day) | read-only: mapped recipes × 7-day P50 / 7 |
  | Proposed additional milk sought (L/day) | max(0, forecast L/day − latest-day L) |
  | Quality focus | Higher fat and SNF (balanced) / Higher fat / Higher SNF |
  | Minimum fat % | product-mix requirement + 0.1 pp unless the focus is SNF only (allowed 0.1–15) |
  | Minimum SNF % | product-mix requirement + 0.1 pp unless the focus is fat only (allowed 0.1–20) |
  | Incentive per qualifying additional litre (₹) | max(0.1, round(2% × ₹36.50, 0.1)) = **₹0.7** |
  | Approved program budget (₹) | additional L/day × days × incentive (recalculates live) |
  | Available collection capacity (L/day) | max(latest-day L, forecast L) × 1.10 |
  | Payment timing / method | "Added to the next milk settlement (draft assumption)" |
  | **Terms and budget confirmed** checkbox | required before a message draft |

- **Validation** (shown as a toast message):
  - the period must be 14 or 21 days
  - a start date is required
  - all numbers must be valid and ≥ 0
  - target, fat, SNF and incentive must be > 0
  - fat ≤ 15, SNF ≤ 20
  - capacity ≥ target
  - **budget ≥ maximum cost** (target × days × incentive)
  - payment terms are required
  - terms must be confirmed
- **Notice:** estimated maximum incentive exposure at the current values.
- **✦ Generate AI review** / **Regenerate AI review**: Gemini `collection_review` checks the arithmetic and returns a summary plus up to 8 field changes (field, current → suggested, reason), shown as advisory.
- **Prepare farmer message draft:**
  - validates the plan and builds an **English template message** with the dates, L/day sought, focus, fat/SNF minimums, ₹ per qualifying litre and payment
  - states "Participation is voluntary; the published base milk price is unchanged" and "contact your society to confirm your own availability and eligibility"
  - logs "Society milk collection plan prepared"
- Unsupported recipes are listed.

**Operator · forecast message studio** (shown to the operator)
- **Forecast context:** the LightGBM P50 total, history, festival flag and P10–P90 range. Tag FORECAST LINKED / NO FORECAST.
- **Prompt** (editable). Default: explain only the approved collection plan, never name consumer products or expose product-demand forecasts.
- **Language** (Gujarati / Hindi / English). **Audience**: all N members or selected farmers, with a checkbox list per farmer.
- **✦ Generate draft:**
  - requires a forecast
  - sends **only the approved collection plan facts** (or the instruction to ask farmers to contact their society) to Gemini `message`
  - tag GEMINI AVAILABLE / GEMINI NOT CONFIGURED
- **Editable message** textarea. Editing clears the audio and the translation preview.
- **文 Translate message** to Hindi / Gujarati / English through **GTranslate**:
  - shows a read-only preview with its title, e.g. "Hindi translation · GTranslate · review before use"
  - **Use as editable message** swaps it in and switches the draft language
  - the source language is auto-detected from the script: Gujarati U+0A80–0AFF, Devanagari U+0900–097F, otherwise English
- **Locked caveat** ("Always included on delivery"): "This is a planning update, not a milk price, quota, credit decision, or guaranteed benefit. Final milk price follows the published cooperative schedule."
- **Voice language + ♫ Generate / refresh audio:**
  - Gemini TTS (voice *Kore*), "Warm, clear, natural <language> cooperative announcement"
  - returns WAV in a player
  - the voice language **must match** the draft language
- **Approve message:** requires the plan review.
- **Send to audience:**
  - if a plan exists, the plan must be unchanged, reviewed and the message approved
  - selected mode needs at least 1 farmer
  - delivers to the farmers' in-app inbox and logs "Forecast message sent"
- **Delivery controls** panel:
  - forecast source
  - human review
  - recipient scope
  - Gemini connection status (the key stays on the server)
  - "review all language output with a Gujarati or Hindi speaker before real use"

### 6.5 Farmer records (operator): read-only member record

The heading is "COOPERATIVE OPERATIONS · MEMBER RECORD".

- **Select member** picker. Changing it loads `/api/operator/farmer-profile` and logs "Internal milk record viewed · cooperative procurement/settlement".
- Banner: member profile, ID · society, READ ONLY.
- Tiles:
  - **RECORDED MILK · 14 DAYS**
  - **AVERAGE FAT / SNF**
  - **PUBLISHED MEMBER RATE**
  - **ESTIMATED MILK RECEIPTS** (14-day volume × rate)
- **Milk passbook** (FULL PASSBOOK): member-since and settled-through dates; lifetime tiles (total milk, milk value, deductions, net paid, fat/SNF, average rate, pours, highest month); a **year-wise summary** by financial year with an all-years total; and a **monthly statement** with pours, milk, fat/SNF, rate, value, deductions, net paid and running total. All of it is synthetic and repeatable per farmer, generated by `farmerPassbook()` in `server.js`; deductions cover cattle feed and society services, not loan repayments.
- **Latest 14 days** (kept below): total litres, fat/SNF, rate, receipts, society, and 3 illustrative pour rows. Per pour = litres/28:
  - 03 Nov evening: ×0.98
  - 03 Nov morning: ×0.86, fat and SNF −0.1
  - 02 Nov evening: ×1.02

  These rows are labelled as illustrative estimates, not transaction lines.
- **Access and use** note: no loan-case, financial-details or lender workflow access from this screen.
- **Bank milk-data access requests** panel ("PURPOSE-LIMITED RECORD SHARING", **Refresh**):
  - one card per pending society application: ID · society, farmer, product, amount, purpose, and the 4 facts to be shared (L/14 days, fat, SNF, ₹/L)
  - "Household income, expenses, and other loans are not included."
  - Button **Approve milk-data access** calls `POST /api/operator/bank-data-requests/:id/release`.

### 6.6 My loan journey (operator, read-only)

The heading is "OPERATOR VIEW · READ ONLY", with a farmer picker. It uses the same layout as §6.8, with no actions. The rail filter currently hides it from the operator; it is reachable only in code.

### 6.7 Farmer app (farmer): "Namaste, <name>"

The heading is "FARMER APP · F-100x", with a society tag.

- **Tiles:**
  - **LAST 14 DAYS** (L, "Recorded collection volume")
  - **AVERAGE FAT / SNF** ("SNF = milk solids other than fat")
  - **CURRENT RATE** ("verify with society schedule")
  - **EXPECTED 14-DAY INCOME** (litres × rate, "before adjustments")
- **My milk passbook:**
  - Always collapsed by default for farmers: "Show collection and settlement entries" holds the lifetime totals, year-wise summary, monthly statement and recent collections (the same synthetic passbook as Farmer records, sent with the farmer's own session only).
  - Latest, previous and earlier collections (litres/28 × 0.98, 0.86, 1.02; fat/SNF; ₹; "Settlement recorded").
  - "How your settlement is calculated · Details →" opens a dialog: "settlement = volume × quality × published schedule; retail prices and settlements are different measures; retail orders are not attributed to a member's deliveries".
  - The 14-day "Milk procurement & farmer payout" estimate.
- **Society update:**
  - APPROVED / WAITING.
  - When a message is addressed to this farmer: "FROM <society> · AI-DRAFTED, SECRETARY-APPROVED", the message in its language, the caveat "Indicative, not a price or quota…", and either the **generated audio player** or a **▶ browser speech preview** (Web Speech API, gu-IN / hi-IN / en-IN, rate 0.82).
  - Otherwise: "Your society's message will appear here after it is addressed to you."
- **Loan-planning information** (legacy bank-consent panel):
  - "Your figures in this account": estimated monthly milk receipts, other income, expenses, EMI, balance. "If any figure looks wrong, ask your society to correct it before you share."
  - When a request is pending: purpose and full field list, with **Decline request** and **Review and approve** at **equal visual weight**.
  - Approving opens a **confirmation dialog**, "Share your details with the bank?":
    - who sees it: partner bank, through the Amul operator
    - why: the purpose
    - until: the date 30 days out, "you can revoke sooner"
    - the list of details
    - "Nothing is deducted from your milk bill unless you separately choose to. Declining has no effect on your milk payments."
    - buttons **Not now** and **Yes, share for 30 days** (double-submit protected)
  - When consent is active: the approved scope, the expiry, and the **"Repay from my milk bill"** checkbox ("Off unless you turn it on · at most 30% of a milk bill · you can turn it off at any time", saved server-side). There is also **Revoke bank access**.
- **Loan discussion shared by Amul**, when a plan was shared:
  - status "Discussion draft · not a loan offer", purpose
  - requested amount, EMI, term and rate, milk volume and rate used, fat/SNF used
  - estimated monthly income, household plus loan costs, remainder after costs and the proposed payment
  - shared time, the AI analysis text, and **Refresh shared plan**
- **Current milk rate calculation:**
  - base **₹32.00/L**
  - **fat component** = max(0, rate − 33.3) × 0.7
  - **SNF component** = rate − 32 − fat component
  - rate applied

  This is an illustrative decomposition so the farmer can see how quality builds the rate.
- **Ask for a record review:** "Collection · Oct 27 evening · Request review". It logs "Collection review requested" with the toast "Review request sent to society". "Your original record stays visible."

### 6.8 My loan journey (farmer): "Your loan journey, <name>"

- Shows the farmer's first linked case, from server cases and local desk seeds de-duplicated by ID.
- **Empty state:** "No loan application linked to this account…"
- **Consent cards:**
  - **Awaiting Amul data access:** "AMUL RECORD ACCESS REVIEW · Your society has prepared an application…" Amul must first authorise the milk record; no private details are shared yet.
  - **Awaiting farmer confirmation:** "YOUR DECISION · REQUIRED BEFORE SOCIETY FORWARDING". If you confirm, the selected financial details are shared with the lender for this case for **30 days**; "The society manager cannot confirm or consent for you." Buttons **Confirm and share selected details** and **Do not confirm**.
- **Banner:** application ID, product, submitted date, society, status pill.
- **Application progress stepper:**
  - society flow: Society prepared → Amul milk-record access → Farmer confirmation → Society forwarded → Bank review
  - desk flow: Application received → Under review → Offer sent → Accepted by farmer → Disbursed → Repaying → Closed
- **"What happens next"**: status-specific plain-language guidance, e.g. "Please provide: …", or "This screen does not accept an offer or enable any repayment deduction".
- **Application summary:** amount, purpose, date, information access ("Until <date>").
- **Offer details:** amount, term, annual rate, indicative EMI. "Check the lender's official documents… not a loan contract."
- **Question from the lender** cards, when more information is needed: previous replies, plus **Your answer** and **Send answer to lender**. The society manager can answer too.
- **Repayment schedule** (due date, amount, status) and **Application updates** (dated activity log).
- Footnote: no credit decision, transmission, offer acceptance, money movement or deduction.

### 6.9 Society manager workspace: "<Society> manager workspace"

The heading is "COOPERATIVE SOCIETY · MEMBER SERVICES", tag "N assigned farmers".

- **Tiles:**
  - **ASSIGNED MEMBERS**
  - **ACTIVE APPLICATIONS** (not Withdrawn / Declined / Closed)
  - **NEED INFORMATION**
- **Assigned farmers:**
  - picker
  - member card: name, ID, litres / 14 days, fat · SNF, rate
  - "The manager cannot view the farmer's household income, expenses, or other loan balances."
- **Milk passbook · <farmer>:** lifetime totals for the selected member (total milk, milk value, deductions, net paid, fat/SNF, average rate, pours, highest month) are always visible; "Show year-wise and monthly statement" expands the tables.
- **"Prepare a loan application for this farmer"** (collapsible):
  - **Loan category**: Cattle-care loan, Dairy equipment loan, Working capital, Emergency household loan, Other purpose.
  - **Requested amount**: ₹1,000 to ₹50,00,000, step 500.
  - **Purpose and brief details**.
  - **Prepare application** calls `POST /api/society/loan-cases`. The new ID is `SM-00001`…, status **Awaiting Amul data access**. One active application per farmer is allowed (HTTP 409 otherwise).
- **Society loan applications** list (status pills). It auto-syncs every **12 s** while visible, unless you are typing in a form; it shows "last synced HH:MM" and has a **Refresh** button.
- **Loan details · <farmer>:**
  - category, amount, applied date, purpose
  - Amul milk-record access (Released to bank / Awaiting Amul operator)
  - farmer confirmation (Confirmed / Awaiting farmer), prepared by
  - **Confirm and forward to bank** appears only when both are done
  - the offer, if shared ("The manager cannot accept an offer or opt in to deductions for the farmer.")
  - the repayment schedule and history
- **Questions from the lender** (across the society): each thread with answers, plus **Add information** and **Send answer** (visible to the farmer and the lender).
- Footnote: the manager coordinates but cannot approve, decide eligibility, consent on a farmer's behalf or authorise deductions.

### 6.10 Sahakaar Loan Desk (bank officer): "Sahakaar Loan Desk"

The heading is "PARTNER BANK · APPLICATION WORKFLOW", tag "TRAINING WORKFLOW · SYNTHETIC CASES".

- **Prototype boundary** note: all actions are local training-workflow transitions; no decision, offer, disbursement or deduction is sent anywhere.
- **Tiles:**
  - **AWAITING REVIEW**: Consent received, Under review, More information needed, Awaiting second review, Offer prepared.
  - **OFFERS WITH FARMERS**: Offer sent.
  - **IN REPAYMENT**: Disbursed, Repaying, Hardship pause.
  - **OVERDUE INSTALMENTS**.
- **Application queue:**
  - search (farmer, ID, application), filter by status and society, sort oldest or newest
  - each row shows name, ID · society, product · amount, status pill and **days in workflow**
  - "Society overview": applications and repaying count per society
- **Application detail:**
  - Header: ID, name, farmer ID · society · applied date, status.
  - 7-step tracker.
  - **Consent scope:** purpose, expiry, fields used, consent state.
  - **Farmer-provided finances**, labelled "Farmer-provided": other income, essential expenses, existing payments, outstanding balance.
  - **Verified Amul supply facts**, labelled "Verified by Amul · date":
    - 14-day volume
    - active pour days x / 14
    - fat vs society average
    - SNF vs society average
    - published rate
    - membership tenure
  - **Bank assessment worksheet**, transparent indicators with **no score**:
    - pour regularity
    - volume trend %
    - quality vs society average (at/above / below)
    - tenure
    - **animal-care data: "Not supplied · do not infer"**
    - data freshness

    "The lender applies its own approved policy… does not calculate a credit score, suggest approval, or determine eligibility."
  - **Decision and repayment workflow**: actions depend on the status (§7.3).
  - **Repayment plan draft:**
    - proposed amount, term (1–60), annual rate (0–60)
    - **seasonal repayment illustration** checkbox
    - summary: **indicative EMI**, **30% per estimated milk bill** (= 14-day litres × rate × 0.30), **two-bill monthly guide** (×2) and the **cap check** (within the illustrative guide / needs review)
  - **"Milk-bill repayment is a separate farmer choice"** banner around offers.
  - **Communication & grievance log:** an internal follow-up note ("Add to case log") and a **grievance summary** ("Log grievance", status Open).
  - **Case activity** timeline.
- For society-originated `SM-*` cases, extra controls are injected:
  - **Refresh farmer / manager replies**
  - **Mark response received** (when answers exist)
  - **Ask for more information**, which posts the question to the server so the farmer and the manager see it

**Seed desk cases** (local), with computed EMI and cap check:

| ID | Farmer | Product | Requested | Status | Offer | EMI | 30%/bill | Two-bill guide | Cap |
|---|---|---|---|---|---|---|---|---|---|
| LD-26041 | F-1001 Kokilaben | Milk-payment advance | 30,000 | Under review | 30,000 · 12 m · 12% | 2,665.46 | 1,997.28 | 3,994.56 | within |
| LD-26042 | F-1002 Rameshbhai | Cattle-care loan | 85,000 | More information needed ("Seasonal income pattern and supplier quotation") | 85,000 · 24 m · 12% · seasonal | 4,001.25 | 2,334.94 | 4,669.87 | within |
| LD-26043 | F-1003 Meenaben | Chilling equipment finance | 1,20,000 | Offer sent | 90,000 · 24 m · 11.5% | 4,215.63 | 1,730.12 | 3,460.25 | **needs review** |
| LD-26044 | F-1004 Harishbhai | Milk-payment advance | 45,000 | Repaying (opted in; instalments 2,600: 10 Nov Paid, 10 Dec Due, 10 Jan Upcoming) | 42,000 · 18 m · 12% | 2,561.25 | 2,134.94 | 4,269.89 | within |

LD-26044 has a **volume trend of −42%**, which crosses the **−40% hardship threshold**, so the "Hardship review triggered" banner and the **Record temporary pause** action appear.

Desk-seed extra fields:

| Case | Pour days | Tenure | Trend | Society fat / SNF |
|---|---|---|---|---|
| LD-26041 | 13 | 48 m | +3.8% | 4.0 / 8.5 |
| LD-26042 | 14 | 36 m | +1.2% | 4.0 / 8.5 |
| LD-26043 | 12 | 62 m | +5.1% | 4.0 / 8.5 |
| LD-26044 | 10 | 36 m | −42% | 4.0 / 8.5 |

---

## 7. Loan and consent workflows

The app has **three** loan-related flows. Two are live in the UI; one is legacy.

### 7.1 Society-originated application (server-side, live): the governance showcase

```
Society manager           Amul operator                 Farmer (own login)                  Society manager        Bank officer
prepare application ───► "Awaiting Amul data access"
                          review: Approve milk-data ──► "Awaiting farmer confirmation"
                          access (milk facts only)      ├─ Confirm & share ─► "Ready for society forwarding" ─► Forward ─► "Forwarded to bank"
                                                        └─ Do not confirm ─► "Farmer did not confirm"                        │
                                                            (bank milk access withdrawn,                                     ▼
                                                             sharedMilkData cleared)                         Ask for info ─► "More information needed"
                                                                                       farmer and/or manager answer ◄──────────┘
                                                                                                    Mark response received ─► "Under review"
```

Each step has a gate:

1. **Prepare** (society manager only, own-society farmer only; amount ₹1,000 to ₹50 lakh, a purpose and a product are required; one active application per farmer).
   - Creates `requestedBySociety: true`, `operatorAccessGranted: false`, `farmerConfirmed: false`, `forwardedToBank: false`.
   - The private financial fields are `null`.
2. **Release** (operator only, once; HTTP 409 if already released).
   - Sets `sharedMilkData = {litres14d, rate, fat, snf, society, source: 'Amul cooperative member record'}` and the bank-visible timestamp.
   - Activity: "released … for this application only".
3. **Consent** (only the named farmer, only in "Awaiting farmer confirmation", only after release).
   - Accept: copies that farmer's `otherIncome, expenses, currentEmi, balance` into the case and sets `consentUntil = today + 30 days`.
   - Decline: withdraws milk access too.
4. **Forward** (assigned manager only, after release **and** confirmation, once).
5. **Query** (bank officer only, after forwarding, ≤ 1,200 characters).
6. **Answer** (the named farmer or the assigned manager, ≤ 2,000 characters, only while a request is open).
7. **Resolve** (bank officer, only after at least one answer).

**Who sees what** (`GET /api/loan-cases`):

- **Bank officer:** desk seeds, plus society cases after release (except "Farmer did not confirm"). Private finance fields are **stripped unless the farmer confirmed and the case was forwarded**.
- **Farmer:** only their own cases.
- **Society manager:** only their society's cases, always without private finance fields.

### 7.2 Legacy bank-consent flow (server and UI present, operator entry point hidden)

- **Purposes:**
  - `advance`: "Milk-payment advance affordability illustration", **8 fields** (litres, rate, fat, snf, otherMonthlyIncome, householdExpenses, existingMonthlyEmi, existingLoanBalance)
  - `repayment`: "Loan repayment planning discussion", **6 fields** (no fat or SNF)
  - `equipment`: "Chilling equipment finance discussion", **8 fields**
- **Lifecycle:**
  - request: operator, one active grant per farmer
  - pending, then **consent** (farmer, grant 30 days, `repaymentOptIn: false`) or **decline** (farmer)
  - **revoke** (farmer, any time; deletes the grant)
  - **repayment opt-in** (farmer only, needs an active grant)
- **Consent-gated reads:**
  - `/api/bank/profile` returns only the granted fields
  - `/api/bank/analyze` sends only granted fields to Gemini or the rule-based fallback
  - `chat` sends only granted fields
  - `share-plan` validates 16 numeric fields (0 to 10⁸) and stores the "Discussion draft · not a loan offer"
- The farmer-side UI (§6.7) still renders. The operator-side Bank console is hidden (§18.1).

### 7.3 Sahakaar Loan Desk status machine (client-side, live for the bank officer)

```
Consent received / Under review ─┬─ Ask for more information (reason required) ─► More information needed ─ Record information received ─► Under review
                                 ├─ Send for independent review (reason) ─► Awaiting second review ─ Record second review (note required) ─► Ready to prepare offer
                                 └─ Decline with reason (reason required) ─► Declined
Ready to prepare offer ─ Prepare offer summary ─► Offer prepared ─ Record offer sent ─► Offer sent
Offer sent ─┬─ Record farmer acceptance ─► Accepted by farmer (repaymentOptIn reset to false)
            └─ Record farmer decline ─► Declined
Accepted by farmer ─┬─ Record disbursement (no money moved) ─► Disbursed ─ Start repayment tracking ─► Repaying (schedule = term × monthly EMI, first "Due")
                    └─ Record farmer's separate opt-in (verify a real affirmative choice)
Repaying ─┬─ Record paid (per Due instalment)
          └─ Record temporary pause (only if income drop ≤ −40%) ─► Hardship pause (Due → "Paused for review")
```

- **Decline reasons:**
  - Missing cash-flow information
  - Existing repayment details need confirmation
  - Need a smaller amount scenario
  - Purpose documents required
  - Policy review required
  - Other (add a note)
- **Second reviewer:** "Credit manager · sample role" or "Senior loan officer · sample role".
- Every transition writes the case activity and the global audit ("Partner bank demo · Local training workflow only", latest 30 entries kept).
- **Status colours:**
  - success: repay, disburs, accept, closed
  - risk: declin, revok, withdraw, hardship, overdue
  - warm: offer, review, information, received

---

## 8. Forecasting engine (`forecast_model.py`)

### 8.1 Pipeline

`read_history` → `build_category_maps` → **backtest** → **fit_models** (full data) → **estimate_historical_demand** (stockout correction) → **predict_path** (7 days, scenario) → Holt–Winters (aggregate and milk) → decomposition → summaries → JSON.

### 8.2 Reading

- The first sheet, first header row, is used (case-insensitive).
- Rows with bad dates, numbers or flags are skipped.
- Quick-commerce rows with a `platform` become the channel `"Quick commerce · <platform>"`.
- A series is a (SKU, market, channel).
- Each series needs **≥ 21 rows**, and the history needs **≥ 35 distinct dates**.

### 8.3 Features (13)

| Feature | Plain name in the UI |
|---|---|
| sku_code, market_code, channel_code | product, city, sales channel (LightGBM categorical) |
| lag_1, lag_7, rolling_mean_7 | yesterday's demand, same day last week, last 7-day average |
| temperature_c | temperature |
| promotion, festival, in_stock | promotion, festival, stock availability |
| day_of_week | day of the week |
| day_of_year_sin, day_of_year_cos | season |

### 8.4 Model

- **LightGBM** global gradient-boosted regression, three **quantile** models (α = 0.1, 0.5, 0.9).
- Parameters:
  - learning_rate 0.035
  - num_leaves 15
  - max_depth 5
  - min_data_in_leaf 18
  - lambda_l2 1.5
  - **140 rounds**
  - num_threads 1
  - seeds 42 (deterministic)
- **Training uses only in-stock days** as targets. For out-of-stock days, the lag history uses max(observed, median of the same weekday, else the overall median) so a stockout does not teach "low demand".
- Quantile crossing is fixed: P10 ≤ P50 ≤ P90, all ≥ 0.

### 8.5 Stockout adjustment (counterfactual demand)

- For each out-of-stock day with ≥ 7 days of history: estimated demand = max(observed, P50 prediction with `in_stock = 1`).
- Otherwise: max(observed, same-weekday median).
- **Estimated lost demand** = estimated − observed, out-of-stock days only.
- This adjusted history feeds the forecast, the milk planning, Holt–Winters and the decomposition.

### 8.6 Future path and scenarios

- The forecast is recursive day by day (P50 is appended as the next lag) and always assumes `in_stock = 1`, i.e. unconstrained demand.
- **Temperature:** the mean of the last 4 same-weekday values from the latest 56 days (default 25 °C).
- **Heatwave:** +2.5 °C on buttermilk series, +1.8 °C on dahi series.
- **Promotion / festival:** flag = 1 for all 7 days when the switch is on.

### 8.7 Backtest (accuracy shown in the UI)

- It needs **≥ 49 distinct days**.
- The cutoff is the 8th-last date. The model retrains on data up to the cutoff, re-estimates the stockout history, then forecasts the next 7 days using the *realised* temperature, promotion and festival values.
- It is scored only on **in-stock actuals**.
- **MAE = MAD** = mean |F − A|.
- **WAPE** = Σ|F − A| / ΣA × 100.
- **MAPE** = mean(|F − A| / A) × 100, excluding A = 0.
- **Bias** = mean(F − A); positive means over-forecasting.

### 8.8 Holt–Winters (separate classical baseline)

- Additive trend and additive weekly season (period 7), **statsmodels `ExponentialSmoothing`** (optimised, `use_brute`, estimated initial states).
- **Fallback** without statsmodels: a grid search over α, β, γ ∈ {0.1, 0.3, 0.5, 0.7, 0.9} by one-step squared error.
- Window: the latest 56 days. Holdout: the last 7 (WAPE, MAD, MAPE, bias).
- Two widgets are computed:
  - aggregate units (`holtWinters`), **not rendered** (see §18.1)
  - **milk-equivalent litres** (`holtWintersMilk`), rendered
- In the samples, the parameters come out at α 0.9, β 0.1, γ 0.1, with 100% recipe coverage.

### 8.9 Decomposition (computed, panel not rendered)

Over the latest 56 days:
- additive OLS linear trend (units/week and %/week)
- centred weekday effects
- the current level
- noise = residual RMSE (units/day and % of level)

The renderer code has click-to-explain dialogs for Level, Trend and Noise.

### 8.10 Milk-equivalent recipes (draft assumptions)

| SKU type | Litres of milk per unit | Fat % / SNF % target | Basis |
|---|---|---|---|
| Paneer | pack kg / 0.16 | 4.5 / 8.5 | 16% draft milk yield |
| Buttermilk / chaas | pack volume | 3.0 / 8.5 | finished volume as proxy |
| Dahi / curd / yogurt | pack kg × 1.03 | 3.0 / 8.5 | 1.03 L/kg |
| Milk | pack L | 3.0 / 8.5 | 1 L/L |
| Ghee | kg × 0.995 / (0.04 × 0.90) | 4.0 / 8.5 | 4% fat, 90% recovery |
| Butter | kg × 0.80 / (0.04 × 0.90) | 4.0 / 8.5 | 4% fat, 90% recovery |

`milkPlanning` returns:
- 14 history days and 7 forecast days, each with litres, fat kg, SNF kg, fat % and SNF %
- an SKU breakdown
- 14-day averages
- the forecast-average fat % and SNF %
- the latest day
- the SKU assumptions

All are labelled "demand-derived… not measured milk procurement".

### 8.11 Output JSON (main keys)

- `model`, `horizonDays` 7, `trainingRows`, `seriesCount`, `historyStart`, `historyEnd`
- `evaluation`
- `daily` (P10, P50, P90 per day)
- `topSeries` (12)
- `qcomForecast`, `milkPlanning`, `marketSummary`, `holtWinters`, `holtWintersMilk`
- `productTotals` (with P10, P50, P90), `skuDaily`, `skuMarketDaily`, `recentProductTotals`
- `featureImportance` (top 6 by gain)
- `decomposition`
- `channelSummary`
- `fillRateForecastMethod`, `assumptions`

**`channelSummary` rules** (completeness-gated):

- **fillRatePercent = forecastFillRatePercent** = 100 × fulfilled / requested over the last 7 days, **only if every series-day has both values**. Otherwise null, shown as "Not provided".
- **projectedFulfilledUnits** = 7-day forecast × that ratio.
- **stockCoverDays** = latest on-hand / (7-day forecast / 7), only if every series has on-hand data.
- **searchIntent7d** only if complete.

### 8.12 Sample results (cached, deterministic)

All five samples share: history **2025-10-01 → 2026-03-29** (180 days), **72 series**, **11,967 training rows**.

| Sample (its own button scenario) | 7-day P50 units | WAPE | MAE | MAPE | Bias |
|---|---|---|---|---|---|
| 01 baseline (h0 f0 p0) | **23,144** | 7.13% | 3.34 | 6.84% | −0.24 |
| 02 heatwave (h1 f0 p0) | **29,969** | 7.25% | 4.37 | 7.00% | −0.54 |
| 03 festival (h0 f1 p0) | **34,274** | 7.43% | 5.18 | 7.12% | −0.66 |
| 04 promotions (h0 f0 p1) | **29,447** | 7.68% | 4.62 | 7.07% | −0.88 |
| 05 combined (h1 f1 p1) | **44,424** | 9.47% | 8.64 | 8.25% | −1.28 |

**Metro portfolio samples:** history 2026-05-09 → 2026-11-04 (180 days), **450 series**.

| Sample (its own button scenario) | 7-day P50 units | WAPE | MAE | MAPE | Bias |
|---|---|---|---|---|---|
| 06 metro baseline (h0 f0 p0) | **1,14,065** | 10.60% | 3.91 | 11.53% | −0.78 |
| 07 metro heatwave (h1 f0 p0) | **1,40,248** | 10.92% | 4.98 | 11.77% | −1.24 |
| 08 metro festival (h0 f1 p0) | **1,58,491** | 12.12% | 6.26 | 12.01% | −1.65 |
| 09 metro promotions (h0 f0 p1) | **1,42,695** | 12.31% | 5.80 | 11.86% | −1.91 |
| 10 metro combined (h1 f1 p1) | **1,97,781** | 13.11% | 8.52 | 12.53% | −1.91 |

Error is higher here than on the smaller samples because each of the 450 series is smaller and noisier.

- The standard baseline with the default switches (heatwave on) gives 23,130.
- **Takeaway:** accuracy stays at WAPE 7–9.5% across scenarios, and bias is slightly negative (mild under-forecasting).
- The **combined event gives about 1.9× the baseline demand**, which is the kind of swing a planner must see a week early.

---

## 9. Data

### 9.1 Workbook contract (`.xlsx`, maximum 12 MB)

- **Required:** `date, sku, market, channel, units_sold, temperature_c, promotion, festival, in_stock`.
- **Optional:** `units_requested, units_fulfilled, on_hand_units, search_intent, platform, qcom_category`.
- Use one row per date × SKU × market × channel (× platform).
- Flags accept 0/1, true/false, yes/no or y/n.
- `platform` is valid only on Quick commerce rows.
- `qcom_category` (DMEF / Non-DMEF; aliases `nondmef`, `longer-shelf-life`, `longer-shelf-life-products`) is valid only on Quick commerce rows and is mapped per SKU.
- Quick commerce matches "quick commerce", "quickcommerce" or "q commerce" (ignoring case, `-` and `_`).

### 9.2 Inspection (`inspect_workbook.py`, read-only)

**Rejection reasons** (counted):
- invalid date
- missing SKU / market / channel
- invalid promotion / festival / availability flag
- negative units
- invalid numeric fields
- platform on a non-quick-commerce row
- qcom_category on a non-quick-commerce row

**Duplicates** (same date, SKU, market, channel, platform) are **flagged, never silently removed**.

**Accepted** means ≥ 35 dates, ≥ 1 SKU, **0 duplicates**, and every series ≥ 21 rows.

**Reports:**
- rows read, accepted and rejected
- history window and number of dates
- SKU, market, channel and platform counts
- coverage %: stock availability, requested, fulfilled, on-hand, search intent, platform, Q-Com category
- per-market coverage table: rows, SKUs, channels, platforms
- the unclassified Q-Com SKUs

### 9.3 Sample data (`forecast-data/`)

- Five workbooks of 12,960 rows each, all accepted:
  - 180 days
  - 4 SKUs: Taaza Milk 1L, Buttermilk 500ml, Masti Dahi 400g, Paneer 200g
  - 3 markets: Ahmedabad, Anand, Pune
  - 3 channels: General trade, Institutional, Quick commerce
  - the Quick commerce rows are **split evenly across 4 platform labels** (synthetic): Blinkit, Zepto, Instamart, Amul Store
- Coverage: requested and fulfilled 100%, on-hand 0%, search 0%, Q-Com category 100%.
- `generate_forecast_samples.py` builds scenarios from the baseline:
  - **heatwave** (last 35 days): buttermilk ×1.65, dahi ×1.35, others ×1.06; temperature +7 °C
  - **festival** (last 21 days): milk ×1.35, dahi ×1.70, paneer ×1.85, others ×1.45; festival = 1
  - **promotions** (last 28 days):
    - Taaza milk on Q-com ×1.80
    - dahi in General trade ×1.75
    - paneer in Institutional ×1.70
    - buttermilk in General trade ×1.60
    - others ×1.04
    - promotion = 1
  - **combined:** all of the above layered
  - The generator also adds `units_requested` (sold + an unfulfilled share: 1.5–4.5% when in stock, 10–26% when out of stock) and `units_fulfilled` (= sold), and tags `qcom_category`.
- **Metro portfolio workbooks** `06_metro_baseline` to `10_metro_combined` (about 3.9 MB each, 81,000 rows, 180 days from 2026-05-09 to 2026-11-04): 15 SKUs, 5 cities (Bengaluru, Chennai, Delhi, Kolkata, Mumbai), 6 channel rows, 450 series. Q-Com SKUs are 7 DMEF and 8 Non-DMEF. Milk recipes cover 74% of units; unmapped SKUs (for example cheese, ice cream, lassi) are listed in the app.
- `synthetic_data.json` (8.7 MB) is legacy and not used by the app.

### 9.4 Data parameters by supply-chain point (case Q2)

| Point | Parameters | In the prototype |
|---|---|---|
| Farmer (cooperative record) | litres, fat, SNF, rate, pour days, tenure | ✅ synthetic |
| Farmer (private, consent-gated) | other income, expenses, EMI, balance | ✅ synthetic, shared only on confirmation |
| Village society | roster, member supply context, applications | ✅ |
| Plant / processing | milk-equivalent litres, fat and SNF kg from the forecast mix | ✅ derived (draft recipes) |
| Distribution channels | sold, requested, fulfilled, on-hand, in_stock | ✅ workbook |
| Quick-commerce platforms | platform, city, DMEF class, search intent | ✅ workbook |
| External signals | temperature, promotion, festival flags; weather and holidays API on the server | ✅ / API dormant |
| Bank | application, offer, schedule, grievance, second review | ✅ synthetic |

---

## 10. Formula sheet

| Quantity | Formula |
|---|---|
| Monthly milk receipts | 14-day litres × rate × 2 |
| Total monthly income | monthly milk receipts + other monthly income |
| EMI | P·r·(1+r)ⁿ / ((1+r)ⁿ − 1), with r = annual % / 1200; P/n if the rate is 0. Excludes fees. |
| 30% guide (legacy console) | 30% × total monthly income. "Within guide" if EMI ≤ (guide − existing EMI) and remainder ≥ 0. |
| Monthly remainder | total income − household expenses − existing EMI − new EMI |
| Per-bill cap (desk) | 14-day litres × rate × 0.30; monthly guide = ×2 |
| Rate breakdown | ₹32 base + fat component max(0, rate − 33.3) × 0.7 + SNF component (remainder) |
| Incentive per litre (draft) | max(0.1, round(0.02 × 36.5, 0.1)) = ₹0.7 |
| Incentive budget / max exposure | additional L/day × days × ₹/L |
| Capacity proxy | max(latest-day L, forecast L/day) × 1.10 |
| Additional milk sought | max(0, forecast L/day − latest-day L) |
| Fat / SNF in the forecast mix | Σ units × pack kg × benchmark % |
| Days in workflow | floor((now − applied date) / 1 day) |
| Hardship trigger | income-proxy drop ≤ −40% |
| Signal % change | (7-day forecast − prior 7-day adjusted demand) / prior × 100 |
| Share of total | SKU 7-day P50 / Σ daily P50 × 100 |
| Money format | ₹ en-IN, 2 decimals for non-integers |

---

## 11. Generative AI (Gemini)

- **Endpoint:** `POST https://generativelanguage.googleapis.com/v1beta/interactions`, with the key in the `x-goog-api-key` header. **The key never reaches the browser.**
- **Models:**
  - text: `GEMINI_TEXT_MODEL` (default `gemini-3.8-flash`)
  - TTS: `GEMINI_TTS_MODEL` (default `gemini-3.8-flash-tts`)
  - text **fallback chain**: `GEMINI_FALLBACK_MODELS` (default `gemini-3.5-flash, gemini-3.5-flash-lite`), used on HTTP 429/500/503 or timeout. Each failure is logged. Audio does not fall back.
- **Timeouts:** 30 s for text, 90 s for audio. `thinking_level: low`.
- **Status:** `/api/gemini/status` gives the "GEMINI AVAILABLE / NOT CONFIGURED" tag.

| Task | Who | Input limits | Guardrail (system or user prompt) | Output | Without a key |
|---|---|---|---|---|---|
| `message` | operator | forecast ≤ 1,200 characters, prompt ≤ 1,200 | Do not invent schemes, rates, quotas, loan terms, income, guarantees; preserve uncertainty; never imply forecasts are guaranteed or suggest eligibility or prices | ≤ 500 tokens | the UI reports that generation failed |
| `translate` (server) | operator | ≤ 2,500 characters; hi / gu / en | faithful; Gujarati or Devanagari script only; keep figures, line breaks, uncertainty; add nothing | ≤ 4,000 tokens | n/a (the UI now uses GTranslate) |
| `audio` | operator | ≤ 2,500 characters | voice Kore, "warm, clear, natural … cooperative announcement" | WAV base64 | error toast |
| `collection_review` | operator | calculation ≤ 3,000 characters | arithmetic check only; never approve, never claim validation, never infer missing supply or capacity; **JSON only** `{summary, changes[]}` | summary ≤ 700 characters, ≤ 8 changes | "Gemini is not configured…" |
| `chat` (legacy) | operator | consent-scoped profile, scenario ≤ 800, history ≤ 2,500, question ≤ 1,200 | `FARMER_ANALYSIS_SYSTEM`: no approve or reject, no eligibility, no inference of unprovided values, no pressure | ≤ 500 tokens | fixed advice text |
| `/api/bank/analyze` (legacy) | operator | granted fields only + scenario + note ≤ 1,200 | the same system prompt, 4-part answer: data, cautious repayment discussion, missing questions, optional next step | ≤ 700 tokens | **rule-based preview** with ₹ figures and "not a credit decision" |

---

## 12. Translation and voice

- **Page translation:** the GTranslate dropdown in the header (Google machine translation, 9 languages), and Gujarati first for farmers.
- **Message translation** (Society console): GTranslate runs inside a hidden, same-origin, sandboxed iframe (`allow-scripts allow-same-origin`).
  - Each line becomes a `<p>`. The code polls every 250 ms, waits for 2 stable reads, and times out after 30 s (100 tries).
  - It saves and restores the `googtrans` cookie and `localStorage['__GT_TRANSLATE_LANGS']` so the header widget is not changed.
  - The frame stays inside the viewport (320×160, opacity 0, z-index −1), because GTranslate translates only text that its IntersectionObserver reports as visible.
  - Results are read-only until **Use as editable message**.
- **Voice:**
  - Gemini TTS for the society audio
  - the browser `speechSynthesis` preview for farmers (gu-IN / hi-IN / en-IN, rate 0.82)
  - in both cases the voice language must equal the text language

---

## 13. API reference (`server.js`)

| Method & path | Role | Purpose |
|---|---|---|
| GET `/api/demo-accounts` | public | Account list without passwords |
| POST `/api/demo-accounts/select` | public | Returns the username and password to fill the form (**known gap**) |
| POST `/api/login` / `/api/logout` | public | Session cookie (8 h) |
| GET `/api/session` | any | Public user, plus the farmer list for the operator |
| GET `/api/gemini/status` | any | Whether Gemini is configured |
| POST `/api/gemini` | operator | Tasks message / translate / audio / collection_review / chat |
| POST `/api/pipeline/inspect[?sample=<file>]` | operator | Workbook inspection (cached by SHA-256) |
| POST `/api/forecast?heatwave&festival&promotion[&sample=<file>]` | operator | LightGBM forecast (cached by SHA-256 + scenario) |
| GET `/api/public-signals?markets=a\|b\|c` | operator | Open-Meteo 7-day max temperature and rain probability (4 days used), Nager.Date India holidays for the next 30 days; up to 3 markets; cached 15 min; 9 s timeout. **Not called by the UI.** |
| GET `/api/operator/farmer-profile?farmerId` | operator | Cooperative milk record and lifetime passbook; no private finances |
| GET `/api/operator/bank-data-requests` | operator | Pending society applications awaiting milk-record release |
| POST `/api/operator/bank-data-requests/:id/release` | operator | Release the milk facts for one application |
| GET `/api/society/roster` | society manager | Own society's farmers: supply fields and milk passbook, no private finances |
| GET / POST `/api/society/loan-cases` | society manager | List / prepare an application |
| POST `/api/society/loan-cases/:id/forward` | society manager | Forward after release and confirmation |
| GET `/api/loan-cases` | bank / farmer / society | Role-scoped cases (private fields stripped as needed) |
| POST `/api/loan-cases/:id/consent` | farmer (named) | Confirm or decline |
| POST `/api/loan-cases/:id/query` | bank officer | Ask for information (after forwarding) |
| POST `/api/loan-cases/:id/answer` | farmer / assigned manager | Answer |
| POST `/api/loan-cases/:id/resolve` | bank officer | Close the request |
| GET `/api/bank/status?farmerId` | operator / own farmer | Legacy consent status, including repaymentOptIn |
| GET `/api/bank/profile` | operator | Granted fields only |
| POST `/api/bank/request` | operator | Legacy purpose-limited request |
| POST `/api/bank/consent` / `decline` / `revoke` | farmer | Legacy consent actions |
| POST `/api/bank/repayment-opt-in` | farmer | Milk-bill repayment choice |
| POST `/api/bank/analyze` | operator | Consent-scoped AI or rule-based analysis |
| POST `/api/bank/share-plan` | operator | Share a discussion draft with the farmer |
| GET `/api/farmer/loan-plan` | farmer | Read the shared draft |
| POST `/api/demo/reset` | operator | Clears legacy bank maps (no UI button) |
| GET static files | any signed-in user | Serves files from the app folder (**known gap**: includes source files) |

- **Common response headers:** `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`.
- **Body limits:** JSON 8 KB, workbook 12 MB.
- `.env*` and `.python-deps` paths return 404. Paths outside the app folder return 403.

---

## 14. Architecture, stack and files

```
Browser (vanilla JS SPA, template strings)
  index.html · app.js · loan-desk.js · farmer-loan.js · operator-farmer.js · society-manager.js · *.css
        │  fetch (cookie session)
        ▼
Node.js http server (server.js, no npm dependencies)
  auth & RBAC · in-memory state (sessions, consent grants, loan cases, shared plans) · static files
  ├── spawn → Python 3.12: inspect_workbook.py (openpyxl) / forecast_model.py (LightGBM, numpy, statsmodels)
  │            ▲ result cache: memory Map (40 entries) + forecast-cache/*.json (precomputed at build)
  ├── HTTPS → Gemini interactions API (text, TTS) with model fallback
  └── HTTPS → Open-Meteo + Nager.Date (dormant endpoint)
Browser-side third parties: Google Fonts (Inter, Plus Jakarta Sans), GTranslate CDN, Amul logo (shop.amul.com)
```

**Files**

| File | Role |
|---|---|
| `server.js` | HTTP server, sign-in page, accounts, RBAC, all APIs, Gemini, cache, static files |
| `index.html` | Shell, GTranslate settings, script and CSS includes (`app.js?v=20261104-loan-access-flow`) |
| `app.js` | Core SPA: Control tower, channels, Q-Com, Society console, Farmer app, legacy Bank console, translation, render loop, actions |
| `loan-desk.js` / `.css` | Sahakaar Loan Desk (seed cases, status machine, EMI and cap calculation) |
| `farmer-loan.js` / `.css` | "My loan journey" |
| `operator-farmer.js` / `.css` | Operator member record and bank milk-data access panel |
| `society-manager.js` / `.css` | Society manager workspace |
| `styles.css` | Global design system, dark theme, responsive rules |
| `forecast_model.py` | Forecast engine (§8) |
| `inspect_workbook.py` | Workbook inspection (§9.2) |
| `generate_forecast_samples.py` | Rebuilds the scenario workbooks |
| `warm_forecast_cache.py` | Precomputes 10 inspections and 14 forecasts at Docker build |
| `requirements-forecast.txt` | lightgbm 4.7.0, numpy ≥ 1.24, scipy ≥ 1.11, openpyxl 3.1.5, narwhals 2.28.0 (unused), et-xmlfile 2.0.0, statsmodels ≥ 0.15, < 0.16 |
| `Dockerfile` | python:3.12-slim + Node 24 binary + libgomp1, pip install, warm cache, `HOST=0.0.0.0 PORT=4173 PYTHON=python` |
| `render.yaml` | Render Blueprint: Docker web service `doordarshi`, Singapore, **free plan**, 1 instance, health check `/`, auto-deploy, env vars |
| `.dockerignore` / `.gitignore` | Keep `.env`, `.python-deps`, outputs, caches, logs and large data out |
| `.env.example` | `GEMINI_API_KEY`, optional model overrides; `GOOGLE_TRANSLATE_API_KEY` is listed but unused |
| `DEPLOY.md`, `README.md`, `AMUL_SETU_README.md`, `PRODUCT.md` | Deploy guide, run guide (older), previous full guide, impeccable product record |
| `.impeccable/` | Design-critique snapshot and detector config (ignored fonts) |

The environment loader reads a local `.env`; real process variables win. Default bind is `127.0.0.1:4173`.

---

## 15. Security and privacy: built vs open

**Built**

- **Server-side RBAC** on every API; farmers are blocked from operator APIs.
- Strict **society scoping**.
- **Field-level minimisation:**
  - the roster has the cooperative's own milk and settlement record, but no household income, expenses or other loans
  - the operator member record has supply fields only
  - the milk release covers 4 facts
  - private finance is shared only after farmer confirmation and forwarding
- **Purpose limitation:** one application per release; purpose-specific field lists.
- **Time limitation:** 30-day consent, `consentUntil`.
- **Consent from the data principal's own login.** The operator and the society manager cannot consent for the farmer.
- Consent is **revocable** (legacy flow). A decline **withdraws** the already-released milk access.
- **Equal-weight Approve / Decline** buttons, a **confirmation dialog** with who, why, until and what, and "declining has no effect on milk payments".
- **Separate, default-off milk-bill repayment** opt-in (≤ 30%), controlled only by the farmer; the bank sees it read-only.
- **No credit score, no automated decision**. A **second-person review** step, **mandatory decline reasons**, a **grievance log**, and a "do not infer" rule for missing data.
- **Audit trail** of actions (client-side, per session).
- Secrets: the Gemini key is server-side, `.env` is git-ignored and never served.
- `HttpOnly`, `SameSite=Lax` cookie; `no-store`; `nosniff`; path traversal blocked; body size limits; input length limits on all text.
- **AI guardrails** in the prompts (§11), and AI output is labelled advisory.
- The non-affiliation and synthetic-data notice appears on every page.

**Open (known, not fixed; the owner chose "Not now")**

1. Demo passwords are in public `server.js` and `README.md`.
2. `/api/demo-accounts/select` returns any password without sign-in.
3. The static handler serves any file in the app folder to any signed-in user, including `server.js` and data files.
4. Sessions, consents and cases are **in memory**: lost on restart or sleep, with no persistence or encryption at rest.
5. There is no CSRF token (SameSite=Lax mitigates most of the risk), no rate limiting or lockout, no MFA, and plain-text password comparison.
6. The audit log is client-side, so it is not tamper-evident.
7. The HTML is built from template strings. Most user text is escaped with `escapeHtml`, but a few audit and name fields are not, so XSS hardening is incomplete.
8. Third-party scripts (GTranslate) run on the page and see the page text, which matters for personal data. Google Fonts and the logo hotlink leak IP addresses.
9. There is no consent receipt, no data-principal rights screens (access, correction, erasure, nomination) and no retention or deletion job.

---

## 16. Running, deploying and performance

- **Local run:** `node server.js` serves `http://127.0.0.1:4173`. For LAN access set `HOST=0.0.0.0` and `PORT=4174`. Python 3.10+ and `pip install -r requirements-forecast.txt` are needed (or a local `.python-deps` folder).
- **Render:** New → Blueprint → choose the repository → enter `GEMINI_API_KEY` → Apply. The free plan needs **no card**. The first build takes about 15–20 minutes, including the precomputed forecasts. Every push to `main` redeploys.
- **Performance:**
  - A fresh forecast takes about 5–7 s locally and about 1 minute on Render's free plan (about 0.1 CPU, 512 MB).
  - The **result cache** is keyed by the SHA-256 of the workbook bytes plus the scenario tag `h?f?p?`:
    - memory first (40 entries)
    - then `forecast-cache/*.json`
    - otherwise compute
  - The build precomputes all **10 sample scenarios** (plus the default-switch variants of the standard workbooks: 14 forecasts and 10 inspections), so the sample buttons answer in about 0.1 s.
  - A cached result matches a fresh run exactly, because the seeds are fixed.
- **Free-plan behaviour:** sleeps after about 15 idle minutes, takes 30–60 s to wake, and state resets on sleep.

---

## 17. Visual design system

- **Brand:** Amul red `#E31E24` (submit `#D11B21` for contrast) and Amul blue (`#155b91` / `#103B66`). Core tokens:
  - `--green` #176b47
  - `--deep` #104d35
  - `--mint` #edf6ef
  - `--ink` #1d2b23
  - `--muted`
  - `--line`
  - `--paper`
  - `--bg` #f6f8f6
  - `--gold` #bd8d37
  - `--red`
  - `--amul-red`
  - `--amul-blue`
  - `--accent`
  - `--status-green`
  - `--shadow`

  There is a full dark-theme palette.
- **Type:** **Plus Jakarta Sans** for headings and brand, **Inter** for body. There is a **12 px minimum** for all text, including SVG chart axes, with tabular numbers and balanced or pretty text wrapping. Form controls inherit the font.
- **Components:**
  - metric tiles
  - panels
  - tags (and warn tags)
  - notices
  - list rows
  - action bars
  - data tables with internal scroll
  - collapsible details
  - filter chips
  - status pills
  - steppers
  - dialogs
  - toasts
  - SVG product art
  - hand-drawn SVG charts (no chart library)
- **Responsive breakpoints** run from 1080 px down to 520 px; there are 15 rules at ≤ 700 px.
- **Impeccable passes applied:**
  - `init` (PRODUCT.md)
  - critique
  - harden: consent dialog, double submit, session expiry
  - clarify: plain metric names, expanded DMEF and Non-DMEF, the "out-of-stock days" wording
  - distill: model details and SKU breakdown collapsed, price-review panel removed
  - adapt: mobile and Gujarati-first
  - typeset: the 12 px floor and fonts

  The model-metrics and coverage tile rows were deliberately kept in their original tiled form.

---

## 18. Dormant code, known limits and glossary

### 18.1 Dormant or hidden code (present but not reachable in the UI)

| Item | State |
|---|---|
| **Bank console** (`bank()`, legacy consent, AI analysis, EMI planner, follow-up chat, share plan) | Hidden: the operator rail filter removes it, and the render loop redirects to Farmer records. The farmer-side consent panel and shared-plan panel still render. |
| **Digital demand pipeline** screen (`digitalPipeline()`) | Defined, not in the module list. Its 6-step flow (Source feeds → Ingestion → Quality checks → SKU / location / channel → Stockout adjustment → LightGBM), source cards (Amul storefront, Zepto, Swiggy Instamart, Inventory, Search intent), inspection display and schema help are not shown. Inspection itself still runs from Control tower. |
| `decompositionPanel()`, aggregate `holtWintersPanel(result.holtWinters)`, `quickCommercePanel()` | Defined, not rendered (data still computed) |
| `/api/public-signals` (weather and holidays) | Server endpoint works; the UI does not call it |
| `/api/demo/reset`, `reset()`, presenter panel, `priceDecision`, `recordChannelPlan`, `#runBaselineSample` | No UI entry points |
| Server Gemini `translate` task | Superseded by GTranslate in the UI |

### 18.2 Limits

- All data is synthetic. There are no live partner, ERP, procurement or bank connections.
- Recipes and solids benchmarks are draft assumptions.
- The forecast covers only 7 days at city level, not individual dark stores. P10–P90 ranges are summed per series, so they are not calibrated intervals.
- There is no real SMS, WhatsApp or IVR delivery. Delivery is the in-app inbox only.
- State lives in memory; the desk cases live in the browser (the local seed workflow resets on reload).
- Consumer-side marketing and consumer financial products are examples only.

### 18.3 Glossary

| Term | Meaning |
|---|---|
| **P10 / P50 / P90** | Low / median (most likely) / high forecast quantiles |
| **WAPE** | Weighted absolute percentage error: units missed ÷ actual units |
| **MAE / MAD** | Mean absolute error (deviation): average units missed per series-day |
| **MAPE** | Mean absolute percentage error, excluding zero-sale days |
| **Bias** | Average forecast − actual; positive means over-forecasting |
| **Stockout-adjusted demand** | Estimated demand on out-of-stock days if stock had been available |
| **Unmet (lost) demand** | Adjusted demand − observed sales on stockout days (a counterfactual) |
| **DMEF** | The app's short-shelf-life quick-commerce class, planned daily for dark-store replenishment. The UI labels it "Short shelf life · dark-store replenishment"; the code does not expand the acronym. |
| **Non-DMEF** | Longer-shelf-life items, planned weekly for fulfilment centres |
| **SNF** | Solids-not-fat: milk solids other than fat |
| **Milk-equivalent** | Raw-milk litres needed to make a product unit |
| **Holt–Winters** | Exponential smoothing with level (α), trend (β) and seasonality (γ) |
| **EMI** | Equated monthly instalment |
| **Fill rate** | Fulfilled ÷ requested units |
| **Stock cover** | Days of demand the on-hand stock can serve |
| **GCMMF** | Gujarat Cooperative Milk Marketing Federation (Amul) |
| **Data principal / fiduciary** | The DPDP Act terms for the person the data is about, and the entity deciding its purpose and means |

---

# PART B: STRATEGY AND DEFENCE

## 19. The ecosystem it creates

DoorDarshi is not a dashboard for one team. It is a **shared, permissioned data layer** around the farmer that turns one-way flows (milk up the chain, payment down) into a **two-way loop**: demand travels back to the village, and trust travels with the data.

### 19.1 Participants and what each gains

| Participant | Gives to the ecosystem | Gets back |
|---|---|---|
| **Consumer** | Purchase signal (what, where, when) through stores and quick commerce | Better availability of fresh SKUs; fewer stockouts |
| **Quick-commerce and retail partners** (Zepto, Blinkit, Instamart, Amul Store; General trade; Institutional) | Sales, requested and fulfilled units, availability, search intent, platform attribution | SKU × city × day forecasts at the right cadence (daily DMEF, weekly Non-DMEF), and higher fill rates |
| **GCMMF / Amul planning** | Forecasts, scenario thinking, milk-equivalent and solids translation, the authoritative milk record | One view of demand across channels, unmet demand made visible, earlier procurement and processing planning, a controlled role as custodian of farmer data |
| **Village society** | Roster, local knowledge, application preparation, follow-up | Stays *central*: the society is the channel for plans, messages and loans, not bypassed by the platform |
| **Farmer** | Milk (volume and quality); private finances, *only by choice* | Earlier demand signals, quality-linked incentive plans, a transparent rate breakdown, messages in Gujarati or Hindi with audio, access to credit based on verified supply history, control over their data |
| **Cooperative bank** | Credit products, policy and second review | Verified, fresh supply facts with provenance; farmer-confirmed applications; lower origination cost; a repayment option linked to the milk bill when the farmer chooses it |
| **AI services** (Gemini, GTranslate) | Drafting, translation, voice, arithmetic review | Bounded, labelled, human-reviewed uses only |

### 19.2 The value loops (flywheel)

1. **Demand loop:** consumer purchases → stockout-aware forecast → milk-equivalent need → society collection plan → voluntary, quality-linked farmer supply → product availability → more purchases.
2. **Quality loop:** forecast fat and SNF needs → minimum fat / SNF thresholds and ₹ per qualifying litre → farmers improve quality → a better rate (shown transparently in the rate breakdown) → higher price realisation.
3. **Credit loop:** verified supply history → farmer-confirmed application through the society → bank offer with an EMI within a milk-bill guide → farmer invests (cattle care, chilling equipment) → more and better milk → a stronger supply record.
4. **Trust loop:** purpose-limited release, farmer confirmation, a visible audit, no automatic deduction → farmers share more willingly → better data → better plans and credit terms.

### 19.3 Why it is an ecosystem rather than an app

- **Multi-sided, with roles:** each party has its own workspace and permissions, and none can act for another. The operator cannot consent; the manager cannot accept an offer; the bank cannot see private finances until the farmer confirms.
- **The cooperative keeps the data custodianship:** Amul holds the milk record and releases it per application. Farmer data is not sold or exposed to platforms; platforms provide demand data *into* the cooperative.
- **Network effects:**
  - Every additional channel feed improves forecasts.
  - Every additional society and member improves the planning signal.
  - Every repaid loan strengthens the case for supply-history-based lending.

---

## 20. Strategic business solution

### 20.1 Problem → solution map

| Problem in the case | Strategic response | Prototype feature |
|---|---|---|
| Demand visibility runs through distributors and arrives late | Direct, channel-level demand sensing with a 7-day probabilistic horizon | LightGBM P10/P50/P90 by SKU × city × channel |
| Quick commerce needs real-time, hyperlocal readiness | Plan at the cadence of the product's shelf life | DMEF daily vs Non-DMEF weekly Q-Com planner |
| Stockouts hide true demand, so the system under-plans next time | Counterfactual demand reconstruction | Stockout-adjusted history, estimated unmet demand |
| Demand is in SKUs; procurement is in litres, fat and SNF | Translate product demand into milk requirements | Milk-equivalent litres, fat and SNF kg, Holt–Winters milk baseline |
| Digital centralisation could sideline societies | Route every farmer-facing action through the society | Society console, society manager workspace, society-forwarded applications |
| Farmer price transparency | Show the rate build-up and keep the base price unchanged | Rate calculation panel; locked caveat "not a milk price…"; the incentive is additive and voluntary |
| Farmers lack affordable, fast credit | Use the cooperative's own verified supply record, with consent | Society → Amul → Farmer → Bank flow; desk worksheet; milk-bill repayment opt-in |
| Event-driven volatility (heat, festivals, promotions) | Scenario planning | Heatwave, festival and promotion switches; sample results swing 23k → 44k units |

### 20.2 Value proposition by stakeholder (headline)

- **GCMMF:** fewer stockouts and less waste, earlier procurement, channel-level visibility, and a credible way to work with quick-commerce partners on its own terms.
- **Farmers:** earlier information, better income through quality, cheaper credit, voice in their own language, and **control**.
- **Societies:** a stronger, digitised role, with application preparation and member communication.
- **Banks:** verified data, lower risk and cost, and a compliant consent trail.

### 20.3 Business model options

| Stream | Who pays | Logic |
|---|---|---|
| Internal efficiency (core) | GCMMF | Fewer lost sales from stockouts, less spoilage of short-shelf-life SKUs, better plant utilisation |
| Partner data-sharing agreements | Q-commerce and retail partners (in kind) | Partners share data in exchange for better forecasts and fill rates |
| Loan origination / servicing fee | Cooperative banks | Per verified, farmer-confirmed application, and for repayment collection through the milk bill when the farmer opts in |
| Value-added services | Farmers / societies (subsidised) | Insurance (animal-health cover), equipment finance, input purchase |

### 20.4 KPIs to prove it works

- **Forecast:** WAPE, bias, P10–P90 coverage (calibration); the prototype shows WAPE 7.1–9.5% on the samples.
- **Availability:** fill rate, out-of-stock days, estimated unmet demand.
- **Supply:** milk-equivalent gap closed, collection-plan participation, average fat and SNF.
- **Farmer outcomes:** price realisation, incentive paid per litre, time to credit, interest rate vs informal lenders.
- **Trust:** consent grant / decline / revoke rates, grievances and their resolution time, message read and listen rates.
- **Society health:** applications prepared and forwarded, response time to lender questions.

### 20.5 Roadmap

1. **Pilot (0–6 months):**
   - one district union (for example Anand) and 50 societies
   - two channels (one Q-com partner plus General trade)
   - read-only feeds, a persistent database, real authentication
   - WhatsApp, IVR or SMS delivery through the society
2. **Scale (6–18 months):**
   - all channels, integrated plant and procurement data
   - Account Aggregator integration for finance
   - two partner banks
   - calibrated intervals, dark-store-level DMEF
3. **Platform (18+ months):**
   - consent manager integration
   - co-designed farmer products
   - open, cooperative-owned data standards for the dairy value chain

### 20.6 Risks and mitigations

| Risk | Mitigation |
|---|---|
| Partners refuse to share data | Mutual-benefit agreements (forecasts back to them), start with Amul's own storefront |
| Forecasts misread as promises | P10–P90 ranges, "planning estimate" labels, the locked caveat in member messages |
| Credit harms vulnerable farmers | No score, human second review, a 30% milk-bill guide, a hardship pause, decline reasons, grievances, default-off deduction |
| Low digital literacy | Society-assisted flows, Gujarati first, audio, simple labels, 44 px targets |
| Data breach | Minimisation, purpose-limited release, in-country hosting, encryption, audit (on the roadmap) |
| Societies feel bypassed | Society is the required step for applications and messages |

---

## 21. Data governance

### 21.1 Principles implemented

| Principle | How the prototype applies it |
|---|---|
| **Lawful purpose and consent** | Sharing a farmer's milk record with a bank happens only for a named application (purpose) and requires the farmer's confirmation from their own login; the confirmation lists the fields and shows a 30-day expiry |
| **Purpose limitation** | A release is tied to one application ID ("for this application only"); legacy grants are tied to one of three purposes with fixed field lists |
| **Data minimisation** | The operator record has supply and settlement data plus identity; the roster has no household finances; the milk release has 4 facts; finances are shared only after confirmation; "do not infer" for animal-care data |
| **Storage limitation** | `consentUntil` = 30 days; the legacy grant expires and is checked on every read (`expiresAt > now`) |
| **Accuracy** | "If any figure looks wrong, ask your society to correct it before you share"; record-review request; data freshness date on the desk |
| **Transparency** | Who, why, until and what in the consent dialog; activity log on every case; provenance labels ("Verified by Amul" vs "Farmer-provided") |
| **Accountability** | Audit trail; mandatory reasons for decline and review; second-person review |
| **Separation of duties** | Society prepares → Amul releases → farmer confirms → society forwards → bank decides; nobody can skip a step (server-enforced) |
| **Withdrawal** | Decline withdraws the milk access already released; legacy revoke deletes the grant immediately |

### 21.2 Mapping to India's Digital Personal Data Protection Act, 2023 (DPDP)

| DPDP concept | Prototype today | Production requirement |
|---|---|---|
| Data principal = farmer; data fiduciary = GCMMF / union (milk record) and bank (credit data) | Roles reflected in the flow | Formal fiduciary designation and contracts between Amul, unions and banks |
| Consent must be free, specific, informed, unconditional and unambiguous, by clear affirmative action, with a notice | Separate confirm and decline buttons of equal weight; itemised fields; purpose; duration; "declining has no effect on milk payments" | A consent notice in the farmer's language (the Act and Rules require notice in English or any Eighth Schedule language, which includes Gujarati), a consent artefact and receipt |
| Withdrawing consent should be as easy as giving it | Legacy revoke and decline; repayment opt-out at any time | Revoke on the new application flow, and propagation to the bank |
| Rights: access a summary, correction and erasure, grievance redressal, nomination | Record-review request, grievance log (bank side) | Self-service rights screens, a grievance officer, response SLAs, nomination |
| Reasonable security safeguards; breach notification | Basic (RBAC, HttpOnly cookie, minimisation) | Encryption at rest and in transit, real auth and MFA, rate limiting, a tamper-evident audit, breach response; the Act's penalties reach ₹250 crore |
| Erasure once the purpose is served | Expiry checks | Scheduled deletion and retention policy |
| Consent managers | Not yet | Integrate with a registered consent manager or the Account Aggregator ecosystem |

### 21.3 Financial-data governance (RBI context)

- **Digital lending norms:**
  - borrower-explicit consent for data collection
  - need-based data only
  - a **Key Fact Statement** before signing
  - disbursal and repayment directly between borrower and lender
  - a grievance redressal officer
  - no automatic access to device data

  The prototype aligns in spirit: consent, minimisation, no deduction without opt-in, a grievance log, and "not a loan contract". Production needs a KFS, a cooling-off period and formal grievance handling.
- **Account Aggregator** is the natural rail for farmer-provided finances (bank statements) instead of self-declared figures.
- **Milk-bill repayment** should run on an explicit, revocable mandate, separate from loan acceptance. The prototype models this as a separate default-off opt-in, capped at 30% of a bill.

### 21.4 Data classification

| Class | Examples | Who can see it |
|---|---|---|
| Public / aggregate | SKU demand, channel forecasts | Operator |
| Cooperative-internal | Milk record and passbook (litres, fat, SNF, rate, pours, tenure, earnings, society deductions) | Operator; society manager (own members); bank **only after release** |
| Personal-sensitive (financial) | Income, expenses, EMI, balance | Farmer; bank **only after farmer confirmation and society forwarding** |
| Case data | Application, offer, schedule, Q&A | Farmer, assigned manager, bank |
| Secrets | API keys | Server only |

---

## 22. Responsible design

### 22.1 Human in the loop, everywhere

- **Forecasts** are labelled "planning estimates, not guarantees" with P10–P90 ranges. The demand signal is "rule-based", needs a human acknowledgement, and refuses to claim a supply shortfall without collection data.
- **Collection plan:**
  - "HUMAN REVIEW REQUIRED"
  - the budget must cover the maximum cost
  - the terms must be confirmed
  - plan review and message approval are separate steps
  - any edit forces a re-review
- **AI messages** need operator approval; translations are read-only until adopted; a native-speaker review is recommended.
- **Credit:**
  - no score
  - the worksheet shows indicators, not a verdict
  - independent second review
  - mandatory decline reasons
  - offers are "non-binding" and "not a loan contract"

### 22.2 AI guardrails

- Every prompt forbids inventing schemes, rates, quotas, loan terms, income or guarantees.
- Credit prompts forbid approve/reject or eligibility decisions and inferring unprovided data. They must say that the farmer and the lender decide.
- The collection review is arithmetic only; it may not approve or claim validation, and it must return JSON.
- Member messages may **not name products or expose demand forecasts**, so farmers are not pushed by retail data they cannot verify.
- Without a key, the app falls back to **labelled** rule-based text, never a silent fake.

### 22.3 Farmer protection by design

- **The base price never changes** through the app; incentives are voluntary and additive.
- **Default-off deduction**, ≤ 30% of a milk bill, controlled only by the farmer and reversible.
- **Hardship pause** when the milk-income proxy falls ≥ 40%.
- **Equal-weight choices**, with no dark patterns; "Declining has no effect on your milk payments."
- The farmer's figures are shown to the farmer **before** sharing, with a path to correct them.
- Honest numbers: negative remainders are shown as "Review budget" and are not hidden.

### 22.4 Inclusion and accessibility

- Gujarati-first for farmers, plus Hindi and English. Audio messages (Gemini TTS) and browser speech preview serve low-literacy users.
- The society is the assisted channel for farmers who do not use the app themselves.
- 12 px minimum text, 44 px touch targets on mobile, `aria-live` toasts, labelled controls, alt text, tab roles, and a high-contrast dark theme.

### 22.5 Honesty and labelling

- "Training environment", "synthetic", "Example only", "illustrative", "draft assumption", "demand-derived, not measured", "not connected".
- Missing inputs are shown as "Not provided" rather than inferred.
- The sample platform split is disclosed as an even synthetic split.
- The non-affiliation notice is on every page.

---

## 23. Technical execution

### 23.1 What was built

- **A working end-to-end system:** Excel upload → validation → stockout-aware LightGBM quantile forecast → channel, Q-Com, milk and solids views → collection plan → AI-drafted, translated and voiced member message → farmer inbox.
- In parallel, a **five-actor loan workflow** with server-enforced gates, and a full bank desk lifecycle through repayment and hardship.
- **Engineering choices:**
  - Zero-dependency Node server.
  - Vanilla JS, so there is no build step.
  - Python only where ML is needed.
  - **Deterministic** models (fixed seeds), so the **content-addressed cache** (SHA-256 of the workbook plus the scenario) is exact.
  - Precomputation at Docker build makes the free-tier deployment respond instantly.
- **Model rigour:**
  - a global model across 72 series
  - quantile objectives
  - a leakage-safe 7-day holdout using realised exogenous values
  - scoring only on in-stock days
  - a stockout correction in both training lags and history
  - a classical Holt–Winters baseline for comparison
  - an honest metric set (WAPE, MAE/MAD, MAPE excluding zeros, signed bias)
- **Data contract and quality gate:** required and optional columns, typed parsing, rejection reasons, duplicate flagging rather than silent dropping, coverage reporting, and completeness-gated KPIs.
- **Deployment:**
  - Dockerfile (Python 3.12 + Node 24 + libgomp)
  - Render Blueprint, free plan
  - health check
  - auto-deploy from GitHub
- **Resilience:**
  - Gemini model fallback chain and timeouts
  - Python error messages mapped to plain language
  - 12 MB upload limit
  - output size cap
  - session-expiry handling
  - double-submit guards

### 23.2 Production architecture (target)

```
Partner feeds (Q-com APIs, Amul storefront, distributor DMS, ERP/SAP, plant & procurement, society AMCS milk collection)
   → ingestion (scheduled/API) → validation & master data (SKU, location, channel) → feature store
   → model service (LightGBM quantiles + baselines, retrained daily, calibration monitoring, drift alerts)
   → planning APIs (SKU × city × channel; DMEF daily, Non-DMEF weekly; milk-equivalent & solids)
   → apps: planner UI · society app · farmer app (Android, WhatsApp/IVR) · bank desk
Identity & consent: OIDC/MFA for staff, OTP for farmers, consent manager / Account Aggregator, policy engine (purpose, fields, expiry)
Data: PostgreSQL (encrypted), object store for files, tamper-evident audit log, retention jobs; hosting in India
```

### 23.3 What to harden first

1. Real authentication: hashed passwords or OTP, rate limiting and lockout; remove the password-returning endpoint.
2. Restrict static serving to an allow-list of public assets.
3. A persistent database with encryption, and a server-side audit log.
4. CSRF tokens; escape all remaining template fields.
5. Self-host fonts and logo; review the third-party translation privacy path or move to a server-side translation API.
6. Calibrate the P10–P90 intervals; add drift monitoring.

---

## 24. Case-to-prototype alignment

| Case element | Prototype evidence | Strength |
|---|---|---|
| "Real-time inventory and demand data" for quick commerce | Q-Com planner by SKU × city × platform; fill rate and stock cover when data exists | Strong (sample data) |
| "Data-driven forecasting like competitors" | LightGBM quantile forecasts, backtest metrics, scenarios | Strong |
| "Cold-chain readiness for short-shelf-life, hyperlocal drops" | DMEF daily cadence; planner suggestion to "review chilled stock cover and cold-chain capacity" for buttermilk and dahi | Medium (signal, no cold-chain model) |
| "Do not sideline village societies" | Society console, manager workspace, society as the required step | Strong |
| "Protect farmer price transparency" | Rate breakdown, unchanged base price, voluntary incentive, separation of retail and settlement | Strong |
| "Give farmers earlier demand signals" | Collection plan driven by the 7-day forecast, delivered as messages with audio | Strong |
| "Plan procurement / processing capacity" | Milk-equivalent litres, fat and SNF, capacity proxy, Holt–Winters milk baseline | Medium (draft recipes) |
| "Improve price realisation" | Quality-linked incentive per qualifying litre; credit for productive assets | Medium (mechanism shown, impact not measured) |
| Q2: data parameters by supply-chain point | Workbook contract, inspection coverage, §9.4 table | Strong |
| Q3: marketing to farmers / consumers | Farmer messaging strong; consumer marketing absent | Partial |
| Q4: role of banks | Full five-actor flow and bank desk | Strong |
| Q5: financial products for farmer / society / consumer | Farmer: advance, cattle-care, equipment, working capital, emergency, animal-health (example). Society: chilling equipment (example). Consumer: offers (example). | Partial for society and consumer |

---

## 25. Innovation

1. **Stockout-aware demand sensing for a cooperative:** the forecast learns from in-stock days and reconstructs demand on out-of-stock days, so a shortage does not lower the next plan.
2. **Shelf-life-aware cadence:** one model is presented at two planning rhythms (daily DMEF for dark stores, weekly Non-DMEF for fulfilment centres).
3. **Demand → milk translation:** SKU forecasts are converted into litres, fat and SNF, which turns retail signals into a society-level collection plan and a quality-linked incentive.
4. **Cooperative-mediated, farmer-confirmed credit:** a five-step, server-enforced chain (society prepares → Amul releases only milk facts for one application → farmer confirms and only then shares finances → society forwards → bank reviews). Data custody stays with the cooperative.
5. **Supply-history underwriting without a score:** verified pour regularity, volume trend, quality against the society average and tenure, shown as transparent indicators beside a milk-bill repayment guide, with a hardship pause linked to income drops.
6. **Responsible GenAI for rural communication:** AI drafts limited to the approved plan, translation that preserves uncertainty, audio for low literacy, locked caveats and human approval.
7. **Instant demos on a minimal deployment:** deterministic models plus a content-addressed cache precomputed at build time.

---

## 26. Defence: hard questions and answers

**Q1. Your data is synthetic. Why should we trust any of this?**
The prototype demonstrates *mechanisms*, not results. Every synthetic element is labelled, the data contract is explicit, and the pipeline accepts a real export unchanged. The scenarios are deliberately differentiated (baseline 23,144 → combined 44,424 units) to show the model reacts sensibly, and the backtest shows WAPE of 7–9.5%. A pilot with one union's real data is the next step.

**Q2. LightGBM is a black box. How do planners trust it?**
Three ways. The app shows the strongest drivers in plain words (last 7-day average, same day last week, yesterday, weekday, season, temperature). It reports holdout error and bias openly. And it carries a transparent Holt–Winters baseline beside it. P10–P90 ranges show uncertainty instead of a single number.

**Q3. Why not just use the platforms' own forecasts?**
Platforms forecast *their* stores. Amul needs a cross-channel view (General trade, Institutional and every Q-com partner) translated into milk procurement. Also, platform forecasts learn from their own stockouts; ours corrects for them.

**Q4. Isn't "estimated unmet demand" made up?**
It is a model-based counterfactual, and the app says so wherever it appears. It is never below observed sales, it is used only for out-of-stock days, and it is not used to claim lost revenue. Without it, a stockout teaches the system to plan *less*, which is the actual failure mode in fresh dairy.

**Q5. Does this sideline the village society, the case's main concern?**
No. Societies are mandatory in both farmer-facing flows. Collection plans and messages go out through the society console and need a secretary-style review. Loan applications are *prepared* and *forwarded* by the society manager, and lender questions go back to both the farmer and the society. The platform strengthens the society's role.

**Q6. Will incentives distort the milk price or farmer trust?**
The base price is never changed by the app, and the message says so. Incentives are voluntary, per qualifying litre above quality minimums, and need a confirmed budget that covers the maximum exposure. The farmer sees a transparent rate breakdown, and retail prices are explicitly kept separate from settlements.

**Q7. Banks plus farmer data sounds like exploitation. How is consent real?**
- The consent comes from the farmer's own login. Neither the operator nor the society can give it.
- Approve and decline carry equal weight.
- The dialog states who, why, until when and exactly which fields.
- Declining does not affect milk payments.
- Amul releases only four milk facts, for one application. Finances are shared only after confirmation, for 30 days.
- A decline withdraws access that was already released.
- Milk-bill deduction is a separate, default-off choice that can be reversed.

**Q8. Is this DPDP-compliant?**
The design follows DPDP principles: specific, informed, affirmative consent, purpose limitation, minimisation, time limits and withdrawal. It is a prototype, not a certified system. The gaps are listed openly in §15 and §21: consent notices and receipts, rights screens, grievance officer, retention jobs, security safeguards and a consent-manager or Account Aggregator integration.

**Q9. Does the AI decide who gets a loan?**
No. There is no credit score anywhere. The worksheet shows indicators; the bank applies its own policy; an independent second review exists; declines need a reason; AI prompts forbid eligibility or approval statements. All AI text is labelled advisory.

**Q10. What if the AI mistranslates or hallucinates a scheme?**
Prompts forbid inventing schemes, rates or guarantees. Member messages are built from the approved plan's facts only. Translations are read-only until a person adopts them, and a native-speaker review is recommended. A locked caveat is always appended, and nothing is sent without operator approval.

**Q11. Many farmers can't read or don't have smartphones.**
That is why the app is Gujarati-first, has audio messages, uses plain labels and large targets, and why the society manager can prepare applications and answer questions. Production delivery would add IVR, WhatsApp voice notes and SMS through the society; the app marks SMS as "Not connected" today.

**Q12. The milk-equivalent recipes are rough. Isn't the procurement number wrong?**
They are draft assumptions, labelled as such, with sources linked. The method (SKU demand × yield → litres, fat and SNF) is the point; the plant's real recipes plug in directly. The app also refuses to claim a shortage without real collection data.

**Q13. Why 7 days? Procurement needs longer horizons.**
Seven days fits the operational decisions for fresh dairy: dark-store replenishment, collection drives and plant scheduling. Longer horizons would use the same pipeline with seasonal and annual features. The Holt–Winters baseline already captures level, trend and weekly season.

**Q14. Is the P10–P90 range an 80% confidence interval?**
Not strictly. Per-series quantiles are summed, which the app states ("planning ranges rather than calibrated… intervals"). Calibration monitoring is on the roadmap.

**Q15. Security looks weak: passwords are in the code.**
Correct, and it is disclosed (§15). It is a single-tenant demo with synthetic accounts. The fix list is ready: real auth or OTP, removal of the password endpoint, allow-listed static files, persistence with encryption, CSRF tokens and rate limiting.

**Q16. Why would quick-commerce partners share data?**
Because they get better forecasts and fill rates back, and because availability of Amul's fast-moving fresh SKUs drives their own orders. The pipeline also works with Amul's own storefront first.

**Q17. What does the bank actually gain?**
Verified, fresh supply data with provenance; applications that arrive farmer-confirmed and society-checked; an optional milk-bill repayment route; and a hardship trigger that reduces default risk. Origination costs fall.

**Q18. What is the economic impact?**
Unmet demand is quantified in units per channel. Pricing it at the realised margin gives the recoverable revenue. The incentive budget is bounded by the maximum exposure, and credit at cooperative-bank rates replaces informal credit. A pilot would measure fill-rate gains, spoilage reduction and farmer price realisation.

**Q19. What is missing?**
Consumer-side marketing and consumer financial products (examples only); society-level financial products beyond equipment finance (an example); live partner connectors; persistent storage; real messaging delivery; calibrated intervals; dark-store granularity. We would rather show these gaps than over-claim.

**Q20. Why "DoorDarshi"?**
It means "far-sighted": seeing demand before it arrives, and keeping the far end of the chain, the farmer, in view.

---

*End of guide. Synthetic, academic prototype; not affiliated with GCMMF or Amul.*
