'use strict';

const DB_NAME = 'trade-vault-db';
const DB_VERSION = 1;
const LEGACY_RECORD_AAD = new TextEncoder().encode('trade-vault-record-v1');
const RECORD_AAD_PREFIX = 'trade-vault-record-v2:';
const VERIFY_AAD = new TextEncoder().encode('trade-vault-verifier-v1');
const VERIFY_TEXT = 'trade-vault-ok-v1';
const PBKDF2_ITERATIONS = 600000;
const SCALE_DIGITS = 18;
const SCALE = 10n ** BigInt(SCALE_DIGITS);
const IDLE_LOCK_MS = 5 * 60 * 1000;
const DEFAULT_FEE_RATE_PERCENT_TEXT = '0.12'; // synthetic sample fallback
const MARKET_WS_BASE = 'wss://wsapi.pro.coins.ph/openapi/quote/stream?streams=';
const MARKET_RECONNECT_BASE_MS = 4000;
const MARKET_MAX_RECONNECT_MS = 60000;
const MARKET_RENDER_THROTTLE_MS = 400;
const THEME_STORAGE_KEY = 'trade-vault-theme';
const THEME_COLORS = { dark: '#080b12', light: '#f5f7fa' };

let db;
let vaultKey = null;
let transactions = [];
let analyticsCache = null;
let deferredInstallPrompt = null;
let idleTimer = null;
let hiddenAt = 0;
let editingRecordKey = null;
let selectedRecordKeys = new Set();
let livePricingEnabled = true;
let marketSocket = null;
let marketPrices = new Map();
let marketStreamsKey = '';
let marketReconnectTimer = null;
let marketPingTimer = null;
let marketRenderTimer = null;
let marketReconnectAttempt = 0;
let marketLastMessageAt = 0;
let marketStatusText = 'Coins.ph live pricing idle';

const $ = id => document.getElementById(id);
const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const VIEW_TITLES = { overview: 'Overview', holdings: 'Holdings', ledger: 'Ledger' };

function initialTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {}
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme, persist = false) {
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  document.documentElement.style.colorScheme = next;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[next]);
  document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute('content', next === 'dark' ? 'black-translucent' : 'default');
  for (const id of ['themeToggleBtn', 'gateThemeBtn']) {
    const button = $(id);
    if (!button) continue;
    const target = next === 'dark' ? 'light' : 'dark';
    button.setAttribute('aria-label', `Switch to ${target} theme`);
    button.title = `Switch to ${target} theme`;
    button.querySelector('use')?.setAttribute('href', next === 'dark' ? '#i-sun' : '#i-moon');
  }
  if (persist) {
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch {}
  }
}

function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light', true);
}

applyTheme(initialTheme());

function setView(view, updateHash = true) {
  const next = VIEW_TITLES[view] ? view : 'overview';
  document.querySelectorAll('[data-page]').forEach(page => { page.hidden = page.dataset.page !== next; });
  document.querySelectorAll('[data-view-target]').forEach(button => {
    const active = button.dataset.viewTarget === next;
    button.classList.toggle('active', active);
    if (button.matches('.nav-button')) button.setAttribute('aria-current', active ? 'page' : 'false');
  });
  if ($('pageTitle')) $('pageTitle').textContent = VIEW_TITLES[next];
  document.title = `Trade Vault · ${VIEW_TITLES[next]}`;
  if (updateHash && location.hash !== `#${next}`) history.pushState(null, '', `#${next}`);
  if (next === 'holdings' && vaultKey) syncMarketData();
}

function currentViewFromHash() {
  const view = location.hash.replace(/^#/, '').toLowerCase();
  return VIEW_TITLES[view] ? view : 'overview';
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function bytesToB64(bytes) {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function b64ToBytes(text) {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function randomBytes(length) {
  return crypto.getRandomValues(new Uint8Array(length));
}

async function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('meta')) database.createObjectStore('meta', { keyPath: 'key' });
      if (!database.objectStoreNames.contains('records')) database.createObjectStore('records', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbGet(storeName, key) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

function idbGetAll(storeName) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(storeName, value) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, 'readwrite').objectStore(storeName).put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(storeName, key) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, 'readwrite').objectStore(storeName).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbClear(storeName) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, 'readwrite').objectStore(storeName).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function deriveKey(passphrase, salt, iterations) {
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptBytes(key, bytes, aad) {
  const iv = randomBytes(12);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, bytes);
  return { iv: bytesToB64(iv), cipher: bytesToB64(cipher) };
}

async function decryptBytes(key, payload, aad) {
  const clear = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(payload.iv), additionalData: aad },
    key,
    b64ToBytes(payload.cipher)
  );
  return new Uint8Array(clear);
}

