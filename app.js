/**
 * Wealth Tracker - Core Script Architecture Engine
 * Handles State Management, Inter-component balancing, Charting APIs & Security locks
 */

// ==========================================================================
// STATE ENGINE DATA DECLARATIONS
// ==========================================================================
const LS = 'wt_v3';
const PIN_KEY = 'wt_pin';
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const INC_SRC = ['Salary','Business','Freelance','Rental Income','Dividends','Interest','Gift','Bonus','Side Hustle','Other'];
const EXP_CAT = ['Food','Travel','Shopping','Health','Bills','Education','Entertainment','Fuel','EMI','Others'];
const CLRS = ['#f97316','#3b82f6','#a855f7','#22c55e','#eab308','#ec4899','#14b8a6','#f43f5e','#6366f1','#84cc16'];

let DB = { accounts: [], assets: [], debts: [], transactions: [] };
let curPage = 'dash';
let charts = {};
let pBuffer = '';

// Date Picker State Configurations
let sD = new Date().getDate();
let sM = new Date().getMonth() + 1;
let sY = new Date().getFullYear();

// Navigation Structural Objects
const PAGES = [
  { id: 'dash', lbl: 'Dashboard', ico: '🏠' },
  { id: 'acc',  lbl: 'Accounts',  ico: '🏦' },
  { id: 'ast',  lbl: 'Assets',    ico: '📦' },
  { id: 'dbt',  lbl: 'Debts',     ico: '💳' },
  { id: 'rep',  lbl: 'Reports',   ico: '📊' }
];

// ==========================================================================
// LOCAL STORAGE ENGINE PORTS
// ==========================================================================
function loadDB() {
  const stored = localStorage.getItem(LS);
  if (stored) {
    try {
      DB = JSON.parse(stored);
    } catch (e) {
      console.error("Local Database parse fault. Reseting safely.", e);
    }
  }
}

function saveDB() {
  try {
    localStorage.setItem(LS, JSON.stringify(DB));
  } catch (e) {
    toast('⚠️ Storage limits full! Please export data.');
  }
}

function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function seedDemo() {
  const td = todayStr();
  DB = {
    accounts: [
      { id: 1, name: 'Cash', balance: 10000 },
      { id: 2, name: 'SBI Bank', balance: 25000 },
      { id: 3, name: 'HDFC Bank', balance: 15000 }
    ],
    assets: [
      { id: 1, name: 'Gold', value: 50000 },
      { id: 2, name: 'Stocks', value: 20000 },
      { id: 3, name: 'Mutual Funds', value: 15000 }
    ],
    debts: [
      { id: 1, lender: 'Friend', amount: 5000, note: 'Borrowed for travel' }
    ],
    transactions: [
      { id: 1, date: td, type: 'income', amount: 25000, source: 'Salary', category: '', account: 'SBI Bank', note: 'Monthly' },
      { id: 2, date: td, type: 'income', amount: 5000, source: 'Freelance', category: '', account: 'Cash', note: 'Project' },
      { id: 3, date: td, type: 'expense', amount: 300, source: '', category: 'Food', account: 'Cash', note: 'Lunch' },
      { id: 4, date: td, type: 'expense', amount: 500, source: '', category: 'Shopping', account: 'HDFC Bank', note: '' }
    ]
  };
  saveDB();
}

// ==========================================================================
// FORMULAS & CALCULATION LOGIC
// ==========================================================================
function todayStr() { return new Date().toISOString().split('T')[0]; }
function nextId(arr) { return arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1; }
function dim(y, m) { return new Date(y, m, 0).getDate(); }
function fmt(n) { return '₹' + Math.abs(Number(n) || 0).toLocaleString('en-IN'); }

function calcAccounts() { return DB.accounts.reduce((s, a) => s + Number(a.balance), 0); }
function calcAssets() { return DB.assets.reduce((s, a) => s + Number(a.value), 0); }
function calcDebt() { return DB.debts.reduce((s, d) => s + Number(d.amount), 0); }
function calcWealth() { return calcAssets() + calcAccounts() - calcDebt(); }

function calcDay(dateStr) {
  const txns = DB.transactions.filter(x => x.date === dateStr);
  const inc = txns.filter(x => x.type === 'income').reduce((s, x) => s + Number(x.amount), 0);
  const exp = txns.filter(x => x.type === 'expense').reduce((s, x) => s + Number(x.amount), 0);
  return { txns, inc, exp, sav: inc - exp };
}

