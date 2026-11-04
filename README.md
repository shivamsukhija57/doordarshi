# Amul Setu interview prototype

A local, login-gated demo with role-based module access. By default the server binds to `127.0.0.1`, so the interview prototype is only reachable from this computer.

## Start the demo

From this folder:

```powershell
node server.js
```

Open `http://127.0.0.1:4173`. Sign-in is required. The sign-in page has a **Show interview demo accounts** section with usernames; passwords are not displayed.

### Access from another computer on the same private network

The updated preview currently uses port `4174` because `4173` is already occupied. Stop the running prototype before starting it for LAN access. In PowerShell, from this folder:

```powershell
$env:HOST = '0.0.0.0'
$env:PORT = '4174'
node server.js
```

On the host computer, run `ipconfig` and find its **IPv4 Address** under the active Wi-Fi or Ethernet adapter. On the other computer, open `http://<that-private-IPv4-address>:4174/`. Both computers need to be on the same trusted network. If Windows Firewall asks, allow Node.js only on the **Private** profile, or create a TCP inbound rule limited to port 4174 and the private profile. Do not disable the firewall or use this setup on public Wi-Fi; the demo accounts are not production authentication.

## Access levels

- **Amul Demo Operator**: Control tower, Society console, Farmer app (with a persona selector), and Bank console. The bank view stays locked until the selected farmer has granted consent in the demo.
- **Farmer accounts**: Farmer app only, with records for that account's farmer persona. Farmers cannot switch to operator or bank modules.

## Accounts

| User | Username | Password | Access |
|---|---|---|---|
| Amul Demo Operator | `amul.operator` | `Setu#Amul2026` | All modules |
| Kokilaben Patel · F-1001 | `farmer01` | `Milk#2026-01` | Farmer app only |
| Rameshbhai Patel · F-1002 | `farmer02` | `Milk#2026-02` | Farmer app only |
| Meenaben Chaudhary · F-1003 | `farmer03` | `Milk#2026-03` | Farmer app only |
| Harishbhai Parmar · F-1004 | `farmer04` | `Milk#2026-04` | Farmer app only |
| Jigneshbhai Desai · F-1005 | `farmer05` | `Milk#2026-05` | Farmer app only |
| Kantaben Thakor · F-1006 | `farmer06` | `Milk#2026-06` | Farmer app only |
| Bharatbhai Rabari · F-1007 | `farmer07` | `Milk#2026-07` | Farmer app only |
| Shantaben Vankar · F-1008 | `farmer08` | `Milk#2026-08` | Farmer app only |
| Dilipbhai Solanki · F-1009 | `farmer09` | `Milk#2026-09` | Farmer app only |
| Rupalben Patel · F-1010 | `farmer10` | `Milk#2026-10` | Farmer app only |

## Interview flow

1. Sign in as `amul.operator`; use Presenter panel to show the heatwave, festival, and platform data switches.
2. In Control tower, review the demand events, approve the milk-solids action, and record the price-parity decision.
3. In Bank console, select a farmer and request scoped data access. The request lists its purpose, fields, and 30-day duration.
4. Sign out and sign in with that farmer’s account. Review the request, then grant or decline. Consent is attached to that farmer account; the operator cannot grant it on their behalf.
5. Sign back in as the operator. With active consent, use the bank chat to ask about missing repayment information, update the illustrative EMI planner, and discuss options with the farmer. Nothing is auto-deducted.
6. In Society console, use the forecast message studio to draft Gujarati or Hindi, choose all or selected farmers, edit the text, generate fresh Gemini audio, and send to the local demo inbox. The interface does not send SMS or WhatsApp.
7. Use **Reset demo** to return to the starting state. **Sign out** returns to the login page.

## Prototype limits

- All account credentials and farmer profiles are synthetic demo values. Do not reuse these passwords.
- This login is for a local interview prototype, not production authentication. The accounts are stored in the source code; use a managed identity service and private secrets before any shared or production deployment.
- Access requests and consent grants are held in the running server memory and reset when the server restarts; the operator can clear them with **Reset demo**. Composer state and audit events are held in the browser demo session.
- Forecasts and financial figures are illustrative, not a validated operational forecast, price, underwriting decision, or loan offer.
- Gujarati text and browser speech need review by a Gujarati speaker before any real use.

