# Changelog

## 2026-08-16

- Replaced the main General + Health budgeting UI with monthly category budgets.
- Added a dedicated Budget navigation view.
- Added Groceries, Investment, Mortgage, and Travel built-in categories.
- Removed Education from the built-in category picker while preserving older Education records as custom categories.
- Converted expense Note to a multiline textarea and increased sanitized note length to 500 characters.
- Redesigned Home analytics around planned vs actual, remaining, pace, unbudgeted spending, category share, payment share, credit-card bank usage, and six-month plan context.
- Added three-month actual-spending averages as optional budget suggestions.
- Added Copy Previous Month and Clear Month Plan actions.
- Added privacy mode / hide amounts toggle in the top bar and More settings.
- Added separate Expenses JSON and Budgets JSON exports while retaining full JSON backup and CSV export.
- Added scope-aware JSON restore behavior.
- Kept `expense-tracker.v1` and schema version 1.
- Added additive migration of old General/Health budgets into category-budget compatibility entries.
- Fixed editing of legacy bank-based expenses that do not have a saved bank.
- Hardened imported expense IDs against duplicates.
- Made expense merge conflicts prefer the newest `updatedAt`.
- Made category-budget merge preserve categories on both sides of the same month.
- Added real calendar validation for imported dates/months.
- Added CSV spreadsheet-formula hardening.
- Added CSP/referrer privacy hardening and retained a no-backend/no-third-party architecture.