function calcMonth(year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const txns = DB.transactions.filter(x => x.date.startsWith(prefix));
  const inc = txns.filter(x => x.type === 'income').reduce((s, x) => s + Number(x.amount), 0);
  const exp = txns.filter(x => x.type === 'expense').reduce((s, x) => s + Number(x.amount), 0);
  return { inc, exp, sav: inc - exp };
}

function calcTrend7() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    const ds = d.toISOString().split('T')[0];
    const { inc, exp } = calcDay(ds);
    return {
      lbl: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      inc,
      exp
    };
  });
}

// ==========================================================================
// CHRONO SELECTOR PIPELINES
// ==========================================================================
function selDate() {
  return `${sY}-${String(sM).padStart(2, '0')}-${String(sD).padStart(2, '0')}`;
}

window.cd = function(part, delta) {
  if (part === 'd') {
    sD += delta;
    const maxDays = dim(sY, sM);
    if (sD < 1) sD = maxDays;
    if (sD > maxDays) sD = 1;
  } else if (part === 'm') {
    sM += delta;
    if (sM < 1) { sM = 12; sY--; }
    if (sM > 12) { sM = 1; sY++; }
    sD = Math.min(sD, dim(sY, sM));
  } else {
    sY += delta;
    sD = Math.min(sD, dim(sY, sM));
  }
  renderWheel();
  renderPage();
};

function renderWheel() {
  const maxDays = dim(sY, sM);
  const prevDay = sD > 1 ? sD - 1 : maxDays;
  const nextDay = sD < maxDays ? sD + 1 : 1;
  
  const prevMonth = sM > 1 ? sM - 1 : 12;
  const nextMonth = sM < 12 ? sM + 1 : 1;

  function setWheelHTML(id, prev, current, next) {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = `
        <div class="witem sd">${prev}</div>
        <div class="witem on">${current}</div>
        <div class="witem sd">${next}</div>
      `;
    }
  }

  setWheelHTML('wiD', String(prevDay).padStart(2, '0'), String(sD).padStart(2, '0'), String(nextDay).padStart(2, '0'));
  setWheelHTML('wiM', MONTHS[prevMonth - 1], MONTHS[sM - 1], MONTHS[nextMonth - 1]);
  setWheelHTML('wiY', sY - 1, sY, sY + 1);
}

// ==========================================================================
// DESK SWITCHERS & ROUTING INTERFACES
// ==========================================================================
window.goPage = function(pageId) {
  curPage = pageId;
  renderNav();
  renderPage();
};

function renderNav() {
  const nav = document.getElementById('bnav');
  if (!nav) return;
  nav.innerHTML = PAGES.map(p => `
    <button class="nb${p.id === curPage ? ' on' : ''}" onclick="goPage('${p.id}')">
      <span class="ni">${p.ico}</span>${p.lbl}
    </button>
  `).join('');
}

function clearChartSpace(id) {
  if (charts[id]) {
    charts[id].destroy();
    delete charts[id];
  }
}

function renderPage() {
  // Update Persistent Global Summary Metric Indicators
  const hNW = document.getElementById('hNW');
  const hDbt = document.getElementById('hDbt');
  if (hNW) hNW.textContent = fmt(calcWealth());
  if (hDbt) hDbt.textContent = fmt(calcDebt());

  const container = document.getElementById('cont');
  if (!container) return;

  const routes = {
    dash: viewDashboard,
    acc: viewAccounts,
    ast: viewAssets,
    dbt: viewDebts,
    rep: viewReports,
    settings: viewSettings
  };

  container.innerHTML = (routes[curPage] || viewDashboard)();
  
  // Safe layout callback execution hooks to prevent canvas rendering race scenarios
  setTimeout(drawCharts, 60);
}

