# Changelog

## 2026-08-16 — Funds + installable web app update

- Added monthly funds/inflow tracking in Budget.
- Added built-in fund sources: Salary, Payout / Bonus, Side income, Reimbursement, Miscellaneous, and custom sources.
- Added monthly Funds, Allocated, Unallocated/Overallocated, and Spent summary metrics.
- Added an allocation guide showing how recorded funds compare with category allocations.
- Added fund entry add/edit/delete support with date and optional note.
- Added funds to Home analytics and six-month context.
- Added alerts when the monthly plan exceeds recorded funds or spending exceeds recorded funds.
- Added funds to full backup/restore and to the separate Budget + funds JSON export/restore scope.
- Preserved compatibility with older full and budget backups that do not contain funds.
- Added `manifest.webmanifest`, Apple touch icon, Android 192/512 icons, maskable icon, favicon, and `sw.js`.
- Added offline app-shell caching with no remote runtime dependency.
- Added `.gitignore` entries for `.DS_Store` and personal financial exports.

## 2026-08-16 — Category budget redesign

- Replaced the primary General + Health cap experience with monthly category budgets.
- Added Groceries, Investment, Mortgage, and Travel.
- Removed Education from the built-in picker while retaining existing/custom Education data.
- Converted expense Note to a multiline textarea.
- Added budget-vs-actual analytics, spending pace, plan coverage, unbudgeted spending, and 3-month actual-average suggestions.
- Added Privacy mode to hide displayed monetary values.
- Added separate full, expense-only, and budget-only JSON backup flows.
- Hardened import dates, duplicate IDs, merge conflict handling, CSV formula injection, and legacy bankless-card editing.
