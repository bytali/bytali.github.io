# Changelog

## 2026-08-17 — Budget card accordions + projected-funds save guard

- Added native show/hide accordions to every card on the Budget screen, including KPI cards, Monthly funds, and Monthly plan.
- Added a hard guard on Save category budget when projected funds are set: the proposed projected-plan total must remain strictly below the projected monthly funds.
- The guard correctly replaces an existing category allocation during validation instead of double-counting it.
- Kept the existing confirmation step for updating an already-existing category budget after validation passes.
- Bumped the offline app-shell cache for installed PWA updates.

## 2026-08-16 — Projected funds + budget detail update

- Added projected monthly funds as a planning-only month total.
- Added current-funds and projected-funds allocation percentages, including total percentage allocated for each base.
- Fixed/manual category amounts now show percentage conversions against both current and projected funds.
- Added optional monthly category descriptions and preserved them in copy, clear, backup, restore, and merge flows.
- Added Sports Leisure as a built-in expense/budget category.
- Changed Budget vs actual rows into compact accordions on mobile while keeping them expanded by default on larger screens.
- Added confirmation before updating a category budget that already exists for the selected month.
- Bumped the offline app-shell cache so installed copies can receive the updated shell.

## 2026-08-16 — Percentage allocation update

- Added percentage-based category allocations tied to monthly recorded funds.
- Kept the manual amount allocation input for fixed budgets.
- Percentage and amount inputs synchronize while editing; the edited field determines the saved mode.
- Percentage allocations automatically recalculate when monthly fund entries change.
- Added `settings.categoryBudgetPercents` additively while preserving schema v1 and existing amount budgets.
- Updated copy, clear, edit, delete, full backup, Budget + funds backup, restore, and merge behavior for both allocation modes.
- Added percentage-mode labels to Budget and Budget-vs-Actual analytics.
- Added waiting-for-funds handling when a percentage allocation is saved before monthly funds are recorded.
- Bumped the offline app-shell cache so installed copies receive the updated `index.html`.

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

## 2026-08-17 — Category ordering and expense category update

- Added drag-and-drop reordering for Budget > Plan categories, including touch/pointer support.
- Persisted category order per month and included it in backup/restore.
- Added Expense categories `Leisure` and `Misc`.
- Removed `Sports Leisure` from the built-in category list while preserving existing legacy records and budgets.
- Bumped the offline app-shell cache to `pocket-plan-shell-v5`.
