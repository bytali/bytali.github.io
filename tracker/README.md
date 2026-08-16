# Pocket Plan

Pocket Plan is a static, local-first monthly budget, funds, and expense tracker designed for GitHub Pages.

## What it tracks

- Money received each month: salary, payout/bonus, side income, reimbursement, miscellaneous, or custom sources
- Category allocations for the month
- Unallocated or overallocated funds
- Expenses by category, payment method, and credit-card bank
- Budget vs actual spending and spending pace
- Six-month funds / plan / spending context

## Privacy

There is no backend, account system, analytics SDK, cloud database, or third-party JavaScript/CSS library. Financial data is stored in the browser under the existing `expense-tracker.v1` localStorage key.

Privacy mode hides displayed monetary amounts but does not encrypt localStorage. Use the JSON backup tools for durable backups.

## Install on a phone

Deploy the folder over HTTPS, such as GitHub Pages.

- iPhone/iPad: open in Safari, Share, then **Add to Home Screen**.
- Android/Chromium: use **Install app** / **Add to Home screen** when offered by the browser.

The package includes a web app manifest, Apple touch icon, Android icons including a maskable icon, and a service worker that caches only the local app shell for offline use after the first successful visit.

## Deployment

Publish the contents of this folder as-is. No build step is required.

Main file: `index.html`