// ==========================================================================
// VIEW RENDERING PATTERNS
// ==========================================================================
function viewDashboard() {
  const activeDate = selDate();
  const { txns, inc, exp, sav } = calcDay(activeDate);
  const catMap = {}, srcMap = {};

  txns.forEach(t => {
    if (t.type === 'expense') catMap[t.category] = (catMap[t.category] || 0) + Number(t.amount);
    else srcMap[t.source] = (srcMap[t.source] || 0) + Number(t.amount);
  });

  const categories = Object.entries(catMap);
  const sources = Object.entries(srcMap);

  let viewStr = `
    <div class="sgrid">
      <div class="sb"><div class="sl">INCOME</div><div class="sv" style="color:var(--inc)">${fmt(inc)}</div></div>
      <div class="sb"><div class="sl">SPENDING</div><div class="sv" style="color:var(--exp)">${fmt(exp)}</div></div>
      <div class="sb"><div class="sl">SAVINGS</div><div class="sv" style="color:${sav >= 0 ? 'var(--sav)' : 'var(--exp)'}">${fmt(sav)}</div></div>
    </div>
    <div class="card"><div class="ct">📈 7-Day Trend</div><div class="chart-wrap"><canvas id="cTr"></canvas></div></div>
  `;

  if (sources.length) {
    viewStr += `<div class="card"><div class="ch"><span class="ct">💼 Daily Income Inflows</span></div>`;
    sources.forEach(([src, amt]) => {
      viewStr += `<div class="li"><div class="lt">${src}</div><span class="lv" style="color:var(--inc)">+${fmt(amt)}</span></div>`;
    });
    viewStr += `</div>`;
  }

  if (categories.length) {
    viewStr += `
      <div class="card">
        <div class="ct">🍕 Spending by Category</div>
        <div style="display:flex;align-items:center;gap:16px;margin-top:8px">
          <canvas id="cPie" style="max-width:110px;max-height:110px"></canvas>
          <div style="flex:1">
    `;
    categories.forEach(([cat, amt], idx) => {
      const currentColor = CLRS[EXP_CAT.indexOf(cat)] || CLRS[idx % 10];
      viewStr += `
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px;align-items:center">
          <span><span style="color:${currentColor};margin-right:5px">●</span>${cat}</span>
          <strong>${fmt(amt)}</strong>
        </div>`;
    });
    viewStr += `</div></div></div>`;
  }

  viewStr += `
    <div class="card">
      <div class="ch"><span class="ct">📋 Log Sheets</span><button class="addbtn" onclick="openModal('txn')">+ Add</button></div>
  `;
  
  if (!txns.length) {
    viewStr += `<div class="empty">No entries logged for this date — tap + Add</div>`;
  } else {
    ([...txns]).reverse().forEach(t => {
      const clr = t.type === 'income' ? 'var(--inc)' : 'var(--exp)';
      viewStr += `
        <div class="li">
          <div>
            <div class="lt">${t.type === 'income' ? t.source : t.category}</div>
            <span class="badge ${t.type === 'income' ? 'bi' : 'be'}">${t.type === 'income' ? 'Income' : 'Expense'} · ${t.account}</span>
            ${t.note ? `<div class="ls">${t.note}</div>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <span class="lv" style="color:${clr}">${t.type === 'income' ? '+' : '-'}${fmt(t.amount)}</span>
            <button class="delbtn" onclick="delTxn(${t.id})">×</button>
          </div>
        </div>`;
    });
  }
  
  return viewStr + `</div>`;
}

function viewAccounts() {
  let h = `
    <div class="card">
      <div class="ch"><span class="ct">🏦 Liquid Asset Accounts</span><button class="addbtn" onclick="openModal('account')">+ Add</button></div>
      <div class="tbox" style="background:#f0fdf4"><div class="tl" style="color:var(--inc)">TOTAL LIQUID BALANCE</div><div class="tv" style="color:var(--inc)">${fmt(calcAccounts())}</div></div>
  `;
  if (!DB.accounts.length) h += `<div class="empty">No active accounts listed</div>`;
  DB.accounts.forEach(a => {
    h += `<div class="li"><div><div class="lt">${a.name}</div></div><div style="display:flex;align-items:center;gap:8px"><span class="lv" style="color:var(--inc)">${fmt(a.balance)}</span><button class="delbtn" onclick="delItem('accounts',${a.id})">×</button></div></div>`;
  });
  return h + `</div>`;
}

function viewAssets() {
  let h = `
    <div class="card">
      <div class="ch"><span class="ct">📦 Sunk Assets Portfolio</span><button class="addbtn" onclick="openModal('asset')">+ Add</button></div>
      <div class="tbox" style="background:#faf5ff"><div class="tl" style="color:var(--sec)">TOTAL PORTFOLIO ASSETS</div><div class="tv" style="color:var(--sec)">${fmt(calcAssets())}</div></div>
  `;
  if (!DB.assets.length) h += `<div class="empty">No custom portfolio configurations detected</div>`;
  DB.assets.forEach(a => {
    h += `<div class="li"><div><div class="lt">${a.name}</div></div><div style="display:flex;align-items:center;gap:8px"><span class="lv" style="color:var(--sec)">${fmt(a.value)}</span><button class="delbtn" onclick="delItem('assets',${a.id})">×</button></div></div>`;
  });
  return h + `</div>`;
}

function viewDebts() {
  let h = `
    <div class="card">
      <div class="ch"><span class="ct">💳 Liability & Debt Ledgers</span><button class="addbtn red" onclick="openModal('debt')">+ Add</button></div>
      <div class="tbox" style="background:#fff1f2"><div class="tl" style="color:var(--exp)">TOTAL OUTSTANDING DEBT</div><div class="tv" style="color:var(--exp)">${fmt(calcDebt())}</div></div>
  `;
  if (!DB.debts.length) h += `<div class="empty">No debts recorded! 🎉</div>`;
  DB.debts.forEach(d => {
    h += `<div class="li"><div><div class="lt">${d.lender}</div>${d.note ? `<div class="ls">${d.note}</div>` : ''}</div><div style="display:flex;align-items:center;gap:8px"><span class="lv" style="color:var(--exp)">${fmt(d.amount)}</span><button class="delbtn" onclick="delItem('debts',${d.id})">×</button></div></div>`;
  });
  return h + `</div>`;
}

function viewReports() {
  const current = new Date();
  const { inc: mi, exp: me, sav: ms } = calcMonth(current.getFullYear(), current.getMonth() + 1);
  return `
    <div class="formula">
      <div style="font-size:11px;font-weight:700;opacity:0.8;letter-spacing:0.3px">METRIC RULE: WEALTH = ASSETS + ACCOUNTS − DEBT</div>
      <div class="feq">${fmt(calcAssets())} + ${fmt(calcAccounts())} − ${fmt(calcDebt())}</div>
      <div class="fres">= ${fmt(calcWealth())}</div>
    </div>
    <div class="card"><div class="ct" style="margin-bottom:8px">📅 Month Tracker Overview</div>
      <div class="sgrid">
        <div class="sb"><div class="sl">INFLOW</div><div class="sv" style="color:var(--inc)">${fmt(mi)}</div></div>
        <div class="sb"><div class="sl">OUTFLOW</div><div class="sv" style="color:var(--exp)">${fmt(me)}</div></div>
        <div class="sb"><div class="sl">NET MARGIN</div><div class="sv" style="color:${ms >= 0 ? 'var(--sav)' : 'var(--exp)'}">${fmt(ms)}</div></div>
      </div>
      <div class="chart-wrap"><canvas id="cMo"></canvas></div>
    </div>
    <div class="card"><div class="ct">💼 Total Asset Allocations Matrix</div><div class="chart-wrap"><canvas id="cPo"></canvas></div></div>
    <div class="card"><div class="ch"><span class="ct">📋 Global Transaction History</span></div>
      ${!DB.transactions.length ? '<div class="empty">Database transaction space empty.</div>' : ''}
      ${([...DB.transactions]).reverse().map(t => `
        <div class="li">
          <div>
            <div class="lt">${t.type === 'income' ? t.source : t.category}</div>
            <div class="ls">${t.date} · ${t.account}</div>
          </div>
          <span class="lv" style="color:${t.type === 'income' ? 'var(--inc)' : 'var(--exp)'}">${t.type === 'income' ? '+' : '-'}${fmt(t.amount)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function viewSettings() {
  const securityActive = localStorage.getItem(PIN_KEY);
  return `
    <div class="set-lbl">📊 ACCOUNT INTEGRITY DATA SUMMARY</div>
    <div class="scard">
      <div class="st">💾 Local Storage Matrices</div>
      <div class="ss">Ledgers: <strong>${DB.transactions.length}</strong> &nbsp;·&nbsp; Accounts: <strong>${DB.accounts.length}</strong> &nbsp;·&nbsp; Assets: <strong>${DB.assets.length}</strong> &nbsp;·&nbsp; Debts: <strong>${DB.debts.length}</strong></div>
    </div>
    <div class="set-lbl">🔐 CRYPTO SYSTEM INTEGRITY SECURITY</div>
    <div class="scard">
      <div class="st"><span class="sdot ${securityActive ? 'ok' : 'warn'}"></span>Screen Unlock Key: ${securityActive ? 'Configured ✅' : 'Unprotected'}</div>
      <div class="ss">Prompts for authentication on start-up.</div>
      <button class="addbtn" style="margin-top:10px" onclick="openModal('pin')">${securityActive ? 'Modify Lock PIN' : 'Configure Lock PIN'}</button>
      ${securityActive ? `<button class="addbtn red" style="margin-top:8px;margin-left:8px" onclick="removePin()">Deactivate Lock</button>` : ''}
    </div>
    <div class="set-lbl">💾 CLOUD SEED SYSTEM PORT BACKUPS</div>
    <div class="scard">
      <div class="st">Export Data Payload</div>
      <div class="ss">Compile and pull structural data packages to standard readable JSON flatfile formats.</div>
      <button class="addbtn" style="margin-top:10px" onclick="exportData()">⬇️ Export Database JSON</button>
    </div>
    <div class="scard">
      <div class="st">Import Ledger Stream</div>
      <div class="ss">Parse valid outside engine configurations back inside Local Storage nodes.</div>
      <input type="file" id="impFile" accept=".json" style="display:none" onchange="importData(event)"/>
      <button class="addbtn" style="margin-top:10px" onclick="document.getElementById('impFile').click()">⬆ extinction Import JSON</button>
    </div>
    <div class="set-lbl">⚠️ HARD ERASE DESTRUCTION SUITE</div>
    <div class="scard">
      <div class="st" style="color:var(--exp)">Wipe Hardware Engine Spaces</div>
      <div class="ss">Irreversible execution. Erases variables and clear system security modules.</div>
      <button class="addbtn red" style="margin-top:10px" onclick="clearAll()">🗑️ Drop Local Database</button>
    </div>
  `;
}

// ==========================================================================
// CHART INTEGRATION SYSTEM (CHART.JS INTERFACING)
// ==========================================================================
function drawCharts() {
  const cTr = document.getElementById('cTr');
  if (cTr) {
    clearChartSpace('tr');
    const dataset = calcTrend7();
    charts.tr = new Chart(cTr, {
      type: 'line',
      data: {
        labels: dataset.map(x => x.lbl),
        datasets: [
          { label: 'Income', data: dataset.map(x => x.inc), borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,.06)', tension: 0.38, fill: true, pointRadius: 3 },
          { label: 'Expense', data: dataset.map(x => x.exp), borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,.05)', tension: 0.38, fill: true, pointRadius: 3 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { font: { size: 10 }, boxWidth: 12 } } },
        scales: { y: { ticks: { font: { size: 9 }, callback: val => '₹' + val }, grid: { color: '#f1f5f9' } }, x: { ticks: { font: { size: 9 } }, grid: { display: false } } }
      }
    });
  }

  const cPie = document.getElementById('cPie');
  if (cPie) {
    clearChartSpace('pi');
    const distributionMap = {};
    DB.transactions
      .filter(t => t.date === selDate() && t.type === 'expense')
      .forEach(t => { distributionMap[t.category] = (distributionMap[t.category] || 0) + Number(t.amount); });
    
    const elements = Object.entries(distributionMap);
    if (elements.length) {
      charts.pi = new Chart(cPie, {
        type: 'doughnut',
        data: {
          labels: elements.map(x => x[0]),
          datasets: [{
            data: elements.map(x => x[1]),
            backgroundColor: elements.map((_, i) => CLRS[EXP_CAT.indexOf(elements[i][0])] || CLRS[i % 10]),
            borderWidth: 1.5
          }]
        },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, cutout: '65%' }
      });
    }
  }

  const cMo = document.getElementById('cMo');
  if (cMo) {
    clearChartSpace('mo');
    const now = new Date();
    const timelineData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const { inc, exp } = calcMonth(d.getFullYear(), d.getMonth() + 1);
      timelineData.push({ monthName: MONTHS[d.getMonth()], inc, exp });
    }
    charts.mo = new Chart(cMo, {
      type: 'bar',
      data: {
        labels: timelineData.map(m => m.monthName),
        datasets: [
          { label: 'Income', data: timelineData.map(m => m.inc), backgroundColor: 'rgba(22,163,74,.85)', borderRadius: 4 },
          { label: 'Expense', data: timelineData.map(m => m.exp), backgroundColor: 'rgba(220,38,38,.85)', borderRadius: 4 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { font: { size: 10 }, boxWidth: 12 } } },
        scales: { y: { ticks: { font: { size: 9 }, callback: val => '₹' + val / 1000 + 'k' } }, x: { ticks: { font: { size: 9 } } } }
      }
    });
  }

  const cPo = document.getElementById('cPo');
  if (cPo) {
    clearChartSpace('po');
    charts.po = new Chart(cPo, {
      type: 'bar',
      data: {
        labels: ['Accounts Balance', 'Sunk Assets', 'Liabilities'],
        datasets: [{
          data: [calcAccounts(), calcAssets(), calcDebt()],
          backgroundColor: ['rgba(22,163,74,.8)', 'rgba(124,58,237,.8)', 'rgba(220,38,38,.8)'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { ticks: { font: { size: 9 }, callback: val => '₹' + val / 1000 + 'k' } }, x: { ticks: { font: { size: 10 } } } }
      }
    });
  }
}

// ==========================================================================
// MODAL SHEET DOM INTERRUPT CONTROL SCHEMES
// ==========================================================================
let mType = null;

window.openModal = function(type) {
  mType = type;
  const titles = { txn: 'Add Transaction Entry', account: 'Provision Liquid Account', asset: 'Provision Sunk Asset', debt: 'Log Liability Debt Balance', pin: 'Set Secure Access Screen PIN' };
  
  const mTitleEl = document.getElementById('mTitle');
  const mBodyEl = document.getElementById('mBody');
  const overlayEl = document.getElementById('overlay');

  if (mTitleEl) mTitleEl.textContent = titles[type] || 'Add Metric';
  if (mBodyEl) mBodyEl.innerHTML = buildForm(type);
  if (overlayEl) overlayEl.classList.add('open');
};

window.closeModal = function(e) {
  if (e && e.target !== document.getElementById('overlay')) return;
  const overlayEl = document.getElementById('overlay');
  if (overlayEl) overlayEl.classList.remove('open');
};

function g(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

window.tTF = function() {
  const selectVal = document.getElementById('ft').value;
  document.getElementById('fsw').style.display = selectVal === 'income' ? 'block' : 'none';
  document.getElementById('fcw').style.display = selectVal === 'expense' ? 'block' : 'none';
};

function buildForm(type) {
  const sOptions = INC_SRC.map(s => `<option>${s}</option>`).join('');
  const cOptions = EXP_CAT.map(c => `<option>${c}</option>`).join('');
  const aOptions = DB.accounts.map(a => `<option>${a.name}</option>`).join('');

  if (type === 'txn') return `
    <div class="fld"><label>Transaction Flow Type</label><select id="ft" onchange="tTF()"><option value="income">Income (Inflow)</option><option value="expense">Expense (Outflow)</option></select></div>
    <div id="fsw" class="fld"><label>Inflow Source</label><select id="fs">${sOptions}</select></div>
    <div id="fcw" class="fld" style="display:none"><label>Outflow Category</label><select id="fc">${cOptions}</select></div>
    <div class="fld"><label>Amount (₹)</label><input type="number" id="fa" placeholder="0.00" min="0" inputmode="numeric"/></div>
    <div class="fld"><label>Target Account Linkage</label><select id="fac">${aOptions}</select></div>
    <div class="fld"><label>Logging Date Target</label><input type="date" id="fd" value="${selDate()}"/></div>
    <div class="fld"><label>Reference Notes</label><input type="text" id="fn" placeholder="Optional descriptions..."/></div>`;

  if (type === 'account') return `
    <div class="fld"><label>Liquid Account Label Title</label><input type="text" id="fn" placeholder="e.g. Axis Bank, Pocket Cash"/></div>
    <div class="fld"><label>Base Current Balance (₹)</label><input type="number" id="fb" placeholder="0" inputmode="numeric"/></div>`;

  if (type === 'asset') return `
    <div class="fld"><label>Asset Definition Label</label><input type="text" id="fn" placeholder="e.g. Land Property, Safe Gold"/></div>
    <div class="fld"><label>Evaluated Net Worth Value (₹)</label><input type="number" id="fv" placeholder="0" inputmode="numeric"/></div>`;

  if (type === 'debt') return `
    <div class="fld"><label>Lending Liability Party Entity</label><input type="text" id="fl" placeholder="e.g. HDFC Home Loan, Friend Name"/></div>
    <div class="fld"><label>Principal Outstanding Liability (₹)</label><input type="number" id="fa" placeholder="0" inputmode="numeric"/></div>
    <div class="fld"><label>Liability Description Notes</label><input type="text" id="fn" placeholder="Optional notes..."/></div>`;

  if (type === 'pin') return `
    <div class="fld"><label>Assign Secure 4-Digit Numeric Combination Pin</label><input type="password" id="p1" maxlength="4" pattern="[0-9]*" inputmode="numeric" placeholder="••••"/></div>
    <div class="fld"><label>Verify Assigned Security Pin Code Sequence</label><input type="password" id="p2" maxlength="4" pattern="[0-9]*" inputmode="numeric" placeholder="••••"/></div>`;

  return '';
}

window.saveModal = function() {
  if (mType === 'txn') {
    const flowType = g('ft'), amount = parseFloat(g('fa')) || 0, assignedAccount = g('fac'), targetDate = g('fd'), noteText = g('fn');
    if (amount <= 0) { alert('Specify structural numeric values greater than zero.'); return; }
    if (!assignedAccount) { alert('An active linked account balance pool must be mapped first.'); return; }
    
    const transactionRecord = {
      id: nextId(DB.transactions),
      date: targetDate,
      type: flowType,
      amount: amount,
      account: assignedAccount,
      note: noteText,
      source: flowType === 'income' ? g('fs') : '',
      category: flowType === 'expense' ? g('fc') : ''
    };
    
    // Automation Balanced Logic System Engine Optimization Pipeline
    const mappedAccount = DB.accounts.find(a => a.name === assignedAccount);
    if (mappedAccount) {
      if (flowType === 'income') mappedAccount.balance = Number(mappedAccount.balance) + amount;
      else mappedAccount.balance = Number(mappedAccount.balance) - amount;
    }
    DB.transactions.push(transactionRecord);

  } else if (mType === 'account') {
    const titleLabel = g('fn'), startingBalance = parseFloat(g('fb')) || 0;
    if (!titleLabel) { alert('Account labels cannot be registered empty.'); return; }
    DB.accounts.push({ id: nextId(DB.accounts), name: titleLabel, balance: startingBalance });

  } else if (mType === 'asset') {
    const assetTitle = g('fn'), valuationValue = parseFloat(g('fv')) || 0;
    if (!assetTitle) { alert('Asset classifications need alphanumeric identification.'); return; }
    DB.assets.push({ id: nextId(DB.assets), name: assetTitle, value: valuationValue });

  } else if (mType === 'debt') {
    const entityCreditor = g('fl'), dueLiability = parseFloat(g('fa')) || 0, purposeNote = g('fn');
    if (!entityCreditor || dueLiability <= 0) { alert('Provide accurate liability definitions & balances.'); return; }
    DB.debts.push({ id: nextId(DB.debts), lender: entityCreditor, amount: dueLiability, note: purposeNote });

  } else if (mType === 'pin') {
    const passcodeOne = g('p1'), passcodeTwo = g('p2');
    if (passcodeOne.length !== 4 || !/^\d+$/.test(passcodeOne)) { alert('PIN requirements state exactly 4 digital integers.'); return; }
    if (passcodeOne !== passcodeTwo) { alert('PIN structures do not align.'); return; }
    localStorage.setItem(PIN_KEY, passcodeOne);
    toast('🔐 Application runtime padlock setup active.');
  }

  saveDB();
  closeModal(null);
  renderPage();
};

// ==========================================================================
// DELETION PIPELINES WITH AUTOMATIC ACCOUNT CORRECTION
// ==========================================================================
window.delTxn = function(id) {
  const transaction = DB.transactions.find(x => x.id === id);
  if (transaction) {
    // Structural Re-Inversion Balancing Equation Routine
    const correspondingPool = DB.accounts.find(a => a.name === transaction.account);
    if (correspondingPool) {
      if (transaction.type === 'income') correspondingPool.balance = Number(correspondingPool.balance) - transaction.amount;
      else correspondingPool.balance = Number(correspondingPool.balance) + transaction.amount;
    }
    DB.transactions = DB.transactions.filter(x => x.id !== id);
    saveDB();
    renderPage();
  }
};

window.delItem = function(stateArrayKey, id) {
  if (confirm('Verify processing removal request on this ledger entity array index node?')) {
    DB[stateArrayKey] = DB[stateArrayKey].filter(x => x.id !== id);
    saveDB();
    renderPage();
  }
};

// ==========================================================================
// BACKUP FILE CONTEXT PORTS
// ==========================================================================
window.exportData = function() {
  const serializedPayload = JSON.stringify(DB);
  const binaryBlob = new Blob([serializedPayload], { type: 'application/json' });
  const internalAnchorElement = document.createElement('a');
  internalAnchorElement.href = URL.createObjectURL(binaryBlob);
  internalAnchorElement.download = `wealth_ledger_payload_snapshot_${todayStr()}.json`;
  internalAnchorElement.click();
};

window.importData = function(event) {
  const fileTarget = event.target.files[0];
  if (!fileTarget) return;
  const standardReader = new FileReader();
  standardReader.onload = function(evt) {
    try {
      const parsedStruct = JSON.parse(evt.target.result);
      if (parsedStruct.accounts && parsedStruct.transactions) {
        DB = parsedStruct;
        saveDB();
        renderPage();
        toast('✅ Data snapshot matrix injected successfully.');
      } else {
        alert('Data integrity configuration layouts out of bounds.');
      }
    } catch (err) {
      alert('Internal payload stream parse execution architecture interruption fault.');
    }
  };
  standardReader.readAsText(fileTarget);
};

window.clearAll = function() {
  if (confirm('⚠️ CRITICAL ALERT: Wipe storage arrays completely? All custom ledger histories disappear.')) {
    localStorage.removeItem(LS);
    localStorage.removeItem(PIN_KEY);
    window.location.reload();
  }
};

window.removePin = function() {
  if (confirm('Remove operational secure security locked authorization walls?')) {
    localStorage.removeItem(PIN_KEY);
    toast('Disabled Lock Verification.');
    renderPage();
  }
};

// ==========================================================================
// SECURITY SCREEN SYSTEM VERIFICATION
// ==========================================================================
function verifyLockState() {
  const pinCode = localStorage.getItem(PIN_KEY);
  const splashScreen = document.getElementById('splash');
  const pinScreen = document.getElementById('pinScreen');
  
  if (splashScreen) splashScreen.classList.add('hide');
  
  if (pinCode) {
    if (pinScreen) pinScreen.classList.add('show');
    const pinTitle = document.getElementById('pinTitle');
    const pinSub = document.getElementById('pinSub');
    if (pinTitle) pinTitle.textContent = 'Identity Authentication';
    if (pinSub) pinSub.textContent = 'Enter configured PIN to access database metrics';
  } else {
    goPage('dash');
  }
}

window.pk = function(val) {
  if (pBuffer.length < 4) {
    pBuffer += val;
    refreshPinDots();
    if (pBuffer.length === 4) {
      setTimeout(executePinMatchAuthorization, 160);
    }
  }
};

window.pkDel = function() { pBuffer = pBuffer.slice(0, -1); refreshPinDots(); };
window.pkClr = function() { pBuffer = ''; refreshPinDots(); };

window.skipPin = function() {
  if (localStorage.getItem(PIN_KEY)) {
    const errEl = document.getElementById('pinErr');
    if (errEl) errEl.textContent = 'Active operational padlock requires configuration validation.';
  } else {
    const pinScreen = document.getElementById('pinScreen');
    if (pinScreen) pinScreen.classList.remove('show');
    goPage('dash');
  }
};

function refreshPinDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`pd${i}`);
    if (dot) dot.classList[i < pBuffer.length ? 'add' : 'remove']('fill');
  }
}

function executePinMatchAuthorization() {
  const registeredSequence = localStorage.getItem(PIN_KEY);
  if (pBuffer === registeredSequence) {
    const pinScreen = document.getElementById('pinScreen');
    if (pinScreen) pinScreen.classList.remove('show');
    pBuffer = '';
    refreshPinDots();
    const errEl = document.getElementById('pinErr');
    if (errEl) errEl.textContent = '';
    goPage('dash');
  } else {
    pBuffer = '';
    refreshPinDots();
    const errEl = document.getElementById('pinErr');
    if (errEl) errEl.textContent = '❌ Access sequence mismatch. Refused.';
  }
}

// ==========================================================================
// EVENT MATRIX LISTENERS LOAD STAGES
// ==========================================================================
window.addEventListener('DOMContentLoaded', () => {
  loadDB();
  if (!DB.accounts.length) seedDemo();
  
  renderWheel();
  setTimeout(verifyLockState, 1200);

  // Monitor Network State In Real Time
  const statusBadge = document.getElementById('networkStatus');
  function handleNetworkChange() {
    if (!statusBadge) return;
    if (navigator.onLine) {
      statusBadge.textContent = '🟢 ONLINE';
      statusBadge.style.background = 'rgba(34,197,94,0.2)';
    } else {
      statusBadge.textContent = '📴 OFFLINE';
      statusBadge.style.background = 'rgba(255,255,255,0.2)';
    }
  }

  window.addEventListener('online', handleNetworkChange);
  window.addEventListener('offline', handleNetworkChange);
  handleNetworkChange(); // Initialize check on application mounting
});