function makeUniqueKey(prefix = 'record') {
  if (crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  const bytes = randomBytes(16);
  return `${prefix}-${Date.now()}-${bytesToB64(bytes).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`;
}

function recordAad(recordKey) {
  return enc.encode(`${RECORD_AAD_PREFIX}${recordKey}`);
}

async function encryptTransaction(tx, recordKey = makeUniqueKey('record')) {
  const payload = await encryptBytes(vaultKey, enc.encode(JSON.stringify(tx)), recordAad(recordKey));
  return { key: recordKey, version: 2, ...payload };
}

async function decryptRecord(record) {
  const aad = record.version === 2 ? recordAad(record.key) : LEGACY_RECORD_AAD;
  const clear = await decryptBytes(vaultKey, record, aad);
  return JSON.parse(dec.decode(clear));
}

async function vaultExists() {
  return Boolean(await idbGet('meta', 'vault'));
}

async function createVault(passphrase) {
  const salt = randomBytes(16);
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const verifier = await encryptBytes(key, enc.encode(VERIFY_TEXT), VERIFY_AAD);
  const vault = {
    key: 'vault',
    version: 1,
    kdf: 'PBKDF2-SHA-256',
    iterations: PBKDF2_ITERATIONS,
    salt: bytesToB64(salt),
    verifier
  };
  await idbPut('meta', vault);
  vaultKey = key;
  transactions = [];
  await requestPersistence();
  showApp();
  renderAll();
}

async function unlockVault(passphrase) {
  const vault = await idbGet('meta', 'vault');
  if (!vault) throw new Error('No vault exists.');
  const key = await deriveKey(passphrase, b64ToBytes(vault.salt), vault.iterations);
  const check = dec.decode(await decryptBytes(key, vault.verifier, VERIFY_AAD));
  if (check !== VERIFY_TEXT) throw new Error('Incorrect passphrase.');
  vaultKey = key;
  await loadTransactions();
  await requestPersistence();
  showApp();
  renderAll();
}

function clearSensitiveUi() {
  const txBody = $('transactionsBody');
  const holdingsBody = $('holdingsBody');
  const allocation = $('allocationChart');
  if (txBody) txBody.innerHTML = '<tr><td colspan="10" class="empty-cell">Vault locked.</td></tr>';
  if (holdingsBody) holdingsBody.innerHTML = '<tr><td colspan="7" class="empty-cell">Vault locked.</td></tr>';
  if ($('transactionsCards')) $('transactionsCards').innerHTML = '<div class="empty-card">Vault locked.</div>';
  if ($('holdingsCards')) $('holdingsCards').innerHTML = '<div class="empty-card">Vault locked.</div>';
  if (allocation) { allocation.className = 'bar-chart empty-state'; allocation.textContent = 'Vault locked.'; }
  if ($('warningBanner')) { $('warningBanner').hidden = true; $('warningBanner').textContent = ''; }
  if ($('searchInput')) $('searchInput').value = '';
  if ($('manualDialog')?.open) $('manualDialog').close();
  if ($('manualForm')) $('manualForm').reset();
  editingRecordKey = null;
  selectedRecordKeys.clear();
  if ($('selectAllVisible')) $('selectAllVisible').checked = false;
  if ($('selectionCount')) { $('selectionCount').hidden = true; $('selectionCount').textContent = ''; }
}

function lockVault() {
  stopMarketData({ clearPrices: true, resetStatus: true });
  vaultKey = null;
  transactions = [];
  analyticsCache = null;
  clearTimeout(idleTimer);
  clearSensitiveUi();
  $('appShell').hidden = true;
  $('vaultGate').hidden = false;
  $('unlockPassphrase').value = '';
  $('unlockVaultPanel').hidden = false;
  $('createVaultPanel').hidden = true;
}

async function loadTransactions() {
  const records = await idbGetAll('records');
  const loaded = [];
  const legacy = [];
  for (const record of records) {
    try {
      const tx = await decryptRecord(record);
      tx._recordKey = record.key;
      loaded.push(tx);
      if (record.version !== 2) legacy.push({ recordKey: record.key, tx });
    } catch (error) {
      console.error('Could not decrypt record', record.key, error);
    }
  }
  transactions = loaded.sort((a, b) => parseDateMs(b.date) - parseDateMs(a.date));

  // Transparently upgrade legacy ciphertext to record-bound authenticated data.
  for (const item of legacy) {
    const cleanTx = { ...item.tx };
    delete cleanTx._recordKey;
    await idbPut('records', await encryptTransaction(cleanTx, item.recordKey));
  }
}

async function saveTransaction(tx) {
  if (!vaultKey) throw new Error('Vault is locked.');
  const record = await encryptTransaction(tx);
  await idbPut('records', record);
  tx._recordKey = record.key;
  transactions.push(tx);
  transactions.sort((a, b) => parseDateMs(b.date) - parseDateMs(a.date));
}

async function updateTransaction(recordKey, tx) {
  if (!vaultKey) throw new Error('Vault is locked.');
  if (!recordKey) throw new Error('Transaction record is missing.');
  const record = await encryptTransaction(tx, recordKey);
  await idbPut('records', record);
  const index = transactions.findIndex(item => item._recordKey === recordKey);
  if (index < 0) throw new Error('Transaction was not found.');
  tx._recordKey = recordKey;
  transactions[index] = tx;
  transactions.sort((a, b) => parseDateMs(b.date) - parseDateMs(a.date));
}

async function deleteTransaction(recordKey) {
  if (!vaultKey) throw new Error('Vault is locked.');
  await idbDelete('records', recordKey);
  transactions = transactions.filter(item => item._recordKey !== recordKey);
  selectedRecordKeys.delete(recordKey);
}

async function requestPersistence() {
  if (!navigator.storage?.persist) return;
  try {
    await navigator.storage.persist();
    const persisted = await navigator.storage.persisted?.();
    $('storageStatus').textContent = persisted ? 'Encrypted local vault · persistent storage' : 'Encrypted local vault · browser-managed storage';
  } catch {
    $('storageStatus').textContent = 'Encrypted local vault';
  }
}

function showApp() {
  $('vaultGate').hidden = true;
  $('appShell').hidden = false;
  setView(currentViewFromHash(), false);
  resetIdleTimer();
}

function resetIdleTimer() {
  if (!vaultKey) return;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    lockVault();
    toast('Vault locked after inactivity.');
  }, IDLE_LOCK_MS);
}

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2600);
}

function setBusy(button, busy, busyText) {
  button.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
  if (button.classList.contains('icon-only')) return;
  if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
  button.innerHTML = busy ? escapeHtml(busyText) : button.dataset.originalHtml;
}

function normalizeDecimal(value, allowEmpty = false) {
  const text = String(value ?? '').trim().replace(/,/g, '');
  if (allowEmpty && text === '') return '';
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error(`Invalid decimal value: ${value}`);
  return text;
}

function parseFixed(value) {
  const text = normalizeDecimal(value);
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > SCALE_DIGITS) {
    const kept = fraction.slice(0, SCALE_DIGITS);
    const next = fraction[SCALE_DIGITS];
    let scaled = BigInt(whole) * SCALE + BigInt(kept.padEnd(SCALE_DIGITS, '0'));
    if (next >= '5') scaled += 1n;
    return scaled;
  }
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(SCALE_DIGITS, '0'));
}

function mulFixed(a, b) {
  return (a * b + SCALE / 2n) / SCALE;
}

function divFixed(a, b) {
  if (b === 0n) return 0n;
  return (a * SCALE + b / 2n) / b;
}

function percentOfFixed(value, percent) {
  return (value * percent + (SCALE * 100n) / 2n) / (SCALE * 100n);
}

function fixedToNumber(value) {
  return Number(value) / Number(SCALE);
}

