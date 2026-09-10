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
- `icons/`: install icons (180px iOS touch icon plus 192px/512px PWA icons; artwork is graphical and contains no “TV” text).
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

The user's passphrase is never persisted. `vaultKey`, decrypted `transactions`, `analyticsCache`, and live market prices are memory state and are cleared on lock/pagehide. An optional 4-digit PIN can wrap the derived 256-bit vault key in local `meta/pin`; it is device-local, is not exported, and deliberately trades security strength for convenience. The passphrase remains the recovery credential.

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
- `notes` (optional, encrypted with the record)
- `addedAt`

Decimal trade arithmetic uses fixed-point `BigInt` with 18 decimal places. Do not replace accounting arithmetic with JavaScript `Number` unless only formatting/chart ratios are involved.

## CSV contract

Expected headers:

`Date,ID,Pair,Type,Side,Executed Price,Executed,Total,Fee`

The parser preserves IDs as text and validates numeric fields.

Fee behavior:

- General settings contain separate BUY and SELL fee percentages. Both default to 0.1%.
- The settings apply only to newly created manual transactions; stored transaction fee values are never retroactively rewritten.
- BUY fees are calculated as a percentage of acquired base quantity and charged in the base asset.
- SELL fees are calculated as a percentage of quote proceeds and charged in the quote asset.
- The user can override the calculated fee with the exchange-reported actual fee.
- Fee and auto-lock settings are non-sensitive local metadata in IndexedDB (`meta/settings`) and are not included in encrypted backup format v1.
- PIN wrapping metadata is stored separately at `meta/pin`; encrypted backup restore removes any stale local PIN wrapper so it cannot point at a different restored vault.

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

Live pricing starts OFF on every app load. The user can explicitly toggle it on from Holdings.

When enabled, the app subscribes only to open `*/PHP` holdings using `<symbol>@bookTicker` streams.

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

## Screenshot-assisted entry

Manual entry can optionally read order-detail screenshots using the browser's native `TextDetector` API when exposed. The app performs no image upload or network request and discards the chosen file after parsing. Because native text recognition is not broadly available across browsers, the UI also supports pasting text extracted by the operating system (for example, iOS Live Text). No OCR library/model is bundled.

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

The service worker serves a versioned cached shell immediately when available and refreshes it in the background. This avoids slow/offline PWA launches getting stuck on the platform splash icon. Bump the cache name whenever shipping runtime changes so installed versions update cleanly.

The service worker must never cache user transaction exports/backups or market responses.

## Release checklist

- `node --check app.js`
- validate `manifest.webmanifest` JSON
- verify every `$('<id>')` reference exists in `index.html`
- check duplicate HTML IDs
- verify every service-worker shell path exists
- test create/unlock/lock vault, including automatic passphrase unlock and 4-digit PIN unlock
- test setting/changing PIN on an existing vault and passphrase fallback
- test configurable auto-lock at a short interval and after backgrounding
- test manual live total/fee calculation, leading-decimal autocorrection, notes, and save
- test screenshot-text parsing with a representative order detail; test native `TextDetector` only on a browser that exposes it
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

- 2026-09-11 hotfix: hardened event bindings against stale/mixed PWA shells and changed navigation caching to network-first with build-versioned assets. This does not alter IndexedDB vault data or encrypted backup compatibility.
