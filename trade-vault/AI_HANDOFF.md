# AI Handoff — Trade Vault

## Product intent

Trade Vault is a minimal, browser-only crypto transaction tracker. It is meant to be hosted as static files (including GitHub Pages), installed as a PWA, and keep the user's transaction ledger encrypted on the user's device.

There is no application backend and no user account system.

## Current UX

The app has three client-side pages implemented as hash-routed views inside `index.html`:

- `#overview`: transaction count, buy volume, known PHP fees, realized P&L, cost-basis allocation.
- `#holdings`: open inventory, quantity, average cost, cost basis, live Coins.ph best bid, current PHP value, unrealized P&L.
- `#ledger`: search/filter, select/bulk-delete, edit/delete, CSV import, encrypted backup/restore, vault clearing.

A floating bottom menu navigates between the three views and opens manual transaction entry. Main app actions are icon buttons with accessible `aria-label`/`title` text.

The UI supports light and dark themes. On first launch it follows `prefers-color-scheme`; once the user toggles the theme, only the non-sensitive string `light`/`dark` is persisted in `localStorage` under `trade-vault-theme`. Theme state is intentionally separate from the encrypted transaction vault.

On screens <= 760 px, holdings and ledger switch from desktop tables to card layouts. Do not reintroduce horizontally scrolling transaction tables on mobile.

## Files

- `index.html`: app shell, dialogs, SVG icon sprite, PWA/CSP metadata.
- `styles.css`: complete responsive UI; no external stylesheet/framework.
- `app.js`: crypto, IndexedDB, parser, accounting, UI rendering, transaction management, client-side routing, Coins.ph WebSocket.
- `sw.js`: small offline shell cache.
- `manifest.webmanifest`: PWA metadata.
- `icons/`: install icons.
- `sample-trades.csv`: synthetic demo data only.
- `.nojekyll`: GitHub Pages compatibility.

No build tooling is required.

## Vault/storage model

IndexedDB database: `trade-vault-db`, version 1.

Stores:

- `meta`: vault metadata/verifier.
- `records`: independently encrypted transaction records.

KDF:

- PBKDF2-HMAC-SHA-256
- 600,000 iterations
- random 16-byte salt

Encryption:

- AES-256-GCM
- random 12-byte IV per encryption
- version-2 records authenticate their record key via AAD `trade-vault-record-v2:<recordKey>`
- Web Crypto key is non-exportable

The user's passphrase is never persisted. `vaultKey`, decrypted `transactions`, `analyticsCache`, and live market prices are memory state and are cleared on lock/pagehide.

## Transaction schema

Normalized transaction fields include:

- `date`
- `id` (always string; exchange IDs can exceed JS safe integer range)
- `pair`
- `base`
- `quote`
- `type`
- `side` (`BUY` / `SELL`)
- `price`
- `executed`
- `total`
- `feeAmount`
- `feeAsset`
- `feeInferred`
- `source`
- `addedAt`

Decimal trade arithmetic uses fixed-point `BigInt` with 18 decimal places. Do not replace accounting arithmetic with JavaScript `Number` unless only formatting/chart ratios are involved.

## CSV contract

Expected headers:

`Date,ID,Pair,Type,Side,Executed Price,Executed,Total,Fee`

The parser preserves IDs as text and validates numeric fields.

Fee behavior learned from CSV history:

- BUY examples generally charge a percentage of acquired base quantity in the base asset.
- SELL examples generally charge a percentage of quote proceeds in the quote asset.
- Manual entry infers BUY and SELL fee profiles separately from imported CSV rows.
- If there is insufficient history, the synthetic fallback is 0.12% with the same base/quote convention.
- The user can override the calculated fee with the exchange-reported actual fee.

## Accounting

`analyzeTransactions()` processes transactions chronologically and maintains inventory state per pair/asset.

Current method: weighted-average cost.

Important behavior:

- BUY increases inventory and cost.
- Base-asset BUY fees reduce acquired quantity.
- SELL removes quantity at weighted-average cost.
- Quote-asset SELL fees reduce proceeds.
- Sells without enough earlier inventory are flagged and excluded from reliable realized P&L.
- Price × quantity vs exported total mismatches are flagged rather than silently rewritten.

## Live Coins.ph valuation

`MARKET_WS_BASE` points to the public Coins.ph quote WebSocket:

`wss://wsapi.pro.coins.ph/openapi/quote/stream?streams=`

The app subscribes only to open `*/PHP` holdings using `<symbol>@bookTicker` streams.

Use the best bid as the current PHP liquidation-oriented value:

`PHP value = open net quantity × best bid`

Only pair symbols are sent. Transaction IDs, quantities, cost basis, history, passphrase, and encrypted records are never sent to Coins.ph.

Market data is held in `marketPrices` memory only and is not backed up or written to IndexedDB.

Do not add authenticated Coins.ph endpoints or API keys without an explicit product decision and threat-model update.

## Client-side routing

`setView(view)` toggles elements with `data-page` and updates the hash to one of:

- `#overview`
- `#holdings`
- `#ledger`

This is deliberately not multiple HTML files: a full navigation would destroy the in-memory vault key and force an unlock on every page change.

## Transaction management

The ledger supports:

- search
- BUY/SELL filter
- select visible / clear visible selection
- bulk delete
- edit
- delete
- CSV import
- encrypted backup / restore
- clear vault

Desktop and mobile renderers share the same event delegation and record keys. When changing transaction actions, update both table and card markup.

## Security rules for future changes

1. Do not persist plaintext transactions, passphrases, derived keys, or live prices.
2. Do not add third-party JS/CDN dependencies casually; deployed JavaScript executes inside the unlocked vault origin.
3. Keep CSP network access narrow. Current external allowance is only the Coins.ph public WebSocket.
4. Do not add telemetry that can reveal portfolio assets or usage.
5. Any change to record encryption needs backward migration support.
6. Keep sensitive UI state cleared on lock/pagehide.
7. Assume a malicious browser extension, compromised OS, or malicious deployed update can defeat browser-side confidentiality while unlocked; do not claim otherwise.
8. For a public GitHub repo, repository/account security is part of the application threat model.

## PWA/service worker

The service worker is network-first for same-origin shell files with cached fallback. Bump the cache name whenever shipping runtime changes so installed versions update cleanly.

The service worker must never cache user transaction exports/backups or market responses.

## Release checklist

- `node --check app.js`
- validate `manifest.webmanifest` JSON
- verify every `$('<id>')` reference exists in `index.html`
- check duplicate HTML IDs
- verify every service-worker shell path exists
- test create/unlock/lock vault
- test manual live total/fee calculation and save
- test CSV import and duplicate handling
- test edit/delete/bulk-delete
- test encrypted backup/restore
- test mobile card layouts at 390 px and 430 px widths
- test desktop tables
- test hash navigation without page reload
- test Coins.ph WebSocket on the deployed HTTPS origin
- test PWA install/update on Android and iOS Safari/Home Screen

## Known environment limitation during the latest handoff

Static syntax/structure checks can run in the current sandbox, but its Chromium policy blocks localhost navigation (`ERR_BLOCKED_BY_ADMINISTRATOR`). Run the end-to-end browser checklist in a normal local browser or the deployed GitHub Pages origin before treating a release as production-ready.