function formatFixed(value, maxDecimals = 8) {
  const negative = value < 0n;
  let n = negative ? -value : value;
  const whole = n / SCALE;
  let fraction = (n % SCALE).toString().padStart(SCALE_DIGITS, '0').slice(0, maxDecimals).replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole.toLocaleString('en-US')}${fraction ? `.${fraction}` : ''}`;
}

function formatMoney(value) {
  if (value == null) return '—';
  const amount = typeof value === 'bigint' ? fixedToNumber(value) : value;
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

function parseFee(rawFee, side, base, quote) {
  const text = String(rawFee ?? '').trim();
  if (!text) return { amount: '0', asset: quote, inferred: false, raw: '' };
  const match = text.match(/^([0-9]+(?:\.[0-9]+)?)(?:\s+([A-Za-z0-9._-]+))?$/);
  if (!match) throw new Error(`Invalid fee: ${text}`);
  const amount = normalizeDecimal(match[1]);
  const explicit = match[2]?.toUpperCase();
  if (explicit) return { amount, asset: explicit, inferred: false, raw: text };
  return { amount, asset: side === 'SELL' ? quote : base, inferred: parseFixed(amount) > 0n, raw: text };
}

function normalizeTransaction(input, source = 'manual') {
  const date = String(input.date ?? '').trim();
  if (!date) throw new Error('Date is required.');
  const id = String(input.id ?? '').trim();
  if (!id) throw new Error('Transaction ID is required.');
  const pair = String(input.pair ?? '').trim().toUpperCase();
  const parts = pair.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error(`Invalid pair: ${pair}`);
  const [base, quote] = parts;
  const side = String(input.side ?? '').trim().toUpperCase();
  if (!['BUY', 'SELL'].includes(side)) throw new Error(`Invalid side: ${side}`);
  const price = normalizeDecimal(input.price);
  const executed = normalizeDecimal(input.executed);
  const total = normalizeDecimal(input.total);
  const fee = parseFee(input.fee, side, base, quote);
  if (parseFixed(price) <= 0n || parseFixed(executed) <= 0n || parseFixed(total) < 0n) throw new Error('Price and quantity must be positive; total cannot be negative.');

  const expectedTotal = mulFixed(parseFixed(price), parseFixed(executed));
  const statedTotal = parseFixed(total);
  const diff = expectedTotal > statedTotal ? expectedTotal - statedTotal : statedTotal - expectedTotal;
  const tolerance = statedTotal / 10000n + 1000n; // roughly 0.01% plus a tiny floor

  return {
    date,
    id,
    pair,
    base,
    quote,
    type: String(input.type ?? 'OTHER').trim().toUpperCase() || 'OTHER',
    side,
    price,
    executed,
    total,
    feeAmount: fee.amount,
    feeAsset: fee.asset,
    feeRaw: fee.raw,
    feeInferred: fee.inferred,
    totalMismatch: diff > tolerance,
    source,
    addedAt: new Date().toISOString()
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else {
      if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
      else field += ch;
    }
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows.filter(r => r.some(cell => cell.trim() !== ''));
}

function csvRowsToTransactions(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('CSV has no transaction rows.');
  const headers = rows[0].map(h => h.replace(/^\uFEFF/, '').trim());
  const required = ['Date', 'ID', 'Pair', 'Type', 'Side', 'Executed Price', 'Executed', 'Total', 'Fee'];
  for (const name of required) if (!headers.includes(name)) throw new Error(`Missing required column: ${name}`);
  const index = Object.fromEntries(headers.map((h, i) => [h, i]));

  return rows.slice(1).map((r, rowIndex) => {
    try {
      return normalizeTransaction({
        date: r[index.Date],
        id: r[index.ID],
        pair: r[index.Pair],
        type: r[index.Type],
        side: r[index.Side],
        price: r[index['Executed Price']],
        executed: r[index.Executed],
        total: r[index.Total],
        fee: r[index.Fee]
      }, 'csv');
    } catch (error) {
      throw new Error(`CSV row ${rowIndex + 2}: ${error.message}`);
    }
  });
}

function parseDateMs(value) {
  const match = String(value).match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return Date.parse(value) || 0;
  const [, y, m, d, hh, mm, ss = '0'] = match;
  return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)).getTime();
}

function shortDate(value) {
  const ms = parseDateMs(value);
  if (!ms) return value;
  return new Intl.DateTimeFormat('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
}

function marketSymbolForHolding(holding) {
  if (!holding || holding.quote !== 'PHP' || holding.netQty <= 0n) return null;
  return `${holding.base}${holding.quote}`.replace(/[^A-Z0-9]/g, '').toUpperCase();
}

function desiredMarketSymbols() {
  if (!analyticsCache?.holdings) return [];
  return [...new Set(analyticsCache.holdings.map(marketSymbolForHolding).filter(Boolean))].sort();
}

function updateMarketStatus(text = marketStatusText) {
  marketStatusText = text;
  const el = $('marketStatus');
  if (!el) return;
  let suffix = '';
  if (marketLastMessageAt) {
    const time = new Intl.DateTimeFormat('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(marketLastMessageAt));
    suffix = ` · ${time}`;
  }
  el.textContent = `${text}${suffix}`;
}

function scheduleMarketRender() {
  if (marketRenderTimer) return;
  marketRenderTimer = setTimeout(() => {
    marketRenderTimer = null;
    if (vaultKey) renderHoldings();
    updateMarketStatus();
  }, MARKET_RENDER_THROTTLE_MS);
}

function stopMarketData({ clearPrices = true, resetStatus = true } = {}) {
  clearTimeout(marketReconnectTimer);
  clearInterval(marketPingTimer);
  clearTimeout(marketRenderTimer);
  marketReconnectTimer = null;
  marketPingTimer = null;
  marketRenderTimer = null;
  marketStreamsKey = '';
  marketReconnectAttempt = 0;
  if (marketSocket) {
    const socket = marketSocket;
    marketSocket = null;
    socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
    try { socket.close(1000, 'vault state changed'); } catch {}
  }
  if (clearPrices) {
    marketPrices.clear();
    marketLastMessageAt = 0;
  }
  if (resetStatus) updateMarketStatus(livePricingEnabled ? 'Coins.ph live pricing idle' : 'Live pricing off');
}

function scheduleMarketReconnect() {
  if (!vaultKey || !livePricingEnabled || document.hidden || marketReconnectTimer) return;
  const delay = Math.min(MARKET_MAX_RECONNECT_MS, MARKET_RECONNECT_BASE_MS * (2 ** marketReconnectAttempt));
  marketReconnectAttempt = Math.min(marketReconnectAttempt + 1, 4);
  updateMarketStatus(`Coins.ph reconnecting in ${Math.round(delay / 1000)}s`);
  marketReconnectTimer = setTimeout(() => {
    marketReconnectTimer = null;
    syncMarketData(true);
  }, delay);
}

function syncMarketData(force = false) {
  if (!vaultKey || !livePricingEnabled || document.hidden) {
    if (marketSocket) stopMarketData({ clearPrices: false, resetStatus: true });
    return;
  }

  const symbols = desiredMarketSymbols();
  if (!symbols.length) {
    stopMarketData({ clearPrices: true, resetStatus: false });
    updateMarketStatus('No open PHP inventory to price');
    return;
  }

  const streams = symbols.map(symbol => `${symbol.toLowerCase()}@bookTicker`);
  const streamsKey = streams.join('/');
  if (!force && marketSocket && marketStreamsKey === streamsKey && [WebSocket.OPEN, WebSocket.CONNECTING].includes(marketSocket.readyState)) return;

  stopMarketData({ clearPrices: force, resetStatus: false });
  marketStreamsKey = streamsKey;
  updateMarketStatus(`Connecting to Coins.ph · ${symbols.length} pair${symbols.length === 1 ? '' : 's'}`);

  try {
    const socket = new WebSocket(`${MARKET_WS_BASE}${streamsKey}`);
    marketSocket = socket;

    socket.onopen = () => {
      if (socket !== marketSocket) return;
      marketReconnectAttempt = 0;
      updateMarketStatus(`Coins.ph live · ${symbols.length} pair${symbols.length === 1 ? '' : 's'}`);
      clearInterval(marketPingTimer);
      marketPingTimer = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          try { socket.send(JSON.stringify({ ping: Date.now() })); } catch {}
        }
      }, 4 * 60 * 1000);
    };

    socket.onmessage = event => {
      if (socket !== marketSocket) return;
      try {
        const message = JSON.parse(event.data);
        if (message?.pong) return;
        const data = message?.data || message;
        const symbol = String(data?.s || '').toUpperCase();
        if (!symbol || !data?.b) return;
        const bidPrice = normalizeDecimal(data.b);
        const askPrice = data.a ? normalizeDecimal(data.a) : '';
        marketLastMessageAt = Date.now();
        marketPrices.set(symbol, { bidPrice, askPrice, updatedAt: marketLastMessageAt });
        marketStatusText = `Coins.ph live · ${symbols.length} pair${symbols.length === 1 ? '' : 's'}`;
        scheduleMarketRender();
      } catch (error) {
        console.warn('Ignored malformed Coins.ph market message', error);
      }
    };

    socket.onerror = () => {
      if (socket === marketSocket) updateMarketStatus('Coins.ph live pricing unavailable');
    };

    socket.onclose = () => {
      if (socket !== marketSocket) return;
      marketSocket = null;
      clearInterval(marketPingTimer);
      marketPingTimer = null;
      if (vaultKey && livePricingEnabled && !document.hidden) scheduleMarketReconnect();
    };
  } catch (error) {
    console.warn('Could not open Coins.ph market socket', error);
    updateMarketStatus('Coins.ph live pricing unavailable');
    scheduleMarketReconnect();
  }
}

function analyzeTransactions(list) {
  const ordered = [...list].sort((a, b) => parseDateMs(a.date) - parseDateMs(b.date));
  const states = new Map();
  const txStatus = new Map();
  let buyVolumePhp = 0n;
  let feesPhp = 0n;
  let realizedPnlPhp = 0n;
  let matchedSells = 0;
  let unmatchedSells = 0;
  const warnings = [];

  for (const tx of ordered) {
    const state = states.get(tx.pair) || { pair: tx.pair, base: tx.base, quote: tx.quote, netQty: 0n, knownQty: 0n, knownCost: 0n };
    const qty = parseFixed(tx.executed);
    const total = parseFixed(tx.total);
    const fee = parseFixed(tx.feeAmount || '0');
    const notes = [];

    if (tx.quote === 'PHP' && tx.side === 'BUY') buyVolumePhp += total;
    if (tx.feeAsset === 'PHP') feesPhp += fee;
    if (tx.feeInferred && fee > 0n) notes.push(`Fee asset inferred as ${tx.feeAsset}`);
    if (tx.totalMismatch) notes.push('Price × quantity differs from Total');

    if (tx.side === 'BUY') {
      let qtyAdded = qty;
      let quoteCost = total;
      if (tx.feeAsset === tx.base) qtyAdded -= fee;
      else if (tx.feeAsset === tx.quote) quoteCost += fee;
      else if (fee > 0n) notes.push(`Fee in ${tx.feeAsset} not valued in cost basis`);
      state.netQty += qtyAdded;
      if (qtyAdded > 0n) {
        state.knownQty += qtyAdded;
        state.knownCost += quoteCost;
      }
    } else {
      let qtyRemoved = qty;
      let proceeds = total;
      if (tx.feeAsset === tx.base) qtyRemoved += fee;
      else if (tx.feeAsset === tx.quote) proceeds = proceeds > fee ? proceeds - fee : 0n;
      else if (fee > 0n) notes.push(`Fee in ${tx.feeAsset} not valued in proceeds`);
      state.netQty -= qtyRemoved;

      if (state.knownQty > 0n && qtyRemoved <= state.knownQty) {
        const avgCost = divFixed(state.knownCost, state.knownQty);
        const removedCost = mulFixed(avgCost, qtyRemoved);
        state.knownQty -= qtyRemoved;
        state.knownCost = state.knownCost > removedCost ? state.knownCost - removedCost : 0n;
        if (tx.quote === 'PHP') realizedPnlPhp += proceeds - removedCost;
        matchedSells++;
        notes.push('Matched using weighted average cost');
      } else {
        unmatchedSells++;
        state.knownQty = 0n;
        state.knownCost = 0n;
        notes.push('Missing prior inventory; realized P&L not calculated');
      }
    }

    states.set(tx.pair, state);
    txStatus.set(tx.id, notes);
  }

  const holdings = [...states.values()].sort((a, b) => Number(b.knownCost - a.knownCost));
  if (unmatchedSells) warnings.push(`${unmatchedSells} sell transaction${unmatchedSells === 1 ? '' : 's'} cannot be matched to earlier inventory. Import older history before relying on realized P&L.`);
  const inferredFees = list.filter(t => t.feeInferred && parseFixed(t.feeAmount || '0') > 0n).length;
  if (inferredFees) warnings.push(`${inferredFees} fee asset${inferredFees === 1 ? ' was' : 's were'} inferred from trade side because the CSV omitted the currency.`);
  const mismatches = list.filter(t => t.totalMismatch).length;
  if (mismatches) warnings.push(`${mismatches} transaction${mismatches === 1 ? '' : 's'} have a noticeable Price × Quantity vs Total difference.`);

  return { holdings, txStatus, buyVolumePhp, feesPhp, realizedPnlPhp, matchedSells, unmatchedSells, warnings };
}

function renderAll() {
  analyticsCache = analyzeTransactions(transactions);
  renderMetrics();
  renderHoldings();
  renderAllocation();
  renderTransactions();
  renderWarnings();
  syncMarketData();
}

function renderMetrics() {
  $('metricTransactions').textContent = String(transactions.length);
  $('metricBuyVolume').textContent = formatMoney(analyticsCache.buyVolumePhp);
  $('metricFees').textContent = formatMoney(analyticsCache.feesPhp);
  if (analyticsCache.matchedSells > 0) {
    $('metricPnl').textContent = formatMoney(analyticsCache.realizedPnlPhp);
    $('metricPnlNote').textContent = analyticsCache.unmatchedSells ? 'Partial: unmatched sells excluded' : `${analyticsCache.matchedSells} matched sell${analyticsCache.matchedSells === 1 ? '' : 's'}`;
  } else {
    $('metricPnl').textContent = '—';
    $('metricPnlNote').textContent = analyticsCache.unmatchedSells ? 'Missing earlier inventory' : 'Needs matched sells';
  }

  if (transactions.length) {
    const times = transactions.map(t => parseDateMs(t.date)).filter(Boolean);
    const min = Math.min(...times), max = Math.max(...times);
    const fmt = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    $('metricDateRange').textContent = min && max ? `${fmt.format(new Date(min))} – ${fmt.format(new Date(max))}` : 'Imported ledger';
  } else $('metricDateRange').textContent = 'No data yet';
}

function renderWarnings() {
  const el = $('warningBanner');
  if (!analyticsCache.warnings.length) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false;
  el.textContent = analyticsCache.warnings.join(' ');
}

function renderHoldings() {
  const body = $('holdingsBody');
  const cards = $('holdingsCards');
  if (!analyticsCache.holdings.length) {
    body.innerHTML = '<tr><td colspan="7" class="empty-cell">No holdings yet.</td></tr>';
    if (cards) cards.innerHTML = '<div class="empty-card">No holdings yet.</div>';
    return;
  }

  const rows = analyticsCache.holdings.map(h => {
    const avg = h.knownQty > 0n ? divFixed(h.knownCost, h.knownQty) : null;
    const quantity = formatFixed(h.netQty, 10);
    const symbol = marketSymbolForHolding(h);
    const market = symbol ? marketPrices.get(symbol) : null;
    let marketValue = null;
    let unrealized = null;
    if (market?.bidPrice && h.netQty > 0n) {
      try {
        marketValue = mulFixed(h.netQty, parseFixed(market.bidPrice));
        if (h.quote === 'PHP' && h.knownCost >= 0n) unrealized = marketValue - h.knownCost;
      } catch { marketValue = null; }
    }
    const liveBid = !livePricingEnabled ? 'Off' : market?.bidPrice ? formatMoney(parseFixed(market.bidPrice)) : (symbol ? 'Waiting…' : '—');
    const valueText = marketValue == null ? '—' : formatMoney(marketValue);
    const pnlText = unrealized == null ? '—' : formatMoney(unrealized);
    const pnlClass = unrealized == null ? '' : unrealized > 0n ? 'positive' : unrealized < 0n ? 'negative' : '';
    const avgText = avg == null ? '—' : `${escapeHtml(h.quote)} ${formatFixed(avg, 6)}`;
    const costText = h.quote === 'PHP' ? formatMoney(h.knownCost) : `${escapeHtml(h.quote)} ${formatFixed(h.knownCost, 4)}`;
    return { h, quantity, liveBid, valueText, pnlText, pnlClass, avgText, costText };
  });

  body.innerHTML = rows.map(({ h, quantity, liveBid, valueText, pnlText, pnlClass, avgText, costText }) => `<tr>
    <td><strong>${escapeHtml(h.base)}</strong></td>
    <td>${quantity}</td>
    <td>${avgText}</td>
    <td>${costText}</td>
    <td>${liveBid}</td>
    <td><strong>${valueText}</strong></td>
    <td class="${pnlClass}">${pnlText}</td>
  </tr>`).join('');

  if (cards) cards.innerHTML = rows.map(({ h, quantity, liveBid, valueText, pnlText, pnlClass, avgText, costText }) => `<article class="holding-card">
    <div class="holding-card-head">
      <div><div class="asset-name">${escapeHtml(h.base)}</div><div class="card-sub">${escapeHtml(h.base)}/${escapeHtml(h.quote)}</div></div>
      <div class="asset-value">${valueText}</div>
    </div>
    <div class="value-grid">
      <div class="value-cell"><span>Quantity</span><strong>${quantity}</strong></div>
      <div class="value-cell"><span>Live bid</span><strong>${liveBid}</strong></div>
      <div class="value-cell"><span>Avg cost</span><strong>${avgText}</strong></div>
      <div class="value-cell"><span>Cost basis</span><strong>${costText}</strong></div>
      <div class="value-cell"><span>Unrealized</span><strong class="${pnlClass}">${pnlText}</strong></div>
    </div>
  </article>`).join('');
}
function renderAllocation() {
  const el = $('allocationChart');
  const rows = analyticsCache.holdings.filter(h => h.quote === 'PHP' && h.knownCost > 0n);
  if (!rows.length) {
    el.className = 'bar-chart empty-state';
    el.textContent = 'Import buy transactions to see cost-basis allocation.';
    return;
  }
  el.className = 'bar-chart';
  const max = rows.reduce((m, r) => r.knownCost > m ? r.knownCost : m, 0n);
  el.innerHTML = rows.slice(0, 8).map(r => {
    const pct = max > 0n ? Math.max(2, (fixedToNumber(r.knownCost) / fixedToNumber(max)) * 100) : 0;
    return `<div class="bar-row">
      <div class="bar-label">${escapeHtml(r.base)}</div>
      <progress class="bar-progress" max="100" value="${pct.toFixed(2)}" aria-label="${escapeHtml(r.base)} allocation"></progress>
      <div class="bar-value">${formatMoney(r.knownCost)}</div>
    </div>`;
  }).join('');
}

function filteredTransactions() {
  const q = $('searchInput')?.value.trim().toLowerCase() || '';
  const side = $('sideFilter')?.value || '';
  return transactions.filter(tx => {
    if (side && tx.side !== side) return false;
    return !q || [tx.id, tx.pair, tx.side, tx.type, tx.feeAsset, tx.source].some(v => String(v).toLowerCase().includes(q));
  });
}

function updateSelectionUi(filtered = filteredTransactions()) {
  for (const key of [...selectedRecordKeys]) {
    if (!transactions.some(tx => tx._recordKey === key)) selectedRecordKeys.delete(key);
  }
  const visibleKeys = filtered.map(tx => tx._recordKey);
  const selectedVisible = visibleKeys.filter(key => selectedRecordKeys.has(key)).length;
  const selectAll = $('selectAllVisible');
  if (selectAll) {
    selectAll.checked = visibleKeys.length > 0 && selectedVisible === visibleKeys.length;
    selectAll.indeterminate = selectedVisible > 0 && selectedVisible < visibleKeys.length;
  }
  const deleteBtn = $('deleteSelectedBtn');
  if (deleteBtn) {
    deleteBtn.disabled = selectedRecordKeys.size === 0;
    const label = selectedRecordKeys.size ? `Delete ${selectedRecordKeys.size} selected transaction${selectedRecordKeys.size === 1 ? '' : 's'}` : 'Delete selected transactions';
    deleteBtn.setAttribute('aria-label', label);
    deleteBtn.title = label;
  }
  const selectBtn = $('selectVisibleBtn');
  if (selectBtn) {
    const allSelected = visibleKeys.length > 0 && selectedVisible === visibleKeys.length;
    const label = allSelected ? 'Clear visible selection' : 'Select visible transactions';
    selectBtn.setAttribute('aria-label', label);
    selectBtn.title = label;
    selectBtn.classList.toggle('active', allSelected);
  }
  const count = $('selectionCount');
  if (count) {
    count.hidden = selectedRecordKeys.size === 0;
    count.textContent = selectedRecordKeys.size ? `${selectedRecordKeys.size} selected` : '';
  }
}
function renderTransactions() {
  const body = $('transactionsBody');
  const cards = $('transactionsCards');
  const filtered = filteredTransactions();
  if (!filtered.length) {
    const message = transactions.length ? 'No matches.' : 'No transactions yet.';
    body.innerHTML = `<tr><td colspan="10" class="empty-cell">${message}</td></tr>`;
    if (cards) cards.innerHTML = `<div class="empty-card">${message}</div>`;
    updateSelectionUi(filtered);
    return;
  }

  const rows = filtered.map(tx => {
    const notes = analyticsCache.txStatus.get(tx.id) || [];
    const warn = notes.some(n => n.includes('Missing') || n.includes('differs') || n.includes('inferred'));
    const feeText = `${formatFixed(parseFixed(tx.feeAmount || '0'), 12)} ${escapeHtml(tx.feeAsset || '')}`.trim();
    const checked = selectedRecordKeys.has(tx._recordKey);
    const totalText = tx.quote === 'PHP' ? formatMoney(parseFixed(tx.total)) : formatFixed(parseFixed(tx.total), 8);
    const priceText = tx.quote === 'PHP' ? formatMoney(parseFixed(tx.price)) : formatFixed(parseFixed(tx.price), 8);
    return { tx, notes, warn, feeText, checked, totalText, priceText };
  });

  body.innerHTML = rows.map(({ tx, notes, warn, feeText, checked, totalText, priceText }) => `<tr>
    <td class="select-cell"><input type="checkbox" data-select-key="${escapeHtml(tx._recordKey)}" aria-label="Select ${escapeHtml(tx.pair)} transaction"${checked ? ' checked' : ''}></td>
    <td title="${escapeHtml(tx.date)}">${escapeHtml(shortDate(tx.date))}</td>
    <td title="ID ${escapeHtml(tx.id)}"><strong>${escapeHtml(tx.pair)}</strong></td>
    <td><span class="side ${tx.side.toLowerCase()}">${escapeHtml(tx.side)}</span></td>
    <td>${priceText}</td>
    <td>${formatFixed(parseFixed(tx.executed), 10)}</td>
    <td><strong>${totalText}</strong></td>
    <td>${feeText}</td>
    <td class="status ${warn ? 'warn' : ''}" title="${escapeHtml(notes.join(' · '))}">${notes.length ? escapeHtml(notes[0]) : 'OK'}</td>
    <td><div class="row-actions"><button type="button" class="table-action icon-only" data-action="edit" data-key="${escapeHtml(tx._recordKey)}" aria-label="Edit transaction" title="Edit">${icon('edit')}</button><button type="button" class="table-action danger icon-only" data-action="delete" data-key="${escapeHtml(tx._recordKey)}" aria-label="Delete transaction" title="Delete">${icon('trash')}</button></div></td>
  </tr>`).join('');

  if (cards) cards.innerHTML = rows.map(({ tx, notes, warn, feeText, checked, totalText, priceText }) => `<article class="transaction-card${checked ? ' selected' : ''}" data-card-key="${escapeHtml(tx._recordKey)}">
    <div class="transaction-card-head">
      <div class="transaction-card-main">
        <input type="checkbox" data-select-key="${escapeHtml(tx._recordKey)}" aria-label="Select ${escapeHtml(tx.pair)} transaction"${checked ? ' checked' : ''}>
        <div><div class="pair-name">${escapeHtml(tx.pair)}</div><div class="card-sub">${escapeHtml(shortDate(tx.date))} · ${escapeHtml(tx.type)}</div></div>
      </div>
      <div class="transaction-card-actions"><button type="button" class="table-action icon-only" data-action="edit" data-key="${escapeHtml(tx._recordKey)}" aria-label="Edit transaction" title="Edit">${icon('edit')}</button><button type="button" class="table-action danger icon-only" data-action="delete" data-key="${escapeHtml(tx._recordKey)}" aria-label="Delete transaction" title="Delete">${icon('trash')}</button></div>
    </div>
    <div class="tx-amount">${totalText}</div>
    <div class="tx-meta"><span class="side ${tx.side.toLowerCase()}">${escapeHtml(tx.side)}</span><span>${formatFixed(parseFixed(tx.executed), 10)} ${escapeHtml(tx.base)}</span></div>
    <div class="tx-detail-grid">
      <div class="value-cell"><span>Price</span><strong>${priceText}</strong></div>
      <div class="value-cell"><span>Fee</span><strong>${feeText}</strong></div>
      <div class="tx-status ${warn ? 'warn' : ''}">${notes.length ? escapeHtml(notes[0]) : 'OK'}</div>
    </div>
  </article>`).join('');
  updateSelectionUi(filtered);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

async function importCsvFile(file) {
  const text = await file.text();
  const imported = csvRowsToTransactions(text);
  const existingIds = new Set(transactions.map(t => t.id));
  const batchIds = new Set();
  let added = 0;
  let skipped = 0;
  for (const tx of imported) {
    if (existingIds.has(tx.id) || batchIds.has(tx.id)) { skipped++; continue; }
    batchIds.add(tx.id);
    await saveTransaction(tx);
    added++;
  }
  renderAll();
  toast(`Imported ${added} transaction${added === 1 ? '' : 's'}${skipped ? ` · ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped` : ''}.`);
}

async function exportEncryptedBackup() {
  const vault = await idbGet('meta', 'vault');
  const records = await idbGetAll('records');
  const backup = { format: 'trade-vault-backup', version: 1, exportedAt: new Date().toISOString(), vault, records };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `trade-vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Encrypted backup downloaded.');
}

