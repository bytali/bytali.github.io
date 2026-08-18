# POCKET PLAN — BUDGET + FUNDS + EXPENSE TRACKER HANDOFF

## CURRENT VERSION

Updated: 2026-08-19

Pocket Plan is a static, local-first monthly money tracker designed for GitHub Pages and modern mobile/desktop browsers.

The Checklist screen uses separate cards for its overview, `#checklistForm`, and `#checklistList`. Nested `.checklist-children` are intentionally compact on small screens, and action buttons favor SVG icons on mobile while keeping accessible labels/titles and desktop text where useful.

Appearance supports a persistent manual light/dark toggle. Until the user explicitly chooses a mode, the app follows the device color-scheme preference. Checklist child items derive their displayed amount automatically from the parent target (`parent amount / number of children`); child forms do not accept separate amounts, and legacy child amounts are ignored.

Primary files:

- `index.html`
- `manifest.webmanifest`
- `sw.js`
- `apple-touch-icon.png`
- `icons/`

There is no build process, backend, account system, package manager, database, analytics SDK, remote API, or third-party JavaScript/CSS dependency.

## PRODUCT MODEL

The app now combines three concepts for each selected month:

1. **Funds received** — money available to plan, such as salary or side income.
2. **Projected funds** — an optional expected total for the selected month, used only for planning comparisons.
3. **Allocated budget** — category allocations assigned either as a percentage of monthly funds or as a fixed manual amount.
4. **Actual expenses** — money actually spent.

The central planning equation is:

```text
unallocated = funds received - allocated category budgets
```

If the result is negative, the plan is **overallocated**.

Category allocations support two modes:

```text
percentage allocation amount = funds received × allocation percent / 100
fixed allocation amount = manually entered amount
```

Percentage allocations are dynamic: when fund entries for that month change, the calculated budget amount changes with them. Fixed/manual allocations do not change when funds change. The editor keeps both Percentage and Manual amount inputs visible; the field edited last determines which mode is saved. A fixed amount shows its percentage against both current received funds and projected funds. The Budget screen also reports total allocation percentage against both bases. Every Budget-screen card is wrapped in a native `details` accordion so users can independently show or hide KPI cards, Monthly funds, and Monthly plan.

When projected funds are set for a month, **Save category budget is hard-blocked if the proposed projected-plan total would be equal to or greater than projected funds**. Validation treats an edit as replacement of that category's existing allocation, so the previous value is not double-counted. The existing duplicate-category confirmation is shown only after this limit validation passes.

Category budget status remains:

```text
category remaining = calculated/fixed category budget - category spending
```

Total monthly actual spending is independent of the plan:

```text
total spent = sum of all selected-month expenses
```

This deliberately separates **planning money** from **spending records**. An expense does not automatically reduce the amount allocated to another category, and adding funds does not create an expense.

## WHY THIS MODEL

The design follows a lightweight envelope / assign-your-money pattern rather than a single monthly expense ceiling.

Relevant documented practices used for the redesign:

- CFPB: a budget should bring income and spending together and should be grounded in actual spending/cash flow.
- Actual Budget: envelope budgeting assigns available income to categories and treats unassigned money separately.
- YNAB: incoming money enters a Ready-to-Assign pool before being assigned to categories; category targets help compare expected needs with available income.

Reference material:

- https://www.consumerfinance.gov/consumer-tools/educator-tools/your-money-your-goals/toolkit/
- https://www.consumerfinance.gov/owning-a-home/prepare/assess-your-spending/
- https://actualbudget.org/docs/getting-started/envelope-budgeting/
- https://actualbudget.org/docs/budgeting/
- https://support.ynab.com/en_us/assigning-your-money-a-guide-SypgkrNJi
- https://support.ynab.com/en_us/getting-started-with-targets-ryAEP08xC

Pocket Plan does **not** attempt bank syncing, account reconciliation, automatic investment pricing, or automatic rollover. Those would materially increase complexity and privacy/security surface.

## MONTHLY FUNDS / INFLOWS

Funds are stored as individual entries so multiple paydays or income sources can be represented accurately.

Built-in source choices:

- Salary
- Payout / Bonus
- Side income
- Reimbursement
- Miscellaneous
- Other

`Side income` is the preferred general term for extra work, freelance work, or a sideline.

Approximate record:

```json
{
  "id": "unique-id",
  "amount": 45000,
  "source": "Salary",
  "date": "2026-08-15",
  "note": "August payroll",
  "createdAt": "2026-08-15T01:00:00.000Z",
  "updatedAt": "2026-08-15T01:00:00.000Z"
}
```

Funds are additive to schema v1. Old localStorage and old backups without `inflows` sanitize to an empty array.

### Projected funds

Projected funds are stored as a month-level planning amount under `settings.projectedFunds`. They represent the expected **total** funds for the month, not an additional received-funds entry. They do not create inflows or expenses. Percentage-based category allocations are evaluated against current funds for the live plan and against projected funds for projected comparison totals.

Example:

```json
{
  "2026-08": 70000
}
```

### Budget screen fund behavior

Users can:

- add funds
- edit funds
- delete funds
- use a custom source
- enter the date funds were received
- add an optional note

The selected month displays only fund entries whose `date` belongs to that month.

The Budget screen shows:

- Funds received
- Allocated
- Unallocated / overallocated
- Spent
- allocation progress
- individual fund entries
- individual category budgets

Users can still create category budgets before adding fund entries. In that case the plan is treated as a plan-only month until funds are recorded.

## MONTHLY CATEGORY BUDGETS

Fixed/manual category budgets are stored under:

```text
settings.categoryBudgets
```

Percentage-based allocations are stored separately under:

```text
settings.categoryBudgetPercents
```

Keeping percentage targets separate preserves compatibility with older amount-only schema-v1 data while allowing percentage allocations to recalculate from monthly funds. If the same category is encountered in both maps during sanitization, the percentage allocation is treated as authoritative.

Example:

```json
{
  "2026-08": {
    "Groceries": 12000,
    "Transport": 5000,
    "Health": 6000,
    "Mortgage": 25000,
    "Investment": 8000,
    "Travel": 4000
  }
}
```

Example percentage allocations:

```json
{
  "2026-08": {
    "Groceries": 15,
    "Transport": 8,
    "Investment": 10
  }
}
```

If August funds total 50,000, those examples calculate to 7,500 for Groceries, 4,000 for Transport, and 5,000 for Investment. Total percentages may exceed 100 across categories; the dashboard then reports an overallocated month. Each individual percentage is limited to 0–100.

Optional category descriptions are stored under `settings.categoryBudgetDescriptions` by month and category. They are display/context metadata only and do not affect calculations. Updating a category that already has a budget for the selected month requires confirmation before overwrite.

Plan-category display order is stored per month under `settings.categoryBudgetOrder`. Users can reorder Plan categories with a drag handle on desktop or touch devices. Copying the previous month's plan also copies its category order. Legacy categories remain valid even when removed from the built-in category list.

Built-in expense categories:

- Food
- Groceries
- Transport
- Bills
- Shopping
- Health
- Entertainment
- Leisure
- Misc
- Home
- Investment
- Mortgage
- Travel
- Other

`Education` is no longer a built-in choice, but older/custom Education expenses and budgets remain valid and are not rewritten or deleted.

### Unallocated is not an expense category

Do not create an automatic `Unallocated` expense category. Unallocated funds are a planning balance:

```text
funds received - allocated category budgets
```

This keeps leftover money visible instead of silently absorbing it into a catch-all category.

### Investment category

Investment is treated as a normal planned outflow category. If the user moves money to an investment account and wants that transfer reflected in monthly cash planning, they can record it as an expense in Investment.

## HOME ANALYTICS

The Home dashboard prioritizes actionable monthly questions.

Top-level metrics:

- Spent
- Funds
- Unallocated
- Plan left
- Projected spending
- Unbudgeted spending

Other analytics:

- Budget vs actual by category
- Attention / action items
- Daily spending
- Category share
- Payment-method share
- Credit-card bank usage
- Six-month funds / plan / spending context

### Attention logic includes

- plan exceeds recorded funds
- spending exceeds recorded funds
- money remains unallocated
- no funds have been recorded for an existing plan
- category is over budget
- current-month category spending is materially ahead of month progress
- spending exists in a category with no matching category budget

## THREE-MONTH SUGGESTION

The Budget editor calculates the average actual spend for the same category across the previous three months.

This is only a suggestion. It never overwrites a category budget automatically.

