# Trade Vault

A lightweight, local-first crypto trade tracker built as a static PWA.

## What it does

- Imports the exchange CSV format used by the app.
- Supports manual add/edit/delete and bulk delete, with optional encrypted transaction notes.
- Provides separate general BUY and SELL fee percentages for newly created manual transactions (0.1% defaults); existing stored fees are left unchanged.
- Calculates holdings and weighted-average realized P&L locally.
- Shows current PHP inventory value using the public Coins.ph `bookTicker` WebSocket when live pricing is toggled on; live pricing starts off on each app load.
- Stores transaction records (including notes) encrypted in IndexedDB using AES-256-GCM.
- Supports automatic passphrase unlock after typing and an optional 4-digit local PIN convenience unlock.
- Supports configurable 1–120 minute auto-lock.
- Can parse supported order-detail screenshot text locally when the browser exposes `TextDetector`; otherwise users can paste device-extracted text (for example iOS Live Text) with no upload.
- Keeps the derived vault key in memory only while unlocked.
- Works as a GitHub Pages site and can be installed as a PWA, with text-free iOS/Android install artwork.
- Includes persistent light/dark UI themes; first launch follows the device preference.

## Views

- `#overview` — summary metrics and cost-basis allocation.
- `#holdings` — open inventory, live bid, PHP value and unrealized P&L.
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
- Network access is restricted by CSP to same-origin resources and the public Coins.ph WebSocket.
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
