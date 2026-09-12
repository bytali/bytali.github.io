# Trade Vault

A lightweight, local-first crypto trade tracker built as a static PWA.

## What it does

- Imports the exchange CSV format used by the app.
- Supports manual add/edit/delete and bulk delete, with optional encrypted transaction notes and a Trading / Long-term purpose bucket.
- Provides separate general BUY and SELL fee percentages for newly created manual transactions (0.1% defaults); existing stored fees are left unchanged.
- Calculates holdings and weighted-average realized P&L locally, with Trading and Long-term inventory accounted for separately.
- Shows current PHP inventory value from the public Coins.ph `@ticker` WebSocket when live pricing is toggled on; the last traded price drives valuation while the current best sell bid remains visible in holding details.
- Stores transaction records (including notes) encrypted in IndexedDB using AES-256-GCM.
- Supports automatic passphrase unlock after typing and an optional 4-digit local PIN convenience unlock.
- Supports configurable 1–120 minute auto-lock.
- Can fill transaction fields from copied order-detail text. Users can copy text with Google Lens, iOS Live Text, or another device feature, then paste it into Trade Vault. Trade Vault does not upload or store the source image and parses only the pasted text locally.
- Keeps the derived vault key in memory only while unlocked.
- Works as a GitHub Pages site and can be installed as a PWA, with text-free iOS/Android install artwork.
- Includes persistent light/dark UI themes; first launch follows the device preference.

## Views

- `#overview` — separate Trading / Long-term dashboards. Trading shows realized performance quality (win rate, profit factor, expectancy, drawdown, average win/loss, open live P&L and cumulative realized P&L); Long-term shows market value, cost basis, unrealized return, accumulation and allocation.
- `#holdings` — open inventory split into Trading and Long-term sub-views, with fresh market price, best sell bid, PHP value and unrealized P&L.
- `#ledger` — searchable/manageable transaction history.

The views are client-side routes in one HTML page. This avoids reloading the document and losing the in-memory vault key when navigating.

## GitHub Pages

This repo is intentionally small. Publish the repository root with GitHub Pages:

1. Push these files to a repository.
2. Open **Settings → Pages**.
3. Choose **Deploy from a branch**.
4. Select `main` and `/ (root)`.
5. Enable HTTPS.

No build step or backend is required.

## Public repo files

Runtime files:

- `index.html`
- `styles.css`
- `app.js`
- `sw.js`
- `manifest.webmanifest`
- `icons/`
- `.nojekyll`
- `sample-trades.csv` — randomly generated synthetic demo rows only

Developer context:

- `README.md`
- `AI_HANDOFF.md`

## Security boundary

A 4-digit PIN is intentionally a convenience credential and is weaker than the vault passphrase. The PIN wrapper stays on the local device and is excluded from encrypted backups; the passphrase remains the recovery credential.


The vault is designed to reduce exposure, not make a compromised browser/device safe.

- Records are encrypted before being written to IndexedDB.
- The passphrase is not stored.
- PBKDF2-HMAC-SHA-256 uses 600,000 iterations.
- Each record uses a fresh AES-GCM IV and record-bound authenticated data.
- Live prices are kept in memory only.
- Network access is restricted by CSP to same-origin resources and the public Coins.ph WebSocket. No cross-origin REST market request is used.
- No exchange API key, account endpoint, analytics SDK, CDN, external font or third-party JavaScript is used.
- The vault automatically locks after inactivity and after extended backgrounding.

GitHub Pages cannot supply every custom response security header. Protect the GitHub account/repository itself with strong authentication, branch protection where appropriate, and careful review of changes to `app.js`, because a malicious deployed script could access plaintext while the vault is unlocked.

## Local development

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://127.0.0.1:8080`.

## Data note

The included sample is synthetic and regenerated for development/demo use. It is not based on the user's uploaded trading history.

- 2026-09-11 hotfix: hardened event bindings against stale/mixed PWA shells and changed navigation caching to network-first with build-versioned assets. This does not alter IndexedDB vault data or encrypted backup compatibility.

- 2026-09-11 history/holdings update: compact expandable mobile history rows, Expand/Collapse all, net-acquired copy action, and separate Trading / Long-term holding pools. Existing records and CSVs without a Purpose field default to Trading; encrypted backup v1 remains compatible.

- 2026-09-11 overview analytics update: the Overview now has Trading and Long-term tabs with purpose-specific performance/portfolio metrics. Live valuation reuses the existing opt-in Coins.ph public quote stream; no additional third-party service or persisted market data was added.

- 2026-09-12 live-bid fix: live pricing now seeds each open PHP holding from Coins.ph public `bookTicker` HTTPS data, then uses the existing WebSocket for real-time updates with a 30-second Coins.ph-only snapshot fallback. Reconnects preserve the last in-memory bid instead of blanking it. No API key or persisted market data was added; encrypted backup v1 remains unchanged.

- Ledger compact BUY summaries now show **Total spent** (quote currency) directly under **Net acquired**.

### Build consistency hotfix (2026-09-12)
The app shell is now build `2026.09.12.3`. The HTML build marker, JavaScript `APP_BUILD`, versioned asset URLs, and service-worker cache were synchronized to prevent a false “app update did not finish cleanly” startup error.


- 2026-09-13 live-pricing/holdings update: Coins.ph batch snapshot failures now isolate unsupported symbols instead of blocking all bids; the live stream excludes rejected pairs and manual refresh revalidates them. Mobile Holdings cards are compact/collapsible with per-card and Expand all/Collapse all controls. Closed/zero holdings are omitted from the Holdings list.

- 2026-09-13 WebSocket-only pricing fix: removed browser REST snapshot/fallback calls that can fail CORS. Live pricing now uses Coins.ph `@ticker` streams only, values holdings from fresh last-trade price, shows best bid separately, and expires/reconnects stale quotes.

## Build 2026.09.13.3 — raw WebSocket live pricing

Live market pricing now follows the same browser-safe raw WebSocket pattern as the supplied working local price monitor. Each PHP holding opens its own public Coins.ph raw ticker stream at `wss://wsapi.pro.coins.ph/openapi/quote/ws/v3/<symbol>@ticker`; no market-data REST request is required. This avoids browser CORS failures on Coins.ph REST endpoints and isolates reconnects so a problem with one symbol does not interrupt the other holdings. Ticker payload `c` is used as the market/last traded price and `b` remains the sell bid. Connections send the documented JSON ping before the five-minute server timeout, reconnect independently with backoff, and quotes expire after 20 seconds without a ticker update. Market quotes remain memory-only and are never added to vault storage or backups.