## INSTALL / HOME-SCREEN SUPPORT

The app now includes install metadata and icons.

### iPhone / iPad

`apple-touch-icon.png` is linked from `index.html` for Add to Home Screen behavior.

The web manifest is also linked. Apple supports manifest-provided Home Screen metadata in modern Safari, while the dedicated touch icon provides explicit Apple-specific coverage.

### Android / Chromium

`manifest.webmanifest` defines:

- name / short name
- start URL and scope
- standalone display
- theme/background colors
- 192px icon
- 512px icon
- 512px maskable icon

### Offline shell

`sw.js` caches only same-origin static app assets:

- page shell
- manifest
- icons

Navigation tries the network first and falls back to the cached `index.html` if offline. Other same-origin static assets use cache-first behavior.

The service worker does not send financial data anywhere.

Service workers require a secure context such as HTTPS (GitHub Pages is suitable) or localhost. They are intentionally not registered from `file://`.

Relevant platform references:

- https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html
- https://developer.apple.com/videos/play/wwdc2022/10048/
- https://web.dev/learn/pwa/web-app-manifest
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons

## STORAGE MODEL

Do not rename this key without explicit migration logic:

```text
expense-tracker.v1
```

Schema version remains:

```text
1
```

Approximate current state:

```json
{
  "schemaVersion": 1,
  "settings": {
    "currency": "PHP",
    "budgets": {},
    "healthBudgets": {},
    "categoryBudgets": {
      "2026-08": {
        "Mortgage": 25000
      }
    },
    "categoryBudgetPercents": {
      "2026-08": {
        "Groceries": 15,
        "Investment": 10
      }
    },
    "categoryBudgetDescriptions": {
      "2026-08": {
        "Bills": "electricity / water / internet"
      }
    },
    "projectedFunds": {
      "2026-08": 70000
    },
    "hideAmounts": false
  },
  "expenses": [],
  "inflows": [
    {
      "id": "...",
      "amount": 45000,
      "source": "Salary",
      "date": "2026-08-15",
      "note": "August payroll",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

Legacy `settings.budgets` and `settings.healthBudgets` remain preserved for compatibility with earlier schema-v1 backups.

When a state has no `categoryBudgets`, old General and Health budgets are migrated additively into category-budget behavior.

## EXPENSES

Expense records retain:

- id
- amount
- payment
- optional bank
- category
- date
- multiline note
- createdAt
- updatedAt

Expense Note maximum sanitized length is 500 characters.

## PAYMENT METHODS

Built-in methods:

- Cash
- GCash / E-wallet
- Debit card
- Credit card
- Bank transfer
- Other

Bank is required for newly created Debit card, Credit card, and Bank transfer expenses.

Older bank-based expenses without a bank remain editable without forcing the user to invent a bank value.

## BACKUP / RESTORE

### Full backup

Contains:

- settings
- fixed category budgets
- percentage category allocations
- legacy budget fields
- privacy setting
- expenses
- inflows/funds

### Expenses JSON

Contains expenses only plus source currency metadata.

### Budget + funds JSON

Uses backup kind:

```text
budgets
```

The name is retained for compatibility, but this scope now includes:

- fixed category budgets
- percentage category allocations
- legacy budget maps
- currency
- inflows/funds

Old `budgets` backups without `inflows` remain importable.

### Restore modes

Merge:

- expense conflicts use newer `updatedAt`
- fund conflicts use newer `updatedAt`
- fixed and percentage category-allocation maps merge by month/category; percentage mode is authoritative when both modes collide
- older compatible data is retained where possible

Replace scope:

- Full replaces the full sanitized state.
- Expenses replaces expenses only.
- Budget + funds replaces budget data and funds only; expenses and privacy preference remain.

Optional SHA-256 checksums are verified when available.

## CSV

Expense CSV includes:

- id
- date
- amount
- currency
- payment
- bank
- category
- note
- createdAt
- updatedAt

Text cells beginning with spreadsheet-formula prefixes are hardened on CSV export.

Funds are currently backed up through JSON rather than CSV.

## PRIVACY / SECURITY MODEL

Privacy goals:

1. No backend.
2. No account login.
3. No analytics SDK.
4. No remote financial-data API.
5. No third-party runtime library.
6. Data stays in browser localStorage unless the user explicitly exports a file.
7. Static app-shell service worker only caches same-origin application assets.
8. Generated HTML escapes user-entered text.
9. Imported state is sanitized before saving.
10. Privacy mode masks rendered monetary amounts.

Privacy mode is a shoulder-surfing convenience. It is **not encryption** and should never be described as encryption.

## DATA SAFETY RULES

Preserve these rules in future work:

1. Never silently destroy user data.
2. Keep `expense-tracker.v1` unless migration logic is provided.
3. Keep old schema-v1 full backups importable.
4. Keep old schema-v1 budget backups importable.
5. Missing `inflows` must remain valid.
6. Missing expense `bank` must remain valid.
7. Sanitize imports before saving.
8. Validate actual calendar dates/months, not only text shape.
9. Repair duplicate imported IDs rather than allowing destructive collisions.
10. Merge expenses and funds using `updatedAt` conflict resolution.
11. Escape user-entered text before generated HTML insertion.
12. Editing must not create duplicates.
13. Custom payment/category/bank/fund-source values must survive editing and backup/restore.
14. Keep the app static-host friendly.
15. Percentage allocations must remain dynamic against the selected month’s recorded funds.
16. Manual/fixed allocations must remain fixed when funds change.
17. Do not add cloud sync, bank sync, telemetry, or a backend unless explicitly required.

## RESPONSIVE CHECKLIST

Test manually at:

- 320px
- 360px
- 375px
- 390px
- 430px
- tablet widths
- 1024px
- 1280px
- 1440px+

Pay special attention to:

- six Home summary cards
- fund entry rows
- custom fund source field
- percentage + manual allocation inputs and current/projected conversions
- mobile Budget vs actual accordions
- category budget rows
- fixed five-button bottom navigation
- safe-area insets
- long currency values
- privacy mode

## FUNCTIONAL TEST CHECKLIST

### Funds

- Add Salary
- Add Payout / Bonus
- Add Side income
- Add Miscellaneous
- Add custom Other source
- Edit a fund entry
- Delete a fund entry
- Multiple fund entries in one month sum correctly
- Fund entry appears only in its date month
- Duplicate imported fund IDs are repaired
- Newer fund `updatedAt` wins in Merge

### Allocation

- No funds + no plan
- Plan with no funds
- Funds with no plan
- Funds greater than allocated plan
- Funds exactly equal allocated plan
- Plan greater than funds shows overallocated state
- Editing a category budget updates unallocated immediately
- Clearing a month plan does not delete funds or expenses
- Copy previous month copies fixed and percentage allocation modes, not funds
- Percentage allocation calculates from current month funds
- Percentage allocation recalculates when a fund entry changes
- Percentage allocation can be saved before funds exist and activates when funds are later recorded
- Editing the manual amount switches the category to fixed allocation mode
- Editing the percentage switches the category to dynamic percentage mode
- Deleting a category allocation removes either mode
- Mixed fixed + percentage allocations total correctly
- Projected funds save/clear by month without creating an inflow
- Fixed amount shows percentage against current and projected funds
- Total allocated percentage is correct for current and projected funds
- Category descriptions save/edit/copy/clear/backup/restore correctly
- Existing category save requires confirmation before update
- Total allocations above recorded funds show overallocated state

### Expense / budget analytics

- Budgeted category under plan
- Budgeted category over plan
- Unbudgeted spending
- Sports Leisure appears in expense and budget category pickers
- Budget vs actual is compact/collapsible on mobile
- Current-month fast pace warning
- Spending greater than recorded funds
- Six-month row handles months with funds but no plan/spend

### Backup

- Full export/restore including funds
- Expense-only export/restore leaves funds untouched
- Budget + funds export/restore leaves expenses untouched
- Old full backup without `inflows`
- Old budgets backup without `inflows`
- Merge keeps newer expense edits
- Merge keeps newer fund edits

### Install / offline

On GitHub Pages/HTTPS:

- iPhone Add to Home Screen displays supplied icon
- Android install/Add to Home screen displays supplied icon
- Android maskable icon is not clipped badly
- Installed app launches in standalone display where supported
- After one successful online load, app shell opens offline
- No remote third-party requests appear in DevTools Network

## SOURCE OF TRUTH

`index.html` is the application behavior source of truth.

`HANDOFF.md` documents intended behavior and compatibility requirements.