## LightGBM demand forecast

The operator's Control tower includes a local Excel upload and seven-day forecast workflow. It fits a global LightGBM gradient-boosted model across the product / market / channel series, with separate quantile models for P10, P50, and P90. Inputs include lag 1, lag 7, trailing 7-day mean, weekday, temperature, promotion, festival, stock availability, and product / market / channel identifiers. Stockout rows are excluded from target training; forecast stock is assumed available.

Install the optional local model dependencies once from this folder:

```powershell
python -m pip install --target .python-deps -r requirements-forecast.txt
```

Then start the server with `node server.js`. The `.python-deps` folder is local-only and excluded from source control. Set `PYTHON` if your Python executable is not named `python`.

### Excel input format

Upload an `.xlsx` workbook whose first worksheet has one header row and these required columns: `date`, `sku`, `market`, `channel`, `units_sold`, `temperature_c`, `promotion`, `festival`, and `in_stock`. Use daily rows per product / market / channel, with `in_stock`, `promotion`, and `festival` values of 0 or 1. At least 35 distinct dates and 21 observations per series are required. Optional columns `units_requested`, `units_fulfilled`, `on_hand_units`, and `search_intent` enable measured fill rate, stock cover, and a separate search-intent signal in Distribution channels. The next-seven-day fill-rate display carries forward the latest seven-day weighted fulfilled/requested ratio as a baseline; it is not a separate LightGBM forecast. Without the relevant fields, these metrics display as unavailable rather than using sample numbers. The provided fictional example workbooks include synthetic requested/fulfilled counts to demonstrate the projection.

The model uses the most recent seven days as a rolling holdout, fits on earlier data, then refits on all history for the next-week forecast. Backtest covariates for holdout days use the recorded temperature and planned event flags, so this score is conditional and may be optimistic if those values would not be known in advance. Out-of-stock observations are excluded as training targets and from accuracy scoring. Their lag-history values are imputed from prior in-stock same-weekday values; the fitted P50 model then estimates counterfactual demand for stockout days, using `in_stock=1` and the day's recorded weather / event covariates. The estimate is floored at observed sales, and the difference is shown as estimated unmet demand. This corrects the sales-only comparison for the dashboard, but it is not observed lost orders or a validated causal lost-sales estimate. Search intent is kept separate and never added to sales or demand.

Five synthetic example workbooks are in `forecast-data/`: baseline, heatwave, festival, promotions, and combined scenarios. They each contain 180 days across four products, three markets, and three channels. The four event workbooks now contain deliberately visible, product-specific demand and event-flag shifts during their closing weeks so the model can surface different forecast leaders and planner prompts. Use the `Run ...` sample buttons in Control tower to run each workbook with its matching next-week scenario switches; the separate download links are still available. Regenerate them from the baseline with `python generate_forecast_samples.py`. These are fabricated demonstration data, not Amul operating history; their backtest scores do not establish real-world accuracy. Use representative, cleaned historical orders/sales before operational use. The Q-Com forecasting screen uses `qcom_category` on Quick commerce rows: DMEF is shown as daily SKU/city demand for the next seven days, while Non-DMEF rolls those daily LightGBM outputs into one weekly planning total by SKU/city/platform. Bundled category assignments (DMEF: Taaza Milk and Buttermilk; Non-DMEF: Masti Dahi and Paneer) are synthetic scenario labels, not approved shelf-life classifications. The screen aggregates dark stores at city level using `market`; it does not forecast individual stores.

The Control tower also shows an aggregate demand decomposition from the uploaded workbook's most recent 56 days: a trend-adjusted level, linear weekly trend, centered weekday effects, and residual RMSE as a noise estimate. These descriptive statistics help explain the demand pattern but are not separate LightGBM model components or causal drivers.

