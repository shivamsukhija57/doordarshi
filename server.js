const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const { spawn } = require('node:child_process');

const root = __dirname;
// Load an ignored, local .env file before reading server configuration. Existing
// process-level variables win so deployment secrets can override local settings.
function loadLocalEnv() {
  const filename = path.join(root, '.env');
  if (!fs.existsSync(filename)) return;
  for (const line of fs.readFileSync(filename, 'utf8').split(/\r?\n/)) {
    const match = line.trim().match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || process.env[match[1]]?.trim()) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}
loadLocalEnv();
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const accounts = [
  { username: 'amul.operator', password: 'Setu#Amul2026', role: 'operator', name: 'Amul Operations Officer' },
  { username: 'cooperative.bank', password: 'Sahakaar#2026', role: 'bankOfficer', bank: 'Sahakaar Cooperative Bank', name: 'Sahakaar Loan Officer' },
  { username: 'society.anand', password: 'Society#Anand26', role: 'societyManager', society: 'Anand Dairy Society', name: 'Anand Society Manager' },
  { username: 'society.borsad', password: 'Society#Borsad26', role: 'societyManager', society: 'Borsad Milk Society', name: 'Borsad Society Manager' },
  { username: 'society.nadiad', password: 'Society#Nadiad26', role: 'societyManager', society: 'Nadiad Dairy Society', name: 'Nadiad Society Manager' },
  { username: 'society.petlad', password: 'Society#Petlad26', role: 'societyManager', society: 'Petlad Milk Society', name: 'Petlad Society Manager' },
  { username: 'society.umreth', password: 'Society#Umreth26', role: 'societyManager', society: 'Umreth Dairy Society', name: 'Umreth Society Manager' },
  { username: 'farmer01', password: 'Milk#2026-01', role: 'farmer', farmerId: 'F-1001', name: 'Kokilaben Patel', society: 'Anand Dairy Society', litres: 182.4, fat: 4.2, snf: 8.6, rate: 36.5, otherMonthlyIncome: 4500, householdExpenses: 18000, existingMonthlyEmi: 2500, existingLoanBalance: 42000 },
  { username: 'farmer02', password: 'Milk#2026-02', role: 'farmer', farmerId: 'F-1002', name: 'Rameshbhai Patel', society: 'Anand Dairy Society', litres: 216.8, fat: 4.0, snf: 8.5, rate: 35.9, otherMonthlyIncome: 3000, householdExpenses: 19500, existingMonthlyEmi: 1800, existingLoanBalance: 28000 },
  { username: 'farmer03', password: 'Milk#2026-03', role: 'farmer', farmerId: 'F-1003', name: 'Meenaben Chaudhary', society: 'Borsad Milk Society', litres: 154.2, fat: 4.5, snf: 8.7, rate: 37.4, otherMonthlyIncome: 6500, householdExpenses: 16500, existingMonthlyEmi: 3200, existingLoanBalance: 76000 },
  { username: 'farmer04', password: 'Milk#2026-04', role: 'farmer', farmerId: 'F-1004', name: 'Harishbhai Parmar', society: 'Borsad Milk Society', litres: 201.6, fat: 3.9, snf: 8.4, rate: 35.3, otherMonthlyIncome: 2500, householdExpenses: 21000, existingMonthlyEmi: 0, existingLoanBalance: 0 },
  { username: 'farmer05', password: 'Milk#2026-05', role: 'farmer', farmerId: 'F-1005', name: 'Jigneshbhai Desai', society: 'Nadiad Dairy Society', litres: 238.1, fat: 4.3, snf: 8.6, rate: 36.8, otherMonthlyIncome: 5000, householdExpenses: 22000, existingMonthlyEmi: 4100, existingLoanBalance: 118000 },
  { username: 'farmer06', password: 'Milk#2026-06', role: 'farmer', farmerId: 'F-1006', name: 'Kantaben Thakor', society: 'Nadiad Dairy Society', litres: 142.7, fat: 4.1, snf: 8.5, rate: 36.1, otherMonthlyIncome: 1800, householdExpenses: 15500, existingMonthlyEmi: 2200, existingLoanBalance: 35000 },
  { username: 'farmer07', password: 'Milk#2026-07', role: 'farmer', farmerId: 'F-1007', name: 'Bharatbhai Rabari', society: 'Petlad Milk Society', litres: 264.5, fat: 4.6, snf: 8.8, rate: 38.0, otherMonthlyIncome: 7200, householdExpenses: 23000, existingMonthlyEmi: 5000, existingLoanBalance: 145000 },
  { username: 'farmer08', password: 'Milk#2026-08', role: 'farmer', farmerId: 'F-1008', name: 'Shantaben Vankar', society: 'Petlad Milk Society', litres: 168.9, fat: 3.8, snf: 8.3, rate: 34.9, otherMonthlyIncome: 2000, householdExpenses: 17000, existingMonthlyEmi: 0, existingLoanBalance: 0 },
  { username: 'farmer09', password: 'Milk#2026-09', role: 'farmer', farmerId: 'F-1009', name: 'Dilipbhai Solanki', society: 'Umreth Dairy Society', litres: 223.3, fat: 4.2, snf: 8.6, rate: 36.5, otherMonthlyIncome: 3800, householdExpenses: 20500, existingMonthlyEmi: 2800, existingLoanBalance: 63000 },
  { username: 'farmer10', password: 'Milk#2026-10', role: 'farmer', farmerId: 'F-1010', name: 'Rupalben Patel', society: 'Umreth Dairy Society', litres: 187.6, fat: 4.4, snf: 8.7, rate: 37.1, otherMonthlyIncome: 5400, householdExpenses: 18500, existingMonthlyEmi: 1600, existingLoanBalance: 24000 }
];
const sessions = new Map();
const publicSignalCache = new Map();
const bankRequests = new Map();
const bankGrants = new Map();
const bankRecommendations = new Map();
const societyLoanCases = [
  { id: 'LD-26041', farmerId: 'F-1001', name: 'Kokilaben Patel', society: 'Anand Dairy Society', product: 'Milk-payment advance', purpose: 'Short-term household and dairy cash-flow support', requested: 30000, applied: '2026-11-02', status: 'Under review', consentUntil: '2026-12-02', submittedBy: 'Farmer application', litres14d: 182.4, rate: 36.5, fat: 4.2, snf: 8.6, otherIncome: 4500, expenses: 18000, currentEmi: 2500, balance: 42000, offer: { amount: 30000, months: 12, rate: 12, seasonal: false }, thread: [], missingInfo: '', installments: [], synthetic: true, activity: [{ date: '2026-11-02', text: 'Sample application received with farmer consent.' }, { date: '2026-11-03', text: 'Society supply record matched to the sample member profile.' }] },
  { id: 'LD-26042', farmerId: 'F-1002', name: 'Rameshbhai Patel', society: 'Anand Dairy Society', product: 'Cattle-care loan', purpose: 'Cattle-care and veterinary expenses', requested: 85000, applied: '2026-10-30', status: 'More information needed', consentUntil: '2026-11-29', submittedBy: 'Farmer application', litres14d: 216.8, rate: 35.9, fat: 4.0, snf: 8.5, otherIncome: 3000, expenses: 19500, currentEmi: 1800, balance: 28000, offer: { amount: 85000, months: 24, rate: 12, seasonal: true }, missingInfo: 'Seasonal income pattern and supplier quotation', thread: [{ question: 'Seasonal income pattern and supplier quotation', askedBy: 'Sahakaar loan desk', askedAt: '2026-10-31T10:00:00.000Z', answers: [] }], installments: [], synthetic: true, activity: [{ date: '2026-10-30', text: 'Sample application received with farmer consent.' }, { date: '2026-10-31', text: 'Lender requested seasonal income details and supplier quotation.' }] },
  { id: 'LD-26043', farmerId: 'F-1003', name: 'Meenaben Chaudhary', society: 'Borsad Milk Society', product: 'Chilling equipment finance', purpose: 'Dairy chilling equipment', requested: 120000, applied: '2026-10-29', status: 'Offer sent', consentUntil: '2026-11-28', submittedBy: 'Farmer application', litres14d: 154.2, rate: 37.4, fat: 4.5, snf: 8.7, otherIncome: 6500, expenses: 16500, currentEmi: 3200, balance: 76000, offer: { amount: 90000, months: 24, rate: 11.5, seasonal: false, prepared: true }, missingInfo: '', thread: [], installments: [], synthetic: true, activity: [{ date: '2026-10-29', text: 'Sample application received with farmer consent.' }, { date: '2026-11-01', text: 'Illustrative offer summary recorded for farmer review.' }] },
  { id: 'LD-26044', farmerId: 'F-1004', name: 'Harishbhai Parmar', society: 'Borsad Milk Society', product: 'Milk-payment advance', purpose: 'Short-term dairy cash-flow support', requested: 45000, applied: '2026-09-28', status: 'Repaying', consentUntil: '2026-10-28', submittedBy: 'Farmer application', litres14d: 201.6, rate: 35.3, fat: 3.9, snf: 8.4, otherIncome: 2500, expenses: 21000, currentEmi: 0, balance: 0, offer: { amount: 42000, months: 18, rate: 12, seasonal: false, prepared: true }, repaymentOptIn: true, installments: [{ due: '2026-11-10', amount: 2600, status: 'Paid' }, { due: '2026-12-10', amount: 2600, status: 'Due' }, { due: '2027-01-10', amount: 2600, status: 'Upcoming' }], thread: [], missingInfo: '', synthetic: true, activity: [{ date: '2026-09-28', text: 'Sample farmer acceptance recorded.' }, { date: '2026-10-01', text: 'Sample disbursement recorded; no money moved.' }, { date: '2026-11-02', text: 'Sample milk-volume change flagged for human review.' }] },
];
let nextSocietyLoanId = 1;
const BANK_PURPOSES = {
  advance: { label: 'Milk-payment advance affordability illustration', fields: ['litres', 'rate', 'fat', 'snf', 'otherMonthlyIncome', 'householdExpenses', 'existingMonthlyEmi', 'existingLoanBalance'], labels: ['14-day milk volume', 'published milk rate', 'average fat', 'average SNF', 'other monthly income', 'essential household expenses', 'existing monthly loan payments', 'approximate outstanding loan balance'] },
  repayment: { label: 'Loan repayment planning discussion', fields: ['litres', 'rate', 'otherMonthlyIncome', 'householdExpenses', 'existingMonthlyEmi', 'existingLoanBalance'], labels: ['14-day milk volume', 'published milk rate', 'other monthly income', 'essential household expenses', 'existing monthly loan payments', 'approximate outstanding loan balance'] },
  equipment: { label: 'Chilling equipment finance discussion', fields: ['litres', 'rate', 'fat', 'snf', 'otherMonthlyIncome', 'householdExpenses', 'existingMonthlyEmi', 'existingLoanBalance'], labels: ['14-day milk volume', 'published milk rate', 'average fat', 'average SNF', 'other monthly income', 'essential household expenses', 'existing monthly loan payments', 'approximate outstanding loan balance'] },
};
const FARMER_ANALYSIS_SYSTEM = 'You are an assistant to a cooperative bank officer in a cooperative financial-planning workspace. Analyze only the supplied farmer-consented supply and financial facts, the loan scenario, and operator note. Give practical, cautious discussion points and ask for missing information. Do not recommend approval or rejection, determine eligibility, infer unprovided income/debt/expenses, make guarantees, or pressure the farmer. Clearly distinguish observed data from estimates and say the farmer and lender make all decisions.';
const FARMER_ANALYSIS_PROMPT = `Review this consent-scoped farmer profile and scenario. Return: (1) what the supplied data says, (2) a cautious repayment discussion based only on supplied values, (3) the most important missing questions, and (4) an optional next step for the operator to discuss with the farmer. Do not make a credit decision.\n\nDynamic consented data and scenario:\n`;
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const publicDemoAccounts = accounts.map(({ username, role, name, farmerId, society, bank }) => ({ username, role, name, farmerId, society, bank }));

