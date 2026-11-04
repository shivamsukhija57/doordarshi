# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: the case evaluation panel.** Judges and interviewers watching a live demo of the prototype for Case 7 ("How Should Amul Modernise Its Farmer-to-Consumer Supply Chain?"). When trade-offs arise, favour what makes the story clear and credible to them in a few minutes: the problem, the mechanism, and the farmer-protecting safeguards.
- **Represented roles inside the demo:**
  - **GCMMF planning operator** (one account, `amul.operator`): runs demand forecasts, reviews channel and quick-commerce signals, prepares society messages, and, in the prototype, also acts as the bank officer.
  - **Farmer member** (ten accounts, F-1001 … F-1010, five village societies): views the milk passbook, approves, declines or revokes bank data requests, and sees loan plans shared with them. Farmers use their own or a shared basic Android phone, Gujarati first, possibly with low literacy, so voice notes matter.
  - **Society secretary**: represented through the Society console's member-communication flow; there is no separate secretary login yet.

## Product Purpose

DoorDarshi by Amul is a dairy demand and collection planning workspace for a farmer-owned cooperative. It shows how GCMMF could use digital-channel data (what sold, where, when) to plan procurement and give farmers earlier demand signals, without sidelining village societies or weakening farmer price transparency and ownership.

Success means a panel leaves convinced that the cooperative can become data-driven while farmers stay in control of their data and in the loop on decisions.

## Positioning

Two mechanisms together:

1. **Stockout-aware demand forecasting.** A LightGBM model gives low, median and high (P10/P50/P90) 7-day forecasts. It treats out-of-stock days as hidden demand rather than low sales, and includes a separate daily (DMEF) and weekly (Non-DMEF) quick-commerce view.
2. **Farmer-controlled data sharing.** A bank sees a farmer's supply and financial data only after the farmer grants a purpose-limited, 30-day consent from their own login. Nothing is auto-deducted, and AI output is labelled as discussion support, never a credit decision.

## Operating Context

- A local, login-gated web app shown live in an interview or case presentation, from `node server.js` (ports 4173/4174) or a temporary tunnel link.
- The demo flow:
  1. The operator runs a scenario workbook (heatwave, festival, promotion).
  2. The operator reviews signals and the milk-solids estimate.
  3. The operator requests bank access for a farmer.
  4. The farmer signs in and grants consent.
  5. The operator plans an EMI and shares it with the farmer.
  6. The operator drafts a Gujarati or Hindi member message with audio.
- Inputs are Excel workbooks with daily SKU × market × channel rows.
- Live public signals come from Open-Meteo (weather) and Nager.Date (holidays).
- Messages go to a local demo inbox only, never SMS or WhatsApp.

## Capabilities and Constraints

- **Modules:**
  - Control tower
  - Distribution channels
  - Q-Com forecasting
  - Digital demand pipeline
  - Society console
  - Farmer app
  - Bank console
- **Roles:** the operator sees all seven modules; farmers see only the Farmer app, with their own record.
- **Stack:**
  - Vanilla JavaScript single-page app (`index.html`, `app.js`, `styles.css`)
  - Node.js server with no npm dependencies (`server.js`)
  - Python LightGBM and openpyxl scripts started for each forecast
  - Optional Gemini for drafts, audio, bank analysis and chat
  - GTranslate for the header language switcher and for translating member messages
- **Languages:** English, Gujarati and Hindi are required; other GTranslate languages are optional.
- **State:** held in server memory and lost on restart. All farmers, figures and sales data are synthetic.
- **Terminology:**
  - P10/P50/P90
  - stockout-adjusted demand
  - estimated unmet demand
  - DMEF / Non-DMEF
  - fat / SNF
  - milk-solids
  - consent grant, purpose, and 30-day expiry
- **Known open issues**, recorded in `AMUL_SETU_README.md` and in the review history:
  - static file exposure to signed-in users
  - plain-text demo passwords
  - a public demo-account password endpoint
  - in-memory state only
- **Undecided:**
  - a separate society-secretary login
  - a board-approval role
  - the planned price-realisation trail and society planning console
  - consumer marketing insights
  - society and consumer financial products

## Brand Commitments

- **Name:** "DoorDarshi by Amul". The tagline is "Dairy demand & collection planning". "Amul Setu" is the earlier name, still present in some headings and the README; treat it as legacy.
- **Status:** an academic case-competition prototype, not affiliated with, endorsed by, or operated by GCMMF or Amul. Any public link must say so.
- **Voice:** cautious and factual. Forecasts are "planning signals, not promises". AI output is "discussion support, not a credit decision". "Published cooperative schedules remain authoritative." Every illustrative or synthetic figure is labelled as such.

## Evidence on Hand

- **The case brief:** `../Case_7_-_Amul.docx.pdf`, with GCMMF facts: about 3.6 million farmer-owners, 18,000+ societies, FY2025 revenue of about ₹65,911 crore.
- **Synthetic forecast workbooks:** `forecast-data/01_baseline.xlsx` … `05_combined.xlsx`. They cover 180 days, 4 SKUs (Taaza Milk 1L, Buttermilk 500ml, Masti Dahi 400g, Paneer 200g), 3 markets (Ahmedabad, Anand, Pune) and 3 channels.
- **Synthetic farmer personas:** ten personas, defined in `server.js`.
- **Project documentation:** `AMUL_SETU_README.md` and `README.md`.
- **Absences:** there is no real Amul operating data, customer testimonial, pilot result, partner agreement or validated forecast accuracy. Never present backtest scores, prices or farmer outcomes as real.

## Product Principles

1. **Farmers stay in control.** No farmer data reaches a bank without the farmer's own approval, and no money moves automatically.
2. **Societies are partners, not bypassed.** Plans flow through village societies; they're never imposed on individual farmers as quotas.
3. **Honest uncertainty.** Show ranges, label estimates and synthetic data, and never overstate what the model or the AI knows.
4. **Make the case legible in minutes.** Every screen should help an evaluator see the problem, the mechanism and the safeguard without a long explanation.
5. **The traditional network is protected.** Digital channels are added alongside the general trade and booth network, never at its expense.

## Accessibility & Inclusion

- **Farmer-facing content** must work on a basic Android phone, in Gujarati first (then Hindi), for users who may have low literacy. Offer voice alongside text, and use plain language rather than jargon.
- **Machine translation** (GTranslate) must be reviewed before it reaches farmers. A known example: "collection" was mistranslated as चंदा / દાન (a donation).
- **No WCAG level has been set** for the operator screens; that is undecided.