async function restoreEncryptedBackup(file) {
  const backup = JSON.parse(await file.text());
  if (backup?.format !== 'trade-vault-backup' || backup?.version !== 1 || !backup.vault || !Array.isArray(backup.records)) throw new Error('This is not a valid Trade Vault backup.');
  if (!confirm(`Restore ${backup.records.length} encrypted record(s)? This replaces the current local vault.`)) return;
  await idbClear('records');
  await idbClear('meta');
  await idbPut('meta', backup.vault);
  for (const record of backup.records) await idbPut('records', record);
  lockVault();
  toast('Backup restored. Unlock with the backup passphrase.');
}

function inferFeeProfile(side, base, quote) {
  const expectedMode = side === 'SELL' ? 'QUOTE' : 'BASE';
  const historical = transactions.filter(tx => tx.source === 'csv' && tx.side === side && parseFixed(tx.feeAmount || '0') > 0n);
  const candidates = [];

  for (const tx of historical) {
    const fee = parseFixed(tx.feeAmount);
    const qty = parseFixed(tx.executed);
    const total = parseFixed(tx.total);
    let mode = null;
    let basis = 0n;
    if (tx.feeAsset === tx.base && qty > 0n) { mode = 'BASE'; basis = qty; }
    else if (tx.feeAsset === tx.quote && total > 0n) { mode = 'QUOTE'; basis = total; }
    if (!mode || basis <= 0n) continue;
    const ratePercent = divFixed(fee, basis) * 100n;
    candidates.push({ mode, ratePercent });
  }

  if (!candidates.length) {
    return { mode: expectedMode, ratePercent: parseFixed(DEFAULT_FEE_RATE_PERCENT_TEXT), source: 'sample', varied: false, count: 0 };
  }

  const modeCounts = candidates.reduce((acc, item) => { acc[item.mode] = (acc[item.mode] || 0) + 1; return acc; }, {});
  const mode = (modeCounts.BASE || 0) > (modeCounts.QUOTE || 0) ? 'BASE' : (modeCounts.QUOTE || 0) > (modeCounts.BASE || 0) ? 'QUOTE' : expectedMode;
  const rates = candidates.filter(item => item.mode === mode).map(item => item.ratePercent).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  const middle = Math.floor(rates.length / 2);
  const ratePercent = rates.length % 2 ? rates[middle] : (rates[middle - 1] + rates[middle]) / 2n;
  const spread = rates[rates.length - 1] - rates[0];
  const varied = spread > parseFixed('0.000001');
  return { mode, ratePercent, source: 'csv', varied, count: rates.length };
}