function send(res, status, body, type = 'application/json; charset=utf-8', headers = {}) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
function getSession(req) {
  const token = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('amul_setu_session='))?.split('=')[1];
  return token ? sessions.get(token) : undefined;
}
function publicUser(user) {
  const { username, role, name, farmerId, society, bank, litres, fat, snf, rate, otherMonthlyIncome, householdExpenses, existingMonthlyEmi, existingLoanBalance } = user;
  return { username, role, name, farmerId, society, bank, litres, fat, snf, rate, otherMonthlyIncome, householdExpenses, existingMonthlyEmi, existingLoanBalance };
}
// Text requests fall back to other models when the configured one is overloaded
// (HTTP 429/500/503) or does not answer within 30 s. Audio requests stay on the
// configured TTS model.
const GEMINI_FALLBACK_TEXT_MODELS = (process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.5-flash,gemini-3.5-flash-lite').split(',').map(name => name.trim()).filter(Boolean);
async function callGemini(model, body) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not configured.');
  const audio = body.response_format?.type === 'audio';
  const candidates = audio ? [model] : [model, ...GEMINI_FALLBACK_TEXT_MODELS.filter(name => name !== model)];
  let lastError;
  for (const candidate of candidates) {
    let response;
    try {
      response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ model: candidate, ...body }),
        signal: AbortSignal.timeout(audio ? 90000 : 30000)
      });
    } catch (error) {
      lastError = new Error(`Gemini request failed (${candidate} · ${error.name === 'TimeoutError' ? 'timed out' : 'network error'})`);
      console.error(lastError.message);
      continue;
    }
    const result = await response.json().catch(() => ({}));
    if (response.ok) return result;
    lastError = new Error(`Gemini request failed (${candidate} · HTTP ${response.status})`);
    console.error(lastError.message);
    if (![429, 500, 503].includes(response.status)) break;
  }
  throw lastError;
}
const TRANSLATION_LANGUAGES = { hi: 'Hindi', gu: 'Gujarati', en: 'English', Hindi: 'Hindi', Gujarati: 'Gujarati', English: 'English' };
function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 8000) reject(new Error('Request too large')); });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}
function readBuffer(req, limit = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0; let rejected = false;
    req.on('data', chunk => { if (rejected) return; size += chunk.length; if (size > limit) { rejected = true; chunks.length = 0; reject(new Error('Workbook is larger than the 12 MB upload limit.')); return; } chunks.push(chunk); });
    req.on('end', () => { if (!rejected) resolve(Buffer.concat(chunks)); });
    req.on('error', error => { if (!rejected) reject(error); });
  });
}
// The sample buttons name a bundled workbook instead of uploading it, so large samples cost no transfer.
async function readWorkbook(req) {
  const sample = new URL(req.url, 'http://localhost').searchParams.get('sample');
  if (sample === null) return readBuffer(req);
  if (!/^[\w-]+\.xlsx$/.test(sample)) throw new Error('Unknown sample workbook.');
  return fs.promises.readFile(path.join(root, 'forecast-data', sample)).catch(() => { throw new Error('Unknown sample workbook.'); });
}
function runForecast(workbookPath, scenario) {
  return new Promise((resolve, reject) => {
    const python = process.env.PYTHON || 'python';
    const localDeps = path.join(root, '.python-deps');
    const env = { ...process.env, PYTHONPATH: [localDeps, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter) };
    const child = spawn(python, [path.join(root, 'forecast_model.py'), workbookPath, JSON.stringify(scenario)], { cwd: root, env, windowsHide: true });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', data => { stdout += data.toString(); if (stdout.length > 3_000_000) child.kill(); });
    child.stderr.on('data', data => { stderr += data.toString(); if (stderr.length > 20_000) stderr = stderr.slice(-20_000); });
    child.on('error', () => reject(new Error('Python could not start. Install Python 3.10+ and the packages in requirements-forecast.txt.')));
    child.on('close', code => {
      try {
        const result = JSON.parse(stdout.trim());
        if (code !== 0 || result.error) return reject(new Error(result.error || 'Forecast model failed to run.'));
        resolve(result);
      } catch {
        reject(new Error(stderr.includes('No module named') ? 'Forecast packages are missing. Install requirements-forecast.txt and restart the server.' : 'Forecast model returned an unreadable result.'));
      }
    });
  });
}
// Forecasts and inspections are deterministic for the same workbook bytes and scenario
// (the model uses fixed seeds), so repeat runs reuse a stored result instead of retraining.
// Results for the bundled sample workbooks are precomputed into forecast-cache/ when the
// Docker image is built (warm_forecast_cache.py), which matters on small shared CPUs.
const resultCacheDir = path.join(root, 'forecast-cache');
const resultCache = new Map();
function scenarioTag(scenario) {
  return `h${scenario.heatwave ? 1 : 0}f${scenario.festival ? 1 : 0}p${scenario.promotion ? 1 : 0}`;
}
async function cachedResult(key, compute) {
  if (resultCache.has(key)) return resultCache.get(key);
  let result;
  try { result = JSON.parse(await fs.promises.readFile(path.join(resultCacheDir, `${key}.json`), 'utf8')); }
  catch { result = await compute(); }
  resultCache.set(key, result);
  if (resultCache.size > 40) resultCache.delete(resultCache.keys().next().value);
  return result;
}
function runPipelineInspection(workbookPath) {
  return new Promise((resolve, reject) => {
    const python = process.env.PYTHON || 'python';
    const localDeps = path.join(root, '.python-deps');
    const env = { ...process.env, PYTHONPATH: [localDeps, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter) };
    const child = spawn(python, [path.join(root, 'inspect_workbook.py'), workbookPath], { cwd: root, env, windowsHide: true });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', data => { stdout += data.toString(); });
    child.stderr.on('data', data => { stderr += data.toString(); });
    child.on('error', () => reject(new Error('Python could not start. Install Python 3.10+ and the packages in requirements-forecast.txt.')));
    child.on('close', code => {
      try {
        const result = JSON.parse(stdout.trim());
        if (code !== 0 || result.error) return reject(new Error(result.error || stderr || 'Workbook inspection failed.'));
        resolve(result);
      } catch { reject(new Error('Workbook inspection returned an unreadable result.')); }
    });
  });
}
// Synthetic lifetime passbook, repeatable per farmer. Joining months match the loan desk's tenure
// for F-1001 to F-1004, and the latest settled month sits at the farmer's current 14-day run rate.
const MEMBER_SINCE = { 'F-1001': '2022-11', 'F-1002': '2023-11', 'F-1003': '2021-09', 'F-1004': '2023-11', 'F-1005': '2019-06', 'F-1006': '2024-02', 'F-1007': '2018-04', 'F-1008': '2022-07', 'F-1009': '2020-08', 'F-1010': '2021-12' };
const LAST_SETTLED_MONTH = '2026-10';
const MILK_SEASON = [1.12, 1.10, 1.02, 0.92, 0.85, 0.82, 0.86, 0.90, 0.95, 1, 1.06, 1.12];
function farmerPassbook(account) {
  let seed = Number(account.farmerId.slice(2));
  const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const round = (value, digits) => Number(value.toFixed(digits));
  const monthIndex = text => { const [year, month] = text.split('-').map(Number); return year * 12 + month - 1; };
  const first = monthIndex(MEMBER_SINCE[account.farmerId]), last = monthIndex(LAST_SETTLED_MONTH);
  const months = [];
  let cumulativeLitres = 0;
  for (let index = first; index <= last; index++) {
    const year = Math.floor(index / 12), month = index % 12, monthsAgo = last - index, days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const season = MILK_SEASON[month], herdGrowth = Math.max(0.7, 1 - 0.004 * monthsAgo);
    const litres = round(account.litres / 14 * days * season * herdGrowth * (monthsAgo ? 0.96 + random() * 0.08 : 1), 1);
    const fat = round(account.fat + (season - 1) * 0.8 + (random() - 0.5) * 0.1, 2), snf = round(account.snf + (season - 1) * 0.3 + (random() - 0.5) * 0.06, 2);
    const rate = round(account.rate * (1 - 0.0035 * monthsAgo), 2), value = round(litres * rate, 2), deductions = round(value * (0.03 + random() * 0.03), 2);
    cumulativeLitres = round(cumulativeLitres + litres, 1);
    months.push({ month: `${year}-${String(month + 1).padStart(2, '0')}`, financialYear: month >= 3 ? `FY ${year}-${String(year + 1).slice(2)}` : `FY ${year - 1}-${String(year).slice(2)}`, pours: days * 2 - Math.floor(random() * 4), litres, fat, snf, rate, value, deductions, netPaid: round(value - deductions, 2), cumulativeLitres });
  }
  const summarise = rows => {
    const litres = rows.reduce((sum, row) => sum + row.litres, 0), value = rows.reduce((sum, row) => sum + row.value, 0), deductions = rows.reduce((sum, row) => sum + row.deductions, 0);
    return { months: rows.length, pours: rows.reduce((sum, row) => sum + row.pours, 0), litres: round(litres, 1), fat: round(rows.reduce((sum, row) => sum + row.fat * row.litres, 0) / litres, 2), snf: round(rows.reduce((sum, row) => sum + row.snf * row.litres, 0) / litres, 2), rate: round(value / litres, 2), value: round(value, 2), deductions: round(deductions, 2), netPaid: round(value - deductions, 2) };
  };
  const years = [...new Set(months.map(row => row.financialYear))].map(financialYear => ({ financialYear, ...summarise(months.filter(row => row.financialYear === financialYear)) }));
  return { memberSince: MEMBER_SINCE[account.farmerId], settledThrough: LAST_SETTLED_MONTH, totals: summarise(months), highestMonth: months.reduce((best, row) => row.litres > best.litres ? row : best), years, months };
}
const loginPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#E31E24"><title>Sign in · DoorDarshi by Amul</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet"><style>
*{box-sizing:border-box}body{margin:0;background:#f4f7fb;color:#182b43;font:14px Inter,Arial,sans-serif;min-height:100vh;display:grid;place-items:center;padding:22px}.card{width:min(950px,100%);display:grid;grid-template-columns:1.05fr .95fr;background:white;border:1px solid #dee6ef;border-radius:18px;overflow:hidden;box-shadow:0 22px 75px #143d2414}.intro{background:linear-gradient(145deg,#155b91,#103B66);color:white;padding:42px;display:flex;flex-direction:column}.brand{display:flex;align-items:center;gap:11px;font:800 19px 'Plus Jakarta Sans'}.mark{width:43px;height:40px;border-radius:10px;background:#1470ab;display:grid;place-items:center;font:italic 700 29px Georgia}.amul-login-logo{display:block;width:80px;height:44px;object-fit:contain;flex:0 0 auto}.intro h1{font:800 32px/1.13 'Plus Jakarta Sans';letter-spacing:-1px;margin:76px 0 13px;max-width:390px}.intro p{color:#d3e8d9;line-height:1.65;max-width:400px}.badge{margin-top:auto;background:#ffffff1a;border:1px solid #ffffff36;padding:11px;border-radius:8px;font-size:11px;line-height:1.5}.form{padding:40px 42px}.eyebrow{font-size:10px;letter-spacing:1.1px;color:#C52231;font-weight:800}.form h2{font:800 24px 'Plus Jakarta Sans';margin:7px 0}.form p{color:#758178;line-height:1.55;font-size:12px}.field{display:grid;gap:6px;margin:17px 0}.field label{font-size:11px;font-weight:700}.field input{width:100%;padding:12px;border:1px solid #dfe7e0;border-radius:8px;outline-color:#E31E24}.submit{width:100%;border:0;background:#E31E24;color:white;border-radius:8px;padding:12px;font-weight:700;margin-top:3px;cursor:pointer}.error{color:#a3443c!important;min-height:16px}.demo{margin-top:17px;border:1px solid #e5ece6;border-radius:9px;padding:12px}.demo summary{cursor:pointer;font-size:11px;font-weight:700;color:#C52231}.accounts{max-height:235px;overflow:auto;margin-top:10px}.account{width:100%;padding:9px 7px;border:0;border-top:1px solid #edf1ed;background:transparent;color:inherit;text-align:left;font-size:10px;display:grid;grid-template-columns:1fr auto;gap:3px;cursor:pointer}.account:hover,.account:focus-visible{background:#f3f7f3;outline:2px solid #E31E24;outline-offset:-2px;border-radius:5px}.account b{font-size:11px}.account code{background:#f3f7f3;padding:3px 5px;border-radius:4px}.account-feedback{min-height:14px;margin:7px 0 0!important;font-size:10px!important;color:#758178}.account-feedback:empty{display:none}body[data-theme=dark] .account:hover,body[data-theme=dark] .account:focus-visible{background:#202630}body[data-theme=dark] .account-feedback{color:#c3c6d2!important}.privacy{color:#89948c;font-size:10px;margin-top:15px;line-height:1.5}@media(max-width:700px){.card{grid-template-columns:1fr}.intro{padding:24px}.intro h1{margin:25px 0 8px;font-size:26px}.badge{margin-top:10px}.form{padding:26px}}
body{font-family:Inter,Arial,sans-serif}h1,h2,.brand{font-family:'Plus Jakarta Sans',Inter,sans-serif}.theme-toggle{position:fixed;top:18px;right:18px;border:1px solid #343945;background:#181c24;color:#eef0fc;border-radius:8px;padding:9px 12px;font-weight:700;cursor:pointer}body[data-theme=dark]{background:#0C1421;color:#F2F5FA}body[data-theme=dark] .card{background:#121D2D;border-color:#2C3A4E;box-shadow:0 22px 75px #0008}body[data-theme=dark] .intro{background:linear-gradient(145deg,#155b91,#0C3155);border-right:1px solid #2C3A4E}body[data-theme=dark] .intro p{color:#c3c6d2}body[data-theme=dark] .mark{background:#287BB7}body[data-theme=dark] .eyebrow{color:#ff565a}body[data-theme=dark] .form p{color:#a8abb6}body[data-theme=dark] .field input{background:#181c24;color:#eef0fc;border-color:#343945;outline-color:#E31E24}body[data-theme=dark] .submit{background:#F0444D}body[data-theme=dark] .demo{border-color:#343945}body[data-theme=dark] .demo summary{color:#ff7770}body[data-theme=dark] .account{border-color:#2c3039}body[data-theme=dark] .account code{background:#202630;color:#dfe2ee}body[data-theme=dark] .privacy{color:#a8abb6}body[data-theme=dark] .theme-toggle{border-color:#343945;background:#181c24;color:#eef0fc}body[data-theme=light] .theme-toggle{border-color:#dfe7e0;background:white;color:#1d2b23}@media(max-width:700px){.theme-toggle{top:10px;right:10px;padding:7px 9px;font-size:11px}}
.eyebrow,.field label,.demo summary,.account,.account b,.privacy,.badge,.theme-toggle{font-size:12px}.account-feedback{font-size:12px!important}.eyebrow{letter-spacing:.08em}.form p,.account-feedback,.privacy{color:#5e6a62}.submit,body[data-theme=dark] .submit{background:#D11B21}body[data-theme=dark] .field input::placeholder{color:#a8abb6}body[data-theme=dark] .intro p{color:#e6eefa}h1,h2{text-wrap:balance}button,input{font-family:inherit}.brand small{font-size:12px}
</style></head><body data-theme="light"><button class="theme-toggle" id="themeToggle" type="button">☼ Light theme</button><main class="card"><section class="intro"><div class="brand"><img class="amul-login-logo" src="https://shop.amul.com/s/62fa94df8c13af2e242eba16/632c0a030a4b84e22b4994cc/asset-1.png" alt="Amul logo" decoding="async"><span><b style="display:block">DoorDarshi</b><small style="display:block;font:700 12px Inter;color:#ffd5d6">by Amul</small><small style="display:block;font:500 12px Inter;color:#e3eee6">Dairy demand &amp; collection planning</small></span></div><h1>One cooperative network. A clearer view of demand, service, and member outcomes.</h1><p>A unified workspace for cooperative operations, society teams, farmer services, and partner workflows.</p><div class="badge"><b>TRAINING ENVIRONMENT</b><br>Sample member records are used in this workspace.</div></section><section class="form"><div class="eyebrow">WORKSPACE ACCESS</div><h2>Welcome back</h2><p>Sign in to open the modules assigned to your account.</p><form id="loginForm"><div class="field"><label for="username">Username</label><input id="username" autocomplete="username" required placeholder="e.g. amul.operator"></div><div class="field"><label for="password">Password</label><input id="password" type="password" autocomplete="current-password" required placeholder="Enter your password"></div><button class="submit">Sign in to DoorDarshi by Amul</button><p class="error" id="error" role="status"></p></form><details class="demo"><summary>Available team accounts</summary><div class="accounts" id="accounts">Loading accounts…</div><p class="account-feedback" id="accountFeedback" role="status" aria-live="polite"></p></details><div class="privacy">Academic case-competition prototype with synthetic data. Not affiliated with, endorsed by, or operated by GCMMF or Amul.</div></section></main><script>
const form=document.querySelector('#loginForm'),error=document.querySelector('#error');const themeButton=document.querySelector('#themeToggle');function applyTheme(theme){const selected=theme==='light'?'light':'dark';document.body.dataset.theme=selected;document.documentElement.style.colorScheme=selected;themeButton.textContent=selected==='dark'?'☼ Light theme':'◐ Dark theme'}applyTheme(localStorage.getItem('amul-setu-theme-v2')||'light');themeButton.addEventListener('click',()=>{const next=document.body.dataset.theme==='dark'?'light':'dark';localStorage.setItem('amul-setu-theme-v2',next);applyTheme(next)});
form.addEventListener('submit',async e=>{e.preventDefault();error.textContent='';const button=form.querySelector('button');button.disabled=true;button.textContent='Signing in…';try{const response=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:form.username.value.trim(),password:form.password.value})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Sign in failed');location.href='/'}catch(err){error.textContent=err.message;button.disabled=false;button.textContent='Sign in to DoorDarshi by Amul'}});
fetch('/api/demo-accounts').then(r=>r.json()).then(rows=>{const list=document.querySelector('#accounts');list.textContent='';for(const u of rows){const button=document.createElement('button');button.type='button';button.className='account';button.dataset.username=u.username;button.setAttribute('aria-label','Fill sign-in fields for '+u.name);const details=document.createElement('span');const name=document.createElement('b');name.textContent=u.name;details.append(name,document.createElement('br'),document.createTextNode(u.role==='operator'?'Amul operations · all modules':u.role==='societyManager'?u.society+' · Society manager':u.role==='bankOfficer'?u.bank+' · Loan desk':u.farmerId+' · Farmer workspace'));const id=document.createElement('code');id.textContent=u.username;button.append(details,id);list.append(button)}list.addEventListener('click',async event=>{const button=event.target.closest('button[data-username]');if(!button)return;const feedback=document.querySelector('#accountFeedback');feedback.textContent='Filling selected demo account…';try{const response=await fetch('/api/demo-accounts/select',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:button.dataset.username})}),credential=await response.json();if(!response.ok)throw new Error(credential.error||'Could not select this account');document.querySelector('#username').value=credential.username;document.querySelector('#password').value=credential.password;feedback.textContent='Sign-in fields filled for '+button.querySelector('b').textContent+'. Password stays masked. Select “Sign in” to continue.';document.querySelector('#username').focus()}catch(error){feedback.textContent=error.message||'Could not select this account.'}})}).catch(()=>{document.querySelector('#accounts').textContent='Ask your workspace administrator for access.'});
</script></body></html>`;

http.createServer(async (req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { return send(res, 400, 'Bad request', 'text/plain; charset=utf-8'); }

  if (req.method === 'GET' && pathname === '/api/demo-accounts') return send(res, 200, publicDemoAccounts);
  if (req.method === 'POST' && pathname === '/api/demo-accounts/select') {
    try {
      const { username } = await readJson(req);
      const account = accounts.find(item => item.username === String(username || ''));
      if (!account) return send(res, 404, { error: 'Demo account not found.' });
      return send(res, 200, { username: account.username, password: account.password });
    } catch { return send(res, 400, { error: 'Could not select this demo account.' }); }
  }
  if (req.method === 'GET' && pathname === '/api/gemini/status') {
    const user = getSession(req);
    if (!user) return send(res, 401, { error: 'Sign in required.' });
    return send(res, 200, { configured: Boolean(process.env.GEMINI_API_KEY) });
  }
  if (req.method === 'POST' && pathname === '/api/login') {
    try {
      const { username, password } = await readJson(req);
      const user = accounts.find(a => a.username === username && a.password === password);
      if (!user) return send(res, 401, { error: 'The username and password do not match an active account.' });
      const token = crypto.randomBytes(32).toString('hex');
      sessions.set(token, user);
      return send(res, 200, { user: publicUser(user) }, 'application/json; charset=utf-8', { 'Set-Cookie': `amul_setu_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800` });
    } catch { return send(res, 400, { error: 'Could not read sign-in request.' }); }
  }
  if (req.method === 'POST' && pathname === '/api/logout') {
    const session = getSession(req);
    if (session) { const token = (req.headers.cookie || '').match(/amul_setu_session=([^;]+)/)?.[1]; sessions.delete(token); }
    return send(res, 200, { ok: true }, 'application/json; charset=utf-8', { 'Set-Cookie': 'amul_setu_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' });
  }

  const user = getSession(req);
  const scopedCases = farmerId => societyLoanCases.filter(item => !farmerId || item.farmerId === farmerId);
  const publicLoanCase = (item, includePrivate = false) => { const result = { ...item, thread: item.thread || [], activity: item.activity || [] }; if (!includePrivate) for (const field of ['otherIncome', 'expenses', 'currentEmi', 'balance']) delete result[field]; return result; };
  if (req.method === 'GET' && pathname === '/api/society/roster') {
    if (!user || user.role !== 'societyManager') return send(res, 403, { error: 'Only a society manager can view the assigned society roster.' });
    const roster = accounts.filter(item => item.role === 'farmer' && item.society === user.society).map(account => { const { farmerId, name, society, litres, fat, snf, rate } = account; return { farmerId, name, society, litres, fat, snf, rate, passbook: farmerPassbook(account) }; });
    return send(res, 200, { society: user.society, farmers: roster });
  }
  if (req.method === 'GET' && pathname === '/api/operator/bank-data-requests') {
    if (!user || user.role !== 'operator') return send(res, 403, { error: 'Only the Amul operator can review milk-data access requests.' });
    const rows = societyLoanCases.filter(item => item.requestedBySociety && !item.operatorAccessGranted && !['Withdrawn', 'Declined', 'Farmer did not confirm', 'Closed'].includes(item.status)).map(item => ({ id: item.id, farmerId: item.farmerId, name: item.name, society: item.society, product: item.product, purpose: item.purpose, requested: item.requested, applied: item.applied, status: item.status, milkRecord: { litres14d: item.litres14d, rate: item.rate, fat: item.fat, snf: item.snf } }));
    return send(res, 200, rows);
  }
  const releaseMatch = pathname.match(/^\/api\/operator\/bank-data-requests\/([^/]+)\/release$/);
  if (req.method === 'POST' && releaseMatch) {
    if (!user || user.role !== 'operator') return send(res, 403, { error: 'Only the Amul operator can release cooperative milk records.' });
    const item = societyLoanCases.find(row => row.id === releaseMatch[1] && row.requestedBySociety);
    if (!item) return send(res, 404, { error: 'Data-access request not found.' });
    if (item.operatorAccessGranted) return send(res, 409, { error: 'Milk-record access has already been released for this application.' });
    item.operatorAccessGranted = true;
    item.bankVisibleAt = new Date().toISOString();
    item.sharedMilkData = { litres14d: item.litres14d, rate: item.rate, fat: item.fat, snf: item.snf, society: item.society, source: 'Amul cooperative member record' };
    item.status = 'Awaiting farmer confirmation';
    item.activity.unshift({ date: new Date().toISOString().slice(0, 10), text: `Amul operator ${user.name} released the listed milk-supply record to Sahakaar Cooperative Bank for this application only.` });
    return send(res, 200, publicLoanCase(item));
  }
  if (req.method === 'GET' && pathname === '/api/society/loan-cases') {
    if (!user || user.role !== 'societyManager') return send(res, 403, { error: 'Only a society manager can view their society applications.' });
    return send(res, 200, societyLoanCases.filter(item => item.society === user.society).map(publicLoanCase));
  }
  if (req.method === 'POST' && pathname === '/api/society/loan-cases') {
    if (!user || user.role !== 'societyManager') return send(res, 403, { error: 'Only a society manager can prepare a society application.' });
    try {
      const input = await readJson(req), farmerId = String(input.farmerId || ''), farmer = accounts.find(item => item.role === 'farmer' && item.farmerId === farmerId && item.society === user.society);
      if (!farmer) return send(res, 404, { error: 'Choose a farmer assigned to your society.' });
      const requested = Number(input.requested), purpose = String(input.purpose || '').trim().slice(0, 1000), product = String(input.product || '').trim().slice(0, 100);
      if (!Number.isFinite(requested) || requested < 1000 || requested > 5000000 || !purpose || !product) return send(res, 400, { error: 'Enter a valid amount, loan purpose, and product.' });
      if (societyLoanCases.some(item => item.farmerId === farmerId && !['Declined', 'Withdrawn', 'Farmer did not confirm', 'Closed'].includes(item.status))) return send(res, 409, { error: 'This farmer already has an active application in the workspace.' });
      const item = { id: `SM-${String(nextSocietyLoanId++).padStart(5, '0')}`, farmerId, name: farmer.name, society: user.society, product, purpose, requested: Math.round(requested), applied: new Date().toISOString().slice(0, 10), status: 'Awaiting Amul data access', submittedBy: user.name, requestedBySociety: true, operatorAccessGranted: false, farmerConfirmed: false, forwardedToBank: false, consentUntil: null, litres14d: farmer.litres, rate: farmer.rate, fat: farmer.fat, snf: farmer.snf, otherIncome: null, expenses: null, currentEmi: null, balance: null, thread: [], missingInfo: '', activity: [{ date: new Date().toISOString().slice(0, 10), text: `Application prepared by ${user.name}; Amul operator approval is required before the milk record can be shared with Sahakaar Cooperative Bank.` }] };
      societyLoanCases.unshift(item);
      return send(res, 201, publicLoanCase(item));
    } catch { return send(res, 400, { error: 'Could not prepare the application.' }); }
  }
  if (req.method === 'GET' && pathname === '/api/loan-cases') {
    if (!user) return send(res, 401, { error: 'Sign in required.' });
    const rows = user.role === 'bankOfficer' ? societyLoanCases.filter(item => (item.operatorAccessGranted && item.status !== 'Farmer did not confirm') || !item.requestedBySociety) : user.role === 'farmer' ? scopedCases(user.farmerId) : user.role === 'societyManager' ? societyLoanCases.filter(item => item.society === user.society) : null;
    if (!rows) return send(res, 403, { error: 'Not authorized to view loan applications.' });
    return send(res, 200, rows.map(item => { const row = publicLoanCase(item, user.role === 'bankOfficer' && item.farmerConfirmed && item.forwardedToBank); if (user.role === 'bankOfficer' && !(item.farmerConfirmed && item.forwardedToBank)) for (const field of ['otherIncome', 'expenses', 'currentEmi', 'balance']) delete row[field]; return row; }));
  }
  const forwardMatch = pathname.match(/^\/api\/society\/loan-cases\/([^/]+)\/forward$/);
  if (req.method === 'POST' && forwardMatch) {
    if (!user || user.role !== 'societyManager') return send(res, 403, { error: 'Only the assigned society manager can forward an application.' });
    const item = societyLoanCases.find(row => row.id === forwardMatch[1] && row.society === user.society);
    if (!item) return send(res, 404, { error: 'Application not found in your society.' });
    if (!item.operatorAccessGranted || !item.farmerConfirmed) return send(res, 409, { error: 'The Amul data access and farmer confirmation steps must both be complete first.' });
    if (item.forwardedToBank) return send(res, 409, { error: 'This application has already been forwarded.' });
    item.forwardedToBank = true; item.status = 'Forwarded to bank';
    item.activity.unshift({ date: new Date().toISOString().slice(0, 10), text: `Society manager ${user.name} forwarded the farmer-confirmed application to Sahakaar Cooperative Bank.` });
    return send(res, 200, publicLoanCase(item));
  }
  const loanCasePath = pathname.match(/^\/api\/loan-cases\/([^/]+)\/(consent|query|answer|resolve)$/);
  if (req.method === 'POST' && loanCasePath) {
    if (!user) return send(res, 401, { error: 'Sign in required.' });
    const item = societyLoanCases.find(row => row.id === loanCasePath[1]);
    if (!item) return send(res, 404, { error: 'Application not found.' });
    const action = loanCasePath[2], canManager = user.role === 'societyManager' && user.society === item.society, canFarmer = user.role === 'farmer' && user.farmerId === item.farmerId;
    try {
      const input = await readJson(req);
      if (action === 'consent') {
        if (!canFarmer || item.status !== 'Awaiting farmer confirmation' || !item.operatorAccessGranted) return send(res, 403, { error: 'Only the named farmer can confirm after Amul releases the milk record.' });
        if (input.accept !== true) { item.status = 'Farmer did not confirm'; item.operatorAccessGranted = false; item.sharedMilkData = null; item.activity.unshift({ date: new Date().toISOString().slice(0, 10), text: 'Farmer did not confirm the application; bank access to the milk record was withdrawn and private financial details remain unshared.' }); }
        else { item.farmerConfirmed = true; item.status = 'Ready for society forwarding'; item.consentUntil = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10); Object.assign(item, { otherIncome: user.otherMonthlyIncome, expenses: user.householdExpenses, currentEmi: user.existingMonthlyEmi, balance: user.existingLoanBalance }); item.activity.unshift({ date: new Date().toISOString().slice(0, 10), text: 'Farmer confirmed the application and shared the selected financial details with the lender for 30 days.' }); }
        return send(res, 200, publicLoanCase(item));
      }
      if (action === 'query') {
        if (user.role !== 'bankOfficer' || (item.requestedBySociety && !item.forwardedToBank)) return send(res, 403, { error: 'Only the bank officer can request information after the society forwards this application.' });
        const question = String(input.question || '').trim().slice(0, 1200); if (!question) return send(res, 400, { error: 'Enter the information you need.' });
        item.missingInfo = question; item.status = 'More information needed'; item.thread.unshift({ question, askedBy: user.name, askedAt: new Date().toISOString(), answers: [] }); item.activity.unshift({ date: new Date().toISOString().slice(0, 10), text: `Lender requested additional information: ${question}` });
        return send(res, 200, publicLoanCase(item, ['operator', 'bankOfficer'].includes(user.role)));
      }
      if (action === 'answer') {
        if (!canManager && !canFarmer) return send(res, 403, { error: 'Only this farmer or their assigned society manager can answer.' });
        const answer = String(input.answer || '').trim().slice(0, 2000), thread = item.thread?.[0];
        if (!answer || item.status !== 'More information needed' || !thread) return send(res, 409, { error: 'There is no open information request to answer.' });
        thread.answers.push({ answer, by: canFarmer ? 'farmer' : 'societyManager', name: user.name, at: new Date().toISOString() }); item.activity.unshift({ date: new Date().toISOString().slice(0, 10), text: `${canFarmer ? 'Farmer' : 'Society manager'} added an answer to the lender’s information request.` });
        return send(res, 200, publicLoanCase(item));
      }
      if (action === 'resolve') {
        if (user.role !== 'bankOfficer') return send(res, 403, { error: 'Only the bank officer can close an information request.' });
        if (!item.thread?.[0]?.answers?.length) return send(res, 409, { error: 'No answer has been recorded yet.' });
        item.status = 'Under review'; item.missingInfo = ''; item.activity.unshift({ date: new Date().toISOString().slice(0, 10), text: 'Lender marked the information response received; application returned to review.' });
        return send(res, 200, publicLoanCase(item, true));
      }
    } catch { return send(res, 400, { error: 'Could not update the application.' }); }
  }
  if (req.method === 'GET' && pathname === '/api/public-signals') {
    if (!user || user.role !== 'operator') return send(res, 403, { error: 'Only the Amul operator can load dashboard signals.' });
    const url = new URL(req.url, 'http://localhost');
    const markets = [...new Set((url.searchParams.get('markets') || '').split('|').map(value => value.trim()).filter(Boolean))].slice(0, 3);
    const cacheKey = markets.join('|').toLowerCase();
    const cached = publicSignalCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return send(res, 200, cached.payload);
    const requestJson = async (target) => {
      const response = await fetch(target, { signal: AbortSignal.timeout(9000), headers: { 'Accept': 'application/json' } });
      if (!response.ok) throw new Error(`Open data service returned HTTP ${response.status}.`);
      return response.json();
    };
    const weatherResult = await Promise.allSettled(markets.map(async market => {
      const locationName = /,/.test(market) ? market : `${market}, Gujarat, India`;
      const geocodeUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
      geocodeUrl.search = new URLSearchParams({ name: locationName, count: '1', language: 'en', format: 'json', countryCode: 'IN' }).toString();
      const geocode = await requestJson(geocodeUrl);
      const place = geocode.results?.[0];
      if (!place) throw new Error(`Could not locate ${market} for weather lookup.`);
      const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
      weatherUrl.search = new URLSearchParams({ latitude: String(place.latitude), longitude: String(place.longitude), daily: 'temperature_2m_max,precipitation_probability_max', forecast_days: '7', timezone: 'auto' }).toString();
      const weather = await requestJson(weatherUrl);
      const daily = (weather.daily?.time || []).slice(0, 4).map((date, index) => ({ date, maxTempC: weather.daily.temperature_2m_max?.[index] ?? null, precipitationProbability: weather.daily.precipitation_probability_max?.[index] ?? null }));
      const validTemps = daily.map(day => day.maxTempC).filter(value => Number.isFinite(value));
      return { market, resolvedLocation: [place.name, place.admin1].filter(Boolean).join(', '), daily, peakHighNext4dC: validTemps.length ? Math.max(...validTemps) : null, averageHighNext4dC: validTemps.length ? Math.round(validTemps.reduce((sum, value) => sum + value, 0) / validTemps.length * 10) / 10 : null };
    }));
    const year = new Date().getUTCFullYear();
    const holidayResult = await Promise.allSettled([year, year + 1].map(async holidayYear => {
      const holidays = await requestJson(`https://date.nager.at/api/v3/publicholidays/${holidayYear}/IN`);
      return Array.isArray(holidays) ? holidays : [];
    }));
    const weather = weatherResult.filter(item => item.status === 'fulfilled').map(item => item.value);
    const today = new Date();
    const end = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const iso = value => value.toISOString().slice(0, 10);
    const holidayRows = holidayResult.filter(item => item.status === 'fulfilled').flatMap(item => item.value);
    const holidays = [...new Map(holidayRows.filter(item => item.date >= iso(today) && item.date <= iso(end)).map(item => [item.date + '|' + item.name, { date: item.date, name: item.name, localName: item.localName, types: item.types || [] }])).values()].sort((a, b) => a.date.localeCompare(b.date));
    const payload = { weather, holidays, fetchedAt: new Date().toISOString(), sources: { weather: 'Open-Meteo', calendar: 'Nager.Date public holidays · India' }, errors: { weather: weatherResult.filter(item => item.status === 'rejected').map(item => item.reason?.message).filter(Boolean), calendar: holidayResult.filter(item => item.status === 'rejected').map(item => item.reason?.message).filter(Boolean) } };
    publicSignalCache.set(cacheKey, { expiresAt: Date.now() + 15 * 60 * 1000, payload });
    return send(res, 200, payload);
  }

  if (req.method === 'POST' && pathname === '/api/demo/reset') {
    if (!user || user.role !== 'operator') return send(res, 403, { error: 'Only the Amul operator can reset the demo.' });
    bankRequests.clear(); bankGrants.clear(); bankRecommendations.clear();
    return send(res, 200, { ok: true });
  }
  if (req.method === 'GET' && pathname === '/api/bank/status') {
    if (!user) return send(res, 401, { error: 'Sign in required.' });
    const farmerId = new URL(req.url, 'http://localhost').searchParams.get('farmerId');
    if (user.role === 'farmer' && farmerId !== user.farmerId) return send(res, 403, { error: 'Farmers can only view their own access status.' });
    if (user.role !== 'operator' && user.role !== 'farmer') return send(res, 403, { error: 'Not authorized.' });
    const grant = bankGrants.get(farmerId);
    const active = Boolean(grant && grant.expiresAt > Date.now());
    return send(res, 200, { request: bankRequests.get(farmerId) || null, granted: active, expiresAt: active ? grant.expiresAt : null, purpose: active ? grant.purpose : null, purposeKey: active ? grant.purposeKey : null, fields: active ? grant.fields : [], fieldLabels: active ? grant.fieldLabels : [], repaymentOptIn: active ? Boolean(grant.repaymentOptIn) : false });
  }
  if (req.method === 'GET' && pathname === '/api/operator/farmer-profile') {
    if (!user || user.role !== 'operator') return send(res, 403, { error: 'Only an Amul operator can view cooperative milk records.' });
    const farmerId = new URL(req.url, 'http://localhost').searchParams.get('farmerId');
    const account = accounts.find(item => item.role === 'farmer' && item.farmerId === farmerId);
    if (!account) return send(res, 404, { error: 'Farmer not found.' });
    const { farmerId: id, name, society, litres, fat, snf, rate } = account;
    return send(res, 200, { farmerId: id, name, society, litres, fat, snf, rate, recordPurpose: 'Internal cooperative milk procurement and settlement', passbook: farmerPassbook(account) });
  }
  if (req.method === 'GET' && pathname === '/api/bank/profile') {
    if (!user || user.role !== 'operator') return send(res, 403, { error: 'Only the operator can view a consented bank profile.' });
    const farmerId = new URL(req.url, 'http://localhost').searchParams.get('farmerId');
    const grant = bankGrants.get(farmerId);
    if (!grant || grant.expiresAt <= Date.now()) return send(res, 403, { error: 'Active farmer consent is required.' });
    const account = accounts.find(item => item.role === 'farmer' && item.farmerId === farmerId);
    if (!account) return send(res, 404, { error: 'Farmer not found.' });
    const profile = { farmerId: account.farmerId, name: account.name, society: account.society, consentPurpose: grant.purpose, consentFields: grant.fields, consentFieldLabels: grant.fieldLabels, expiresAt: grant.expiresAt };
    for (const field of grant.fields) {
      if (Object.hasOwn(account, field)) profile[field] = account[field];
      else if (Object.hasOwn(grant.farmerProvided || {}, field)) profile[field] = grant.farmerProvided[field];
    }
    return send(res, 200, profile);
  }
  if (req.method === 'POST' && pathname === '/api/bank/request') {
    if (!user || user.role !== 'operator') return send(res, 403, { error: 'Only the Amul operator can request access.' });
    try {
      const { farmerId, purpose = 'advance' } = await readJson(req);
      if (!accounts.some(account => account.role === 'farmer' && account.farmerId === farmerId)) return send(res, 404, { error: 'Farmer not found.' });
      const scope = BANK_PURPOSES[purpose];
      if (!scope) return send(res, 400, { error: 'Choose a supported data-access purpose.' });
      if (bankGrants.get(farmerId)?.expiresAt > Date.now()) return send(res, 409, { error: 'This farmer already has an active grant.' });
      const request = { status: 'pending', purpose: scope.label, purposeKey: purpose, fields: scope.fields, fieldLabels: scope.labels, requestedAt: Date.now(), expiresInDays: 30 };
      bankRequests.set(farmerId, request);
      return send(res, 200, { request });
    } catch { return send(res, 400, { error: 'Could not create the access request.' }); }
  }
  if (req.method === 'POST' && pathname === '/api/bank/consent') {
    if (!user || user.role !== 'farmer') return send(res, 403, { error: 'The farmer must grant access from their own account.' });
    const request = bankRequests.get(user.farmerId);
    if (!request || request.status !== 'pending') return send(res, 409, { error: 'There is no pending request to approve.' });
    const grant = { grantedAt: Date.now(), expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, fields: request.fields, fieldLabels: request.fieldLabels, farmerProvided: {}, purpose: request.purpose, purposeKey: request.purposeKey, repaymentOptIn: false };
    bankGrants.set(user.farmerId, grant);
    bankRequests.set(user.farmerId, { ...request, status: 'approved', approvedFields: request.fields, approvedFieldLabels: request.fieldLabels, respondedAt: Date.now() });
    return send(res, 200, { granted: true, expiresAt: grant.expiresAt, fields: grant.fields, fieldLabels: grant.fieldLabels });
  }
  if (req.method === 'GET' && pathname === '/api/farmer/loan-plan') {
    if (!user || user.role !== 'farmer') return send(res, 403, { error: 'Sign in as the farmer to view a shared loan plan.' });
    return send(res, 200, { recommendation: bankRecommendations.get(user.farmerId) || null });
  }
  if (req.method === 'POST' && pathname === '/api/bank/share-plan') {
    if (!user || user.role !== 'operator') return send(res, 403, { error: 'Only the Amul operator can share a loan discussion draft.' });
    try {
      const input = await readJson(req);
      const farmerId = String(input.farmerId || '');
      const grant = bankGrants.get(farmerId);
      if (!grant || grant.expiresAt <= Date.now()) return send(res, 403, { error: 'Active farmer consent is required before sharing this calculation.' });
      const allowedFields = ['requestedAmount','termMonths','annualRatePercent','monthlyEmi','milkVolume14d','milkRate','averageFat','averageSnf','milkReceipts','otherIncome','totalMonthlyIncome','householdExpenses','existingMonthlyEmi','existingLoanBalance','monthlySurplus','thirtyPercentGuide'];
      const calculation = {};
      for (const field of allowedFields) {
        const value = Number(input.calculation?.[field]);
        if (!Number.isFinite(value) || value < 0 || value > 100000000) return send(res, 400, { error: `A valid ${field} is required to share this calculation.` });
        calculation[field] = value;
      }
      const recommendation = { farmerId, purpose: grant.purpose, calculation, analysis: String(input.analysis || '').slice(0, 3000), operatorNote: String(input.operatorNote || '').slice(0, 1000), sharedAt: Date.now(), status: 'Discussion draft · not a loan offer' };
      bankRecommendations.set(farmerId, recommendation);
      return send(res, 200, { ok: true, recommendation });
    } catch { return send(res, 400, { error: 'Could not share the loan calculation.' }); }
  }
  if (req.method === 'POST' && pathname === '/api/bank/revoke') {
    if (!user || user.role !== 'farmer') return send(res, 403, { error: 'The farmer must manage consent from their own account.' });
    bankGrants.delete(user.farmerId);
    const request = bankRequests.get(user.farmerId);
    if (request) bankRequests.set(user.farmerId, { ...request, status: 'revoked', revokedAt: Date.now() });
    return send(res, 200, { granted: false });
  }
  // Milk-bill repayment is the farmer's choice: only their own account can turn it on or off.
  if (req.method === 'POST' && pathname === '/api/bank/repayment-opt-in') {
    if (!user || user.role !== 'farmer') return send(res, 403, { error: 'Only the farmer can change milk-bill repayment from their own account.' });
    const grant = bankGrants.get(user.farmerId);
    if (!grant || grant.expiresAt <= Date.now()) return send(res, 409, { error: 'Approve bank access before choosing milk-bill repayment.' });
    try {
      const { optIn } = await readJson(req);
      grant.repaymentOptIn = optIn === true;
      return send(res, 200, { repaymentOptIn: grant.repaymentOptIn });
    } catch { return send(res, 400, { error: 'Could not update milk-bill repayment.' }); }
  }
  if (req.method === 'POST' && pathname === '/api/bank/decline') {
    if (!user || user.role !== 'farmer') return send(res, 403, { error: 'The farmer must decline from their own account.' });
    const request = bankRequests.get(user.farmerId);
    if (!request || request.status !== 'pending') return send(res, 409, { error: 'There is no pending request to decline.' });
    bankRequests.set(user.farmerId, { ...request, status: 'declined', respondedAt: Date.now() });
    return send(res, 200, { declined: true });
  }
  if (req.method === 'POST' && pathname === '/api/bank/analyze') {
    if (!user || user.role !== 'operator') return send(res, 403, { error: 'Only the Amul operator can request this analysis.' });
    try {
      const input = await readJson(req);
      const farmerId = String(input.farmerId || '');
      const grant = bankGrants.get(farmerId);
      if (!grant || grant.expiresAt <= Date.now()) return send(res, 403, { error: 'Active farmer consent is required before analysis.' });
      const account = accounts.find(item => item.role === 'farmer' && item.farmerId === farmerId);
      if (!account) return send(res, 404, { error: 'Farmer not found.' });
      const consentedProfile = {};
      for (const field of grant.fields) {
        if (Object.hasOwn(account, field)) consentedProfile[field] = account[field];
        else if (Object.hasOwn(grant.farmerProvided || {}, field)) consentedProfile[field] = grant.farmerProvided[field];
      }
      const scenario = {
        requestedAmount: Math.max(0, Number(input.requestedAmount) || 0),
        termMonths: Math.min(60, Math.max(1, Number(input.termMonths) || 1)),
        annualRatePercent: Math.min(60, Math.max(0, Number(input.annualRatePercent) || 0)),
        otherMonthlyObligations: Math.max(0, Number(consentedProfile.existingMonthlyEmi) || 0),
      };
      const payload = {
        purpose: grant.purpose,
        consentedProfile,
        scenario,
        operatorSuggestion: String(input.operatorSuggestion || '').slice(0, 1200),
      };
      if (!process.env.GEMINI_API_KEY) {
        const monthlyMilkIncome = grant.fields.includes('litres') && grant.fields.includes('rate')
          ? Number(consentedProfile.litres) * Number(consentedProfile.rate) * 2 : null;
        const monthlyEmi = scenario.requestedAmount === 0 ? 0 : scenario.annualRatePercent === 0
          ? scenario.requestedAmount / scenario.termMonths
          : scenario.requestedAmount * (scenario.annualRatePercent / 1200) * Math.pow(1 + scenario.annualRatePercent / 1200, scenario.termMonths) / (Math.pow(1 + scenario.annualRatePercent / 1200, scenario.termMonths) - 1);
        const totalMonthlyIncome = (monthlyMilkIncome || 0) + Number(consentedProfile.otherMonthlyIncome || 0);
        const monthlySurplus = totalMonthlyIncome - Number(consentedProfile.householdExpenses || 0) - Number(consentedProfile.existingMonthlyEmi || 0) - monthlyEmi;
        const context = monthlyMilkIncome == null ? 'This consent scope does not include both volume and rate, so monthly milk receipts were not estimated.'
          : `Synthetic consented data estimates monthly milk receipts of ₹${Math.round(monthlyMilkIncome).toLocaleString('en-IN')}, other income of ₹${Math.round(Number(consentedProfile.otherMonthlyIncome || 0)).toLocaleString('en-IN')}, household expenses of ₹${Math.round(Number(consentedProfile.householdExpenses || 0)).toLocaleString('en-IN')}, existing loan payments of ₹${Math.round(Number(consentedProfile.existingMonthlyEmi || 0)).toLocaleString('en-IN')}, and an outstanding balance of ₹${Math.round(Number(consentedProfile.existingLoanBalance || 0)).toLocaleString('en-IN')}. After the illustrative new EMI, estimated monthly remainder is ₹${Math.round(monthlySurplus).toLocaleString('en-IN')}; this is not verified disposable income or a lending decision.`;
        const text = `${context} The entered scenario has an illustrative EMI of ₹${Math.round(monthlyEmi).toLocaleString('en-IN')} per month over ${scenario.termMonths} months. Confirm household expenses, seasonal variation, other debts, and the farmer’s preferred installment directly. ${payload.operatorSuggestion ? `Operator note: ${payload.operatorSuggestion}` : ''} This preview is rule-based because Gemini is not configured; it is not a credit decision or offer.`;
        return send(res, 200, { configured: false, fallback: true, text });
      }
      const result = await callGemini(process.env.GEMINI_TEXT_MODEL || 'gemini-3.8-flash', {
        input: FARMER_ANALYSIS_PROMPT + JSON.stringify(payload),
        system_instruction: FARMER_ANALYSIS_SYSTEM,
        generation_config: { max_output_tokens: 700, thinking_level: 'low' },
      });
      const text = result.output_text || result.steps?.flatMap(step => step.content || []).filter(block => block.type === 'text').map(block => block.text).join('\n');
      return send(res, 200, { configured: true, text: String(text || '').trim() });
    } catch (error) {
      console.error('Farmer analysis failed:', error.message);
      return send(res, 502, { error: 'The analysis could not be completed. Try again.' });
    }
  }
  if (req.method === 'POST' && pathname === '/api/gemini') {
    if (!user) return send(res, 401, { error: 'Sign in required.' });
    if (user.role !== 'operator') return send(res, 403, { error: 'Only the Amul operator can use this prototype tool.' });
    try {
      const input = await readJson(req);
      const key = process.env.GEMINI_API_KEY;
      if (!key) {
        const fallback = input.task === 'chat'
          ? 'Before suggesting a repayment plan, ask the farmer about other monthly loan payments, essential household spending, seasonal income, and their preferred installment. Then compare a smaller principal or longer term. This is an illustration only; the farmer and lender decide.'
          : 'Gemini is not configured yet. This local demo returned a sample; set GEMINI_API_KEY on the server to generate with Gemini.';
        return send(res, 200, { configured: false, fallback: true, text: fallback });
      }
      if (input.task === 'audio') {
        const text = String(input.text || '').trim().slice(0, 2500);
        if (!text) return send(res, 400, { error: 'Enter a message before generating audio.' });
        const result = await callGemini(process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts', {
          input: [{ type: 'user_input', content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style: `Warm, clear, natural ${input.language === 'hi' ? 'Hindi' : input.language === 'en' ? 'English' : 'Gujarati'} cooperative announcement` }] }] }],
          response_format: { type: 'audio' }, generation_config: { speech_config: [{ voice: 'Kore' }] }
        });
        const audio = result.output_audio?.data || result.steps?.flatMap(step => step.content || []).find(block => block.type === 'audio')?.data;
        if (!audio) throw new Error('Audio was not returned');
        return send(res, 200, { configured: true, audio, mimeType: 'audio/wav' });
      }
      let inputText, system;
      if (input.task === 'translate') {
        const targetName = TRANSLATION_LANGUAGES[input.targetLanguage];
        if (!targetName) return send(res, 400, { error: 'Choose Hindi, Gujarati, or English.' });
        const sourceText = String(input.text || '').trim().slice(0, 2500);
        if (!sourceText) return send(res, 400, { error: 'Enter a message before translating.' });
        inputText = `Translate the following cooperative farmer message into ${targetName}${targetName === 'English' ? '' : ` using ${targetName === 'Gujarati' ? 'Gujarati' : 'Devanagari'} script only; do not leave English words untranslated except personal names and product brand names`}. Use simple words a village dairy farmer would use. Preserve meaning, tone, uncertainty, figures, line breaks, and named programs. Do not add, omit, or promise benefits. Return only the translation.\n\n${sourceText}`;
        system = 'You are a careful translator for cooperative member messages. Translate faithfully and use clear, plain language. Do not provide commentary.';
      } else if (input.task === 'message') {
        inputText = `Forecast (planning signal, not a promise): ${String(input.forecast || '').slice(0, 1200)}\nOperator request: ${String(input.prompt || '').slice(0, 1200)}\nWrite a short, plain-language farmer message in ${input.language === 'Hindi' ? 'Hindi' : input.language === 'English' ? 'English' : 'Gujarati'}. Do not invent schemes, rates, quotas, loan terms, income, guarantees, or instructions. If scheme specifics are missing, say to contact the society. Keep the meaning cautious and suitable for a cooperative member.`;
        system = 'You draft farmer-facing cooperative updates. Preserve uncertainty. Never imply forecasts are guaranteed, and never make or suggest loan eligibility or prices. Return only the message text.';
      } else if (input.task === 'collection_review') {
        const calculation = JSON.stringify(input.calculation || {}).slice(0, 3000);
        inputText = `Review this locally calculated, illustrative milk collection incentive plan. Check arithmetic and internal consistency. The member collection values and recipes are synthetic/assumption-based, so do not present them as verified operational data. Do not invent missing facts or silently replace values. Return JSON only with this shape: {"summary":"brief calculation check and limitations","changes":[{"field":"field name","current":"value","suggested":"value","reason":"why this correction or alternative is suggested"}]}. Include only genuine arithmetic corrections or clearly labeled optional alternatives; if none, return an empty changes array. Treat fat/SNF thresholds, incentive rate and capacity as unapproved draft assumptions. No approval or farmer communication.\n\nCalculation: ${calculation}`;
        system = 'You are a cautious arithmetic reviewer for a cooperative planning prototype. Verify calculations transparently. Never claim the plan is operationally validated, never approve an incentive, and never infer missing supply, stock, capacity, quality specifications or policy. Output valid JSON only.';
      } else if (input.task === 'chat') {
        const farmerId = String(input.farmerId || '');
        const grant = bankGrants.get(farmerId);
        if (!grant || grant.expiresAt <= Date.now()) return send(res, 403, { error: 'Active farmer consent is required for bank chat.' });
        const account = accounts.find(item => item.role === 'farmer' && item.farmerId === farmerId);
        if (!account) return send(res, 404, { error: 'Farmer not found.' });
        const scopedProfile = { purpose: grant.purpose };
        for (const field of grant.fields) scopedProfile[field] = account[field];
        inputText = `Farmer data allowed by the active consent only: ${JSON.stringify(scopedProfile)}\nOperator-entered loan scenario (unverified): ${JSON.stringify(input.scenario || {}).slice(0, 800)}\nRecent conversation: ${JSON.stringify(input.history || []).slice(-2500)}\nLatest operator question: ${String(input.question || '').slice(0, 1200)}\nGive a concise, empathetic follow-up or cautious illustration suggestion. Ask about missing essentials rather than assume them. Do not decide eligibility, approve/decline credit, or promise terms. Encourage the farmer to compare options and choose freely.`;
        system = FARMER_ANALYSIS_SYSTEM;
      } else return send(res, 400, { error: 'Unknown Gemini task.' });
      // Translations need room for long Gujarati/Hindi output after the model's thinking tokens.
      const result = await callGemini(process.env.GEMINI_TEXT_MODEL || 'gemini-3.8-flash', { input: inputText, system_instruction: system, generation_config: { max_output_tokens: input.task === 'translate' ? 4000 : 500, thinking_level: 'low' } });
      const text = result.output_text || result.steps?.flatMap(step => step.content || []).filter(block => block.type === 'text').map(block => block.text).join('\n');
      if (input.task === 'translate') {
        if (!String(text || '').trim()) throw new Error('Gemini returned no translation');
        return send(res, 200, { configured: true, text: String(text).trim(), language: input.targetLanguage });
      }
      if (input.task === 'collection_review') {
        const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        let review;
        try { review = JSON.parse(raw); } catch { throw new Error('Gemini returned an unreadable calculation review'); }
        if (!review || typeof review.summary !== 'string' || !Array.isArray(review.changes)) throw new Error('Gemini returned an invalid review structure');
        review.changes = review.changes.slice(0, 8).map(change => ({ field: String(change.field || '').slice(0, 100), current: String(change.current ?? '').slice(0, 100), suggested: String(change.suggested ?? '').slice(0, 100), reason: String(change.reason || '').slice(0, 300) }));
        return send(res, 200, { configured: true, review: { summary: review.summary.slice(0, 700), changes: review.changes } });
      }
      return send(res, 200, { configured: true, text: String(text || '').trim() });
    } catch (error) {
      console.error('Gemini request failed:', error.message);
      return send(res, 502, { error: 'Gemini could not complete the request. Check server configuration and try again.' });
    }
  }
  if (req.method === 'POST' && pathname === '/api/pipeline/inspect') {
    if (!user || user.role !== 'operator') return send(res, 403, { error: 'Only the Amul operator can inspect pipeline workbooks.' });
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    if (!contentType.includes('spreadsheetml.sheet') && !contentType.includes('application/vnd.openxmlformats-officedocument')) return send(res, 415, { error: 'Choose an .xlsx workbook to inspect.' });
    let tempFile;
    try {
      const bytes = await readWorkbook(req);
      if (bytes.length < 100) return send(res, 400, { error: 'The uploaded workbook is empty or invalid.' });
      const digest = crypto.createHash('sha256').update(bytes).digest('hex');
      return send(res, 200, await cachedResult(`inspect-${digest}`, async () => {
        tempFile = path.join(os.tmpdir(), `amul-pipeline-${crypto.randomBytes(12).toString('hex')}.xlsx`);
        await fs.promises.writeFile(tempFile, bytes, { flag: 'wx' });
        return runPipelineInspection(tempFile);
      }));
    } catch (error) {
      const status = error.message.includes('12 MB') ? 413 : 422;
      return send(res, status, { error: error.message || 'Workbook inspection failed.' });
    } finally {
      if (tempFile) await fs.promises.unlink(tempFile).catch(() => {});
    }
  }
  if (req.method === 'POST' && pathname === '/api/forecast') {
    if (!user || user.role !== 'operator') return send(res, 403, { error: 'Only the Amul operator can run demand forecasts.' });
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    if (!contentType.includes('spreadsheetml.sheet') && !contentType.includes('application/vnd.openxmlformats-officedocument')) return send(res, 415, { error: 'Choose an .xlsx workbook to forecast.' });
    let tempFile;
    try {
      const bytes = await readWorkbook(req);
      if (bytes.length < 100) return send(res, 400, { error: 'The uploaded workbook is empty or invalid.' });
      const url = new URL(req.url, 'http://localhost');
      const scenario = {
        heatwave: url.searchParams.get('heatwave') === 'true',
        festival: url.searchParams.get('festival') === 'true',
        promotion: url.searchParams.get('promotion') === 'true',
      };
      const digest = crypto.createHash('sha256').update(bytes).digest('hex');
      const result = await cachedResult(`forecast-${digest}-${scenarioTag(scenario)}`, async () => {
        tempFile = path.join(os.tmpdir(), `amul-forecast-${crypto.randomBytes(12).toString('hex')}.xlsx`);
        await fs.promises.writeFile(tempFile, bytes, { flag: 'wx' });
        return runForecast(tempFile, scenario);
      });
      return send(res, 200, result);
    } catch (error) {
      const status = error.message.includes('12 MB') ? 413 : 422;
      return send(res, status, { error: error.message || 'Forecast failed. Check the workbook format and try again.' });
    } finally {
      if (tempFile) await fs.promises.unlink(tempFile).catch(() => {});
    }
  }
  if (req.method === 'GET' && pathname === '/api/session') {
    if (!user) return send(res, 401, { error: 'Sign in required.' });
    const payload = publicUser(user);
    if (user.role === 'operator') payload.farmers = accounts.filter(a => a.role === 'farmer').map(({ farmerId, name, society }) => ({ farmerId, name, society }));
    if (user.role === 'farmer') payload.passbook = farmerPassbook(user);
    return send(res, 200, payload);
  }
  if (!user) {
    if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) return send(res, 200, loginPage, 'text/html; charset=utf-8');
    return send(res, 401, 'Sign in required.', 'text/plain; charset=utf-8');
  }
  if (user.role === 'farmer' && pathname.startsWith('/api/')) return send(res, 403, { error: 'Farmers can only access their own farmer module.' });
  if (req.method !== 'GET') return send(res, 405, 'Method not allowed', 'text/plain; charset=utf-8');
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  if (relative.split(/[\\/]+/).some(segment => /^\.env(?:\.|$)/i.test(segment))) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
  if (relative === '.python-deps' || relative.startsWith(`.python-deps${path.sep}`)) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
  const file = path.resolve(root, relative);
  if (file !== root && !file.startsWith(root + path.sep)) return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    fs.createReadStream(file).pipe(res);
  });
}).listen(port, host, () => {
  console.log(`DoorDarshi by Amul is running at http://${host}:${port}`);
  console.log(`Gemini integration: ${process.env.GEMINI_API_KEY ? 'configured' : 'demo mode · key not found'}`);
  console.log('Accounts are managed for this workspace. Press Ctrl+C to stop.');
});