Alongside that descriptive widget, the Control tower fits a separate additive Holt–Winters exponential-smoothing model to aggregate stockout-adjusted daily demand. It fits on the same latest 56 stockout-adjusted days as the descriptive widget, and displays the fitted level, trend, weekday seasonal effects, smoothing parameters, seven-day forecast, and a holdout score from the last seven days of that window. This model is an aggregate baseline; it does not replace LightGBM or use its scenario switches.

The Holt–Winters widget uses `statsmodels.tsa.holtwinters.ExponentialSmoothing` with additive trend, additive weekly seasonality (`seasonal_periods=7` for daily data), estimated initialization, and optimized fitting. `statsmodels>=0.15,<0.16` is included in `requirements-forecast.txt`; rerun the forecast dependency install command after updating requirements. If statsmodels is unavailable offline, a built-in Holt–Winters fallback keeps the forecast running and the widget identifies that implementation.

The seven-day rolling holdout shows WAPE, MAE, MAD, MAPE, and bias without replacing the existing forecast metrics. MAD is the mean absolute error in units. MAPE is mean absolute percentage error and excludes zero-actual points. Bias is mean forecast minus actual: positive means over-forecasting; negative means under-forecasting. All accuracy scores use in-stock observations only.


## Consent-based bank analysis

The operator can request access for one of three loan-planning purposes. Each purpose requests a defined set of required supply and financial facts. The farmer reviews the full scope and approves or declines the request; the fields are not individually optional after approval. The sample accounts include fabricated other income, household expenses, existing monthly payments, and outstanding balances. Those details are available to the farmer and are exposed to the bank only after an active farmer grant. In Bank console, the operator can add a note and click **Analyze consented data**. The analysis prompt is maintained in `server.js` and is composed with the current scoped farmer data and loan scenario at request time. Without `GEMINI_API_KEY`, the button returns a clearly labelled local rule-based preview instead of claiming Gemini produced the response. The analysis is discussion support, not a credit decision.

The Bank console calculates an illustrative EMI and monthly remainder using the farmer’s consented profile. **Share calculation with farmer** stores the full calculation and current analysis in the farmer’s app; the farmer can refresh the shared plan card. This sharing remains inside the local prototype. The farmer’s figures and all results are synthetic demo values, not verified financial records or an actual credit decision. Shared plans and grants are held in server memory and cleared when the server restarts or the operator resets the demo.

If a Python module is missing, install the requirements above. The API accepts `.xlsx` uploads up to 12 MB and is available only to the local signed-in Amul operator.

## Gemini (optional)

Gemini text generation and speech generation run on the local server; the API key is never sent to the browser. Copy `.env.example` to `.env`, add the key locally, then restart the server:

```powershell
Copy-Item .env.example .env
# Edit .env and set GEMINI_API_KEY=your-key
$env:PORT = "4174"
node server.js
```

The server loads `.env` at startup, and `.env` is ignored by Git. After restart, refresh the app; the society draft panel shows **GEMINI CONNECTED** when the key was detected. If the panel says **DEMO MODE · NO KEY**, Gemini was not activated.

The app uses `gemini-3.8-flash` for message drafts and bank chat, and `gemini-3.8-flash-tts` for Gujarati/Hindi speech. Override these with `GEMINI_TEXT_MODEL` or `GEMINI_TTS_MODEL` if needed. Without a key, the message composer and chat use local sample text; Gemini audio requires a key. Do not commit the key or paste it into browser code.

Gemini receives the operator’s prompt and synthetic forecast for message drafting, the edited message for speech, and consented supply figures plus chat context for bank assistance. This prototype does not transmit messages to farmers outside the local app.

## Application language widget

The header uses the GTranslate website widget from `cdn.gtranslate.net` with English, Hindi, Gujarati, and the additional configured languages. The widget does not require a Google Cloud API key; its translation service is provided by GTranslate. The GTranslate site lists the free plan as non-commercial and paid plans for commercial use, so review its terms before using it beyond this interview prototype. Page text is processed by the third-party widget; use synthetic demo data here and review privacy terms before translating live farmer financial records. The Society message Translate control selects Hindi or English in the same GTranslate website widget, so the application page is translated in place. It does not require a separate message-translation API call.