function updateManualCalculations(form = $('manualForm')) {
  if (!form) return;
  const priceEl = form.elements.price;
  const qtyEl = form.elements.executed;
  const totalEl = form.elements.total;
  const feeEl = form.elements.fee;
  const noteEl = $('feeRuleNote');
  const pair = String(form.elements.pair.value || '').trim().toUpperCase();
  const side = String(form.elements.side.value || 'BUY').toUpperCase();
  const [base = '', quote = ''] = pair.split('/');
  const profile = inferFeeProfile(side, base, quote);
  const rateText = formatFixed(profile.ratePercent, 6).replace(/,/g, '');
  const basisText = profile.mode === 'BASE' ? `executed ${base || 'base'} quantity` : `total ${quote || 'quote'} value`;
  const assetText = profile.mode === 'BASE' ? (base || 'base asset') : (quote || 'quote asset');
  const sourceText = profile.source === 'csv' ? `inferred from ${profile.count} imported ${side} row${profile.count === 1 ? '' : 's'}` : 'using the synthetic sample CSV pattern';
  if (noteEl) noteEl.textContent = `${side}: ${rateText}% of ${basisText}, charged in ${assetText} — ${sourceText}${profile.varied ? ' (historical rates vary; median used)' : ''}.`;

  try {
    const price = parseFixed(priceEl.value);
    const qty = parseFixed(qtyEl.value);
    if (price <= 0n || qty <= 0n) throw new Error('incomplete');
    const total = mulFixed(price, qty);
    totalEl.value = formatFixed(total, 18).replace(/,/g, '');

    const feeAsset = profile.mode === 'BASE' ? base : quote;
    const feeBasis = profile.mode === 'BASE' ? qty : total;
    const feeAmount = percentOfFixed(feeBasis, profile.ratePercent);
    feeEl.value = feeAsset ? `${formatFixed(feeAmount, 18).replace(/,/g, '')} ${feeAsset}` : '';
  } catch {
    totalEl.value = '';
    feeEl.value = '';
  }
}

function localDateTimeInputValue(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function ensureManualDefaults(form = $('manualForm')) {
  if (!form) return;
  if (!form.elements.date.value) form.elements.date.value = localDateTimeInputValue();
  if (!form.elements.id.value) form.elements.id.value = makeUniqueKey('manual');
}

function dateToInputValue(value) {
  const match = String(value || '').match(/^(\d{4}-\d{1,2}-\d{1,2})[ T](\d{1,2}:\d{2})/);
  if (!match) return localDateTimeInputValue();
  const [y, m, d] = match[1].split('-');
  const [hh, mm] = match[2].split(':');
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function setManualMode(tx = null) {
  const form = $('manualForm');
  form.reset();
  setManualStatus('');
  editingRecordKey = tx?._recordKey || null;
  $('manualEyebrow').textContent = 'TRANSACTION';
  $('manualTitle').textContent = tx ? 'Edit transaction' : 'Add transaction';
  $('saveManualBtn').setAttribute('aria-label', tx ? 'Save changes' : 'Save transaction');
  $('saveManualBtn').title = tx ? 'Save changes' : 'Save transaction';

  if (!tx) {
    ensureManualDefaults(form);
    updateManualCalculations(form);
    return;
  }

  form.elements.date.value = dateToInputValue(tx.date);
  form.elements.id.value = tx.id;
  form.elements.pair.value = tx.pair;
  form.elements.type.value = ['LIMIT', 'MARKET', 'OTHER'].includes(tx.type) ? tx.type : 'OTHER';
  form.elements.side.value = tx.side;
  form.elements.price.value = tx.price;
  form.elements.executed.value = tx.executed;
  updateManualCalculations(form);
  form.elements.feeOverride.value = `${tx.feeAmount || '0'} ${tx.feeAsset || tx.quote}`.trim();
  setManualStatus(`Editing ${tx.source === 'csv' ? 'an imported' : 'a manual'} transaction. Saving replaces only this encrypted local record.`, 'info');
}

function openEditTransaction(recordKey) {
  const tx = transactions.find(item => item._recordKey === recordKey);
  if (!tx) return toast('Transaction was not found.');
  setManualMode(tx);
  $('manualDialog').showModal();
}

function setManualStatus(message = '', kind = '') {
  const el = $('manualStatus');
  if (!el) return;
  el.textContent = message;
  el.className = `manual-status span-2${kind ? ` ${kind}` : ''}`;
}

function validateManualForm(form) {
  ensureManualDefaults(form);
  const pair = String(form.elements.pair.value || '').trim().toUpperCase();
  if (!/^([A-Z0-9._-]+)\/([A-Z0-9._-]+)$/.test(pair)) throw new Error('Enter a pair like BTC/PHP.');
  if (!String(form.elements.price.value || '').trim()) throw new Error('Executed price is required.');
  if (!String(form.elements.executed.value || '').trim()) throw new Error('Executed quantity is required.');
  const price = parseFixed(form.elements.price.value);
  const qty = parseFixed(form.elements.executed.value);
  if (price <= 0n) throw new Error('Executed price must be greater than zero.');
  if (qty <= 0n) throw new Error('Executed quantity must be greater than zero.');
  updateManualCalculations(form);
  if (!String(form.elements.total.value || '').trim()) throw new Error('Total quote value could not be calculated.');
  if (!String(form.elements.fee.value || '').trim() && !String(form.elements.feeOverride.value || '').trim()) throw new Error('Fee could not be calculated. Check the pair, price, and quantity.');
}

function manualFormToTransaction(form) {
  validateManualForm(form);
  const data = new FormData(form);
  const dateValue = String(data.get('date') || '').replace('T', ' ');
  const feeOverride = String(data.get('feeOverride') || '').trim();
  return normalizeTransaction({
    date: dateValue.length === 16 ? `${dateValue}:00` : dateValue,
    id: data.get('id'),
    pair: data.get('pair'),
    type: data.get('type'),
    side: data.get('side'),
    price: data.get('price'),
    executed: data.get('executed'),
    total: data.get('total'),
    fee: feeOverride || data.get('fee')
  }, 'manual');
}

function setupInstallFlow() {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    $('installBtn').hidden = false;
  });
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (ios && !standalone) $('installBtn').hidden = false;

  $('installBtn').addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      $('installBtn').hidden = true;
      return;
    }
    if (ios) alert('On iPhone/iPad: open the Share menu, choose “Add to Home Screen”, then confirm Add.');
    else alert('Use your browser menu and choose Install app / Add to Home screen.');
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Service worker registration failed:', error));
  }
}

async function init() {
  if (window.top !== window.self) {
    document.body.textContent = 'Trade Vault cannot run inside an embedded frame.';
    return;
  }
  if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(location.hostname)) {
    document.body.textContent = 'Trade Vault requires HTTPS (or localhost) so Web Crypto and PWA protections are available.';
    return;
  }
  if (!window.crypto?.subtle || !window.indexedDB) {
    document.body.innerHTML = '<main class="unsupported-browser"><h1>Unsupported browser</h1><p>This app requires Web Crypto and IndexedDB.</p></main>';
    return;
  }
  db = await openDb();
  const exists = await vaultExists();
  $('createVaultPanel').hidden = exists;
  $('unlockVaultPanel').hidden = !exists;
  setupInstallFlow();
  registerServiceWorker();
  $('themeToggleBtn').addEventListener('click', toggleTheme);
  $('gateThemeBtn').addEventListener('click', toggleTheme);

  ['pointerdown', 'keydown', 'touchstart'].forEach(name => document.addEventListener(name, resetIdleTimer, { passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      stopMarketData({ clearPrices: false, resetStatus: true });
    } else if (vaultKey && hiddenAt && Date.now() - hiddenAt > 60_000) {
      lockVault();
      toast('Vault locked after being backgrounded.');
    } else if (vaultKey) {
      syncMarketData(true);
    }
    hiddenAt = document.hidden ? hiddenAt : 0;
  });
  window.addEventListener('offline', () => {
    if (!vaultKey) return;
    stopMarketData({ clearPrices: false, resetStatus: false });
    updateMarketStatus('Offline · showing last in-memory bids');
  });
  window.addEventListener('online', () => {
    if (vaultKey && livePricingEnabled && !document.hidden) syncMarketData(true);
  });
  window.addEventListener('pagehide', () => { stopMarketData({ clearPrices: true }); vaultKey = null; transactions = []; analyticsCache = null; clearSensitiveUi(); });
  window.addEventListener('pageshow', () => { if (!vaultKey && !$('appShell').hidden) lockVault(); });

  $('createVaultBtn').addEventListener('click', async () => {
    const btn = $('createVaultBtn');
    const pass = $('newPassphrase').value;
    const confirmPass = $('confirmPassphrase').value;
    if (pass.length < 16) return toast('Use at least 16 characters for the vault passphrase.');
    if (pass !== confirmPass) return toast('Passphrases do not match.');
    try {
      setBusy(btn, true, 'Creating vault…');
      await createVault(pass);
      $('newPassphrase').value = '';
      $('confirmPassphrase').value = '';
      toast('Encrypted vault created.');
    } catch (error) { console.error(error); toast(error.message || 'Could not create vault.'); }
    finally { setBusy(btn, false); }
  });

  $('unlockVaultBtn').addEventListener('click', async () => {
    const btn = $('unlockVaultBtn');
    try {
      setBusy(btn, true, 'Unlocking…');
      await unlockVault($('unlockPassphrase').value);
      $('unlockPassphrase').value = '';
    } catch (error) { console.error(error); toast(error.message === 'The operation failed for an operation-specific reason' ? 'Incorrect passphrase.' : (error.message || 'Could not unlock vault.')); }
    finally { setBusy(btn, false); }
  });

  $('unlockPassphrase').addEventListener('keydown', event => { if (event.key === 'Enter') $('unlockVaultBtn').click(); });
  $('lockBtn').addEventListener('click', lockVault);

  document.querySelectorAll('[data-view-target]').forEach(button => button.addEventListener('click', () => setView(button.dataset.viewTarget)));
  window.addEventListener('hashchange', () => { if (vaultKey) setView(currentViewFromHash(), false); });
  window.addEventListener('popstate', () => { if (vaultKey) setView(currentViewFromHash(), false); });
  const openManual = () => { setManualMode(null); $('manualDialog').showModal(); };
  $('ledgerAddBtn').addEventListener('click', openManual);
  $('floatingAddBtn').addEventListener('click', openManual);

  const handleCsvInput = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try { await importCsvFile(file); updateManualCalculations(); }
    catch (error) { console.error(error); toast(error.message || 'CSV import failed.'); }
    finally { event.target.value = ''; }
  };

  $('csvInput').addEventListener('change', handleCsvInput);
  $('ledgerCsvInput').addEventListener('change', handleCsvInput);


  $('searchInput').addEventListener('input', renderTransactions);
  $('sideFilter').addEventListener('change', renderTransactions);
  $('selectAllVisible').addEventListener('change', event => {
    const visible = filteredTransactions();
    for (const tx of visible) {
      if (event.currentTarget.checked) selectedRecordKeys.add(tx._recordKey);
      else selectedRecordKeys.delete(tx._recordKey);
    }
    renderTransactions();
  });
  $('selectVisibleBtn').addEventListener('click', () => {
    const visible = filteredTransactions();
    const allSelected = visible.length > 0 && visible.every(tx => selectedRecordKeys.has(tx._recordKey));
    for (const tx of visible) {
      if (allSelected) selectedRecordKeys.delete(tx._recordKey);
      else selectedRecordKeys.add(tx._recordKey);
    }
    renderTransactions();
  });
  $('deleteSelectedBtn').addEventListener('click', async () => {
    const keys = [...selectedRecordKeys].filter(key => transactions.some(tx => tx._recordKey === key));
    if (!keys.length) return;
    if (!confirm(`Delete ${keys.length} selected transaction${keys.length === 1 ? '' : 's'}?\n\nThis removes the encrypted local records and recalculates analytics.`)) return;
    const btn = $('deleteSelectedBtn');
    try {
      setBusy(btn, true, 'Deleting…');
      for (const key of keys) await deleteTransaction(key);
      renderAll();
      toast(`${keys.length} transaction${keys.length === 1 ? '' : 's'} deleted locally.`);
    } catch (error) {
      console.error(error);
      toast(error.message || 'Could not delete selected transactions.');
    } finally {
      setBusy(btn, false);
      updateSelectionUi();
    }
  });
  const handleSelectionChange = event => {
    const checkbox = event.target.closest('input[data-select-key]');
    if (!checkbox) return;
    if (checkbox.checked) selectedRecordKeys.add(checkbox.dataset.selectKey);
    else selectedRecordKeys.delete(checkbox.dataset.selectKey);
    renderTransactions();
  };
  $('transactionsBody').addEventListener('change', handleSelectionChange);
  $('transactionsCards').addEventListener('change', handleSelectionChange);
  $('marketToggleBtn').addEventListener('click', () => {
    livePricingEnabled = !livePricingEnabled;
    const toggle = $('marketToggleBtn');
    toggle.setAttribute('aria-pressed', String(livePricingEnabled));
    toggle.classList.toggle('active', livePricingEnabled);
    toggle.setAttribute('aria-label', livePricingEnabled ? 'Turn live pricing off' : 'Turn live pricing on');
    toggle.title = livePricingEnabled ? 'Live pricing on' : 'Live pricing off';
    if (livePricingEnabled) syncMarketData(true);
    else { stopMarketData({ clearPrices: true, resetStatus: false }); updateMarketStatus('Live pricing off'); renderHoldings(); }
  });
  $('marketRefreshBtn').addEventListener('click', () => {
    if (!livePricingEnabled) return toast('Turn live pricing on first.');
    syncMarketData(true);
  });
  const handleTransactionAction = async event => {
    const button = event.target.closest('button[data-action][data-key]');
    if (!button) return;
    const recordKey = button.dataset.key;
    const tx = transactions.find(item => item._recordKey === recordKey);
    if (!tx) return toast('Transaction was not found.');

    if (button.dataset.action === 'edit') {
      openEditTransaction(recordKey);
      return;
    }

    if (button.dataset.action === 'delete') {
      const label = `${tx.side} ${tx.pair} on ${shortDate(tx.date)}`;
      if (!confirm(`Delete ${label}?\n\nThis removes the encrypted local record and recalculates analytics.`)) return;
      try {
        button.disabled = true;
        await deleteTransaction(recordKey);
        renderAll();
        toast('Transaction deleted locally.');
      } catch (error) {
        console.error(error);
        toast(error.message || 'Could not delete transaction.');
      }
    }
  };
  $('transactionsBody').addEventListener('click', handleTransactionAction);
  $('transactionsCards').addEventListener('click', handleTransactionAction);
  $('openManualBtn').addEventListener('click', openManual);
  $('closeManualBtn').addEventListener('click', () => { editingRecordKey = null; $('manualDialog').close(); });
  $('cancelManualBtn').addEventListener('click', () => { editingRecordKey = null; $('manualDialog').close(); });
  $('manualForm').addEventListener('input', event => {
    setManualStatus('');
    updateManualCalculations(event.currentTarget);
  });
  $('manualForm').addEventListener('change', event => {
    setManualStatus('');
    updateManualCalculations(event.currentTarget);
  });
  $('manualForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('saveManualBtn');
    try {
      setBusy(button, true, 'Saving…');
      setManualStatus('');
      const tx = manualFormToTransaction(form);
      const duplicate = transactions.some(t => t.id === tx.id && t._recordKey !== editingRecordKey);
      if (duplicate) {
        if (!editingRecordKey) form.elements.id.value = makeUniqueKey('manual');
        throw new Error('Another transaction already uses this ID.');
      }

      if (editingRecordKey) {
        const original = transactions.find(item => item._recordKey === editingRecordKey);
        tx.source = original?.source || tx.source;
        tx.addedAt = original?.addedAt || tx.addedAt;
        tx.updatedAt = new Date().toISOString();
        await updateTransaction(editingRecordKey, tx);
      } else {
        await saveTransaction(tx);
      }

      const wasEditing = Boolean(editingRecordKey);
      editingRecordKey = null;
      form.reset();
      $('manualDialog').close();
      renderAll();
      toast(wasEditing ? 'Transaction updated locally.' : 'Transaction saved locally.');
    } catch (error) {
      console.error(error);
      const message = error.message || 'Could not save transaction.';
      setManualStatus(message, 'error');
      toast(message);
    } finally {
      setBusy(button, false);
    }
  });

  $('exportBtn').addEventListener('click', () => exportEncryptedBackup().catch(error => toast(error.message)));
  $('restoreInput').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try { await restoreEncryptedBackup(file); }
    catch (error) { console.error(error); toast(error.message || 'Restore failed.'); }
    finally { event.target.value = ''; }
  });

  $('clearBtn').addEventListener('click', async () => {
    const answer = prompt('This permanently removes the local vault and all encrypted transactions from this browser. Type CLEAR to continue.');
    if (answer !== 'CLEAR') return;
    await idbClear('records');
    await idbClear('meta');
    stopMarketData({ clearPrices: true });
    selectedRecordKeys.clear();
    vaultKey = null;
    transactions = [];
    $('appShell').hidden = true;
    $('vaultGate').hidden = false;
    $('createVaultPanel').hidden = false;
    $('unlockVaultPanel').hidden = true;
    toast('Local vault cleared.');
  });
}

init().catch(error => {
  console.error(error);
  alert(`Trade Vault could not start: ${error.message}`);
});
