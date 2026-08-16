# EXPENSE + BUDGET TRACKER WEB APP — PROJECT HANDOFF

## CURRENT VERSION

Updated: 2026-08-16

This is a static, local-first monthly budget and expense tracker designed for GitHub Pages and local browser use.

Main application file:

- `index.html`

No build process, backend, framework, package manager, database, analytics SDK, or external JavaScript/CSS library is required.

## PRIMARY PRODUCT GOAL

The app should quickly answer:

- How much was spent this month?
- What was planned for each category this month?
- How much is left in each category budget?
- Which categories are already over budget or spending too quickly?
- How much spending is currently unbudgeted?
- What is projected total spending for the selected month?
- Which categories and payment methods use the most money?
- Which banks are being used for credit-card spending?
- How does spending compare with the last six months?

The product remains intentionally simple, private, local-first, responsive, static-host friendly, and easy to back up.

## PRODUCT / BUDGETING MODEL

The previous General + Health budget model has been upgraded to monthly category budgets.

A category budget works like a simple digital envelope:

```text
category remaining = category budget - category spending
```

Examples of useful monthly category budgets:

- Groceries
- Transport
- Bills
- Health
- Mortgage
- Travel
- Investment
- Entertainment
- Shopping
- Home
- custom categories

The selected month controls both expenses and category budgets.

This design was chosen because category-level planning makes planned-vs-actual differences actionable while staying lightweight. The Budget screen also shows the previous three months' average actual spending for the selected category as an optional starting suggestion.

### Research basis

The redesign was informed by documented budgeting practices from:

- CFPB guidance to build a realistic monthly budget from actual spending and review several months of spending history.
- Actual Budget's envelope/category budgeting documentation.
- YNAB's category-target approach for recurring monthly and longer-term expenses.
- Monarch Money's documentation on category rollovers. Rollovers are intentionally NOT enabled in this version; they remain a possible future enhancement rather than hidden automatic behavior.

Reference pages:

- https://www.consumerfinance.gov/owning-a-home/prepare/assess-your-spending/
- https://actualbudget.org/docs/getting-started/envelope-budgeting/
- https://support.ynab.com/en_us/getting-started-with-targets-ryAEP08xC
- https://help.monarchmoney.com/hc/en-us/articles/4411119762196-Rollover-budget-feature

## NAVIGATION

Five primary views:

1. Home
2. Add
3. History
4. Budget
5. More

The bottom navigation remains fixed/floating and safe-area aware.

## CATEGORIES

Current built-in expense categories:

- Food
- Groceries
- Transport
- Bills
- Shopping
- Health
- Entertainment
- Home
- Investment
- Mortgage
- Travel
- Other

Changes from the previous version:

- `Groceries` added.
- `Education` removed from the built-in list.
- `Investment`, `Mortgage`, and `Travel` added to support common monthly planning categories.

Older/custom category values remain valid. For example, an existing `Education` expense is NOT deleted or rewritten. It is treated as a custom category and survives History, analytics, filtering, editing, export, and restore.

## PAYMENT METHODS

Built-in payment methods:

- Cash
- GCash / E-wallet
- Debit card
- Credit card
- Bank transfer
- Other

Custom payment values continue to survive editing/import/export.

## BANK SELECTION

A Bank field appears when the selected payment method is:

- Debit card
- Credit card
- Bank transfer

Built-in bank choices:

- BDO
- BPI
- Metrobank
- UnionBank
- Security Bank
- RCBC
- PNB
- LandBank
- EastWest
- China Bank
- Maya Bank
- GoTyme Bank
- CIMB Bank
- SeaBank
- Other bank

When `Other bank` is selected, a custom bank name is required.

The selected bank is saved as the optional `bank` property on the expense.

### Legacy bankless records

Older Debit card / Credit card / Bank transfer expenses without a `bank` remain valid.

When editing one of those existing legacy records, the user may save it again without being forced to add a bank. New bank-based expenses still require a bank.

This avoids turning an additive schema change into an editing blocker.

## NOTE FIELD

The expense Note field is now a multiline `<textarea>`.

Current maximum sanitized/storage length:

```text
500 characters
```

Line breaks are preserved in History display.

## MONTHLY CATEGORY BUDGETS

Category budgets are stored under:

```text
settings.categoryBudgets
```

Approximate shape:

```json
{
  "2026-08": {
    "Groceries": 12000,
    "Transport": 5000,
    "Health": 6000,
    "Mortgage": 25000,
    "Travel": 4000
  }
}
```

Custom categories can also have budgets.

### Budget screen

The Budget view includes:

- Planned total
- Budgeted spending
- Remaining across planned categories
- Unbudgeted spending
- Category budget editor
- Copy previous month's plan
- Clear selected month's plan without deleting expenses
- Three-month actual-spending average suggestion
- Current category spending beside each budget

### Copy previous month

`Copy previous month` copies the prior month's complete category budget map into the selected month.

If the selected month already has a plan, replacement requires confirmation.

### Three-month suggestion

For a selected category:

```text
suggestion = average actual spending for the previous 3 months
```

This is informational and only populates the input when the user chooses `Use`.

It does not automatically alter the budget.

## LEGACY GENERAL / HEALTH BUDGET MIGRATION

Do not rename or discard these old objects:

```text
settings.budgets
settings.healthBudgets
```

They remain preserved for backward compatibility.

When loading an older schema-v1 state or backup that does NOT contain `settings.categoryBudgets`:

- Old General budgets are migrated into a special fallback category key:

```text
__general__
```

Displayed to the user as:

```text
Unallocated / General
```

- Old Health budgets are migrated into the normal exact category:

```text
Health
```

The legacy General fallback only absorbs spending from non-Health categories that do not already have their own explicit category budget.

This preserves the previous rule that Health did not consume General.

Once `settings.categoryBudgets` exists, old General/Health fields are no longer automatically remigrated after the user edits/deletes category budgets.

The old fields remain stored/exported only for backward compatibility.

## STORAGE MODEL

Do not rename this key without explicit migration logic:

```text
expense-tracker.v1
```

Schema version remains:

```text
1
```

The upgrade is additive.

Approximate state:

```json
{
  "schemaVersion": 1,
  "settings": {
    "currency": "PHP",
    "budgets": {
      "2026-08": 30000
    },
    "healthBudgets": {
      "2026-08": 5000
    },
    "categoryBudgets": {
      "2026-08": {
        "Groceries": 10000,
        "Transport": 5000,
        "Health": 5000
      }
    },
    "hideAmounts": false
  },
  "expenses": [
    {
      "id": "unique-id",
      "amount": 2500,
      "payment": "Credit card",
      "bank": "BPI",
      "category": "Groceries",
      "date": "2026-08-10",
      "note": "Weekly groceries",
      "createdAt": "2026-08-10T10:00:00.000Z",
      "updatedAt": "2026-08-10T10:00:00.000Z"
    }
  ]
}
```

## PRIVACY MODE

A privacy toggle is available:

- Top-right eye button
- More > Privacy mode

Setting:

```text
settings.hideAmounts
```

When enabled, rendered monetary values are replaced with masked dots.

Privacy mode is designed for shoulder-surfing/screen-sharing privacy only.

It is NOT encryption and does not remove financial data from localStorage.

Anyone with access to the browser profile/devtools or an exported backup may still read the underlying data.

## PRIVACY / NETWORK DESIGN

The app remains entirely client-side.

It intentionally has:

- No backend
- No cloud database
- No analytics/tracking SDK
- No third-party scripts
- No third-party fonts
- No remote API calls
- No account/login requirement

A Content Security Policy in `index.html` blocks script-initiated network connections (`connect-src 'none'`).

Data remains in browser localStorage unless the user explicitly downloads a backup/export.

Important limitation: serving the static HTML from GitHub Pages still means the browser requests the application files from GitHub like any normal website. Financial records themselves are not uploaded by this app.

## HOME / ANALYTICS

The analytics dashboard was reorganized to prioritize decisions over raw chart count.

### Top summary

Home shows:

- Spent
- Plan left
- Projected spending
- Unbudgeted spending
- Plan coverage

### Budget vs actual

Each budget category shows:

- Category name
- Actual spending
- Planned budget
- Percent used
- Progress bar
- Remaining or over amount
- Pace warning when appropriate

### Pace logic

For the current month:

```text
expected budget usage % = elapsed days / days in month
```

A category receives an `Ahead of pace` warning when actual usage exceeds expected usage by more than 10 percentage points.

Over-budget categories are higher severity than pace warnings.

### Attention panel

The dashboard surfaces up to five useful issues, prioritizing:

1. Over-budget categories
2. Unbudgeted spending
3. Categories materially ahead of pace
4. Missing monthly plan
5. Empty/no-spending state

### Other analytics

Home also includes:

- Daily spending chart
- Spending by category, including percent share
- Spending by payment method, including percent share
- Credit-card bank usage
- Six-month spending trend with monthly plan context

### Credit-card bank usage

The bank analytics card still filters to exact:

```text
payment == "Credit card"
```

Older card records without a bank show:

```text
Unspecified bank
```

Debit-card and bank-transfer banks remain stored/displayed in History but are not included in the dedicated credit-card-bank chart.

## DAILY / PROJECTED METRICS

Projected spending uses all expenses in the selected month:

```text
daily average = total spent / elapsed days
projected = daily average * days in month
```

For future months with zero elapsed days, projection is not shown.

## UNBUDGETED SPENDING

An expense is considered budgeted when:

- its exact category has a category budget, OR
- an older migrated `Unallocated / General` fallback exists and the expense is non-Health.

Otherwise it counts as unbudgeted spending.

This makes missing plan categories visible instead of silently treating all spending as covered.

## HISTORY

Expense cards display:

- Date
- Category
- Payment method
- Bank when present
- Multiline note when present
- Amount or privacy mask
- Edit
- Delete

History remains card/list based for mobile usability.

Editing updates the existing record in place and does not create a duplicate.

## DATA SANITIZATION / SAFETY HARDENING

Imported/local state is sanitized before use.

### Dates

Expense dates are validated as real calendar dates, not regex-only strings.

For example:

```text
2026-02-31
```

is rejected.

Budget months must also have real month numbers (`01` through `12`).

### Duplicate IDs

If imported state contains duplicate expense IDs, later duplicates receive new IDs during sanitization.

This prevents deleting one record from deleting every record that shared a malformed imported ID.

### Merge conflicts

Expense Merge uses `updatedAt`:

```text
newer updatedAt wins for the same expense ID
```

This prevents an older backup from silently overwriting a newer local edit.

Category-budget Merge combines month/category maps instead of replacing the entire current month when only one imported category differs.

### HTML escaping

User-entered payment/category/bank/note values are escaped before being inserted into generated HTML.

### CSV formula hardening

CSV text cells beginning with formula-like characters are prefixed so spreadsheet applications are less likely to interpret them as formulas:

```text
=
+
-
@
```

## BACKUP / RESTORE

JSON remains the primary backup format.

Backup identifier remains:

```text
github-pages-expense-tracker
```

### Full backup

`Full backup` includes:

- currency
- old General budgets
- old Health budgets
- category budgets
- privacy preference
- expenses
- optional bank property
- timestamps
- SHA-256 checksum when Web Crypto is available

### Separate exports

The app also supports:

- Expenses JSON
- Budgets JSON
- Expenses CSV

This allows expense history and budget plans to be backed up separately.

### Restore scopes

The Restore JSON picker recognizes:

- Full backup
- Expenses-only JSON
- Budgets-only JSON

Restore modes:

- Merge
- Replace scope

`Replace scope` only replaces the scope represented by the file:

- Full backup -> expenses + settings
- Expenses JSON -> expenses only
- Budgets JSON -> budget data only

Expenses-only restore does not silently change the app's current currency and does not perform currency conversion. The source currency is shown as metadata when present.

### Old backups

Old schema-v1 full backups without:

- `bank`
- `healthBudgets`
- `categoryBudgets`
- `hideAmounts`

remain importable.

## CSV EXPORT

CSV fields:

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

## RESPONSIVE DESIGN

The UI remains mobile-first and expands for larger screens.

### Mobile

Recommended checks:

- 320px
- 360px
- 375px
- 390px
- 430px

Expected behavior:

- Five-button floating bottom navigation fits without page-level horizontal scrolling.
- Safe-area insets are supported.
- Two-column form sections collapse on narrow screens.
- Budget editor controls collapse where necessary.
- Analytics cards stack.
- History remains list/card based.
- Note textarea remains usable without horizontal overflow.

### Tablet / desktop

At larger widths:

- Summary KPIs use four columns.
- Analytics use multi-column layouts.
- Daily chart expands vertically.
- Home uses a 12-column desktop grid.
- Add and Budget editors use wider centered layouts.
- More settings use columns.

Recommended checks:

- tablet widths
- 1024px
- 1280px
- 1440px+

## DATA SAFETY RULES

Preserve these principles:

1. Do not silently destroy user data.
2. Do not rename `expense-tracker.v1` without migration logic.
3. Keep schema-v1 backups importable.
4. Sanitize imported data before saving it.
5. Escape user-entered text before inserting it into generated HTML.
6. Editing an expense must not create a duplicate.
7. Custom payment/category/bank values must survive editing.
8. Old bankless card/bank-transfer records must remain editable.
9. Keep the application static-host friendly.
10. Do not add a backend unless shared live data is explicitly required.
11. Avoid unnecessary frameworks and dependencies.
12. Do not make privacy-mode masking sound like encryption.
13. Do not automatically enable budget rollovers without an explicit product decision and migration design.
14. Do not discard old General/Health budget fields while old backups still depend on them.

## IMPORTANT IMPLEMENTATION NOTES

### Exact category matching

Category budgets match expense categories exactly.

For example:

```text
Groceries
```

and:

```text
groceries
```

would be different category strings if the lowercase value arrived from a custom/imported record.

Built-in UI choices use consistent capitalization.

### Health compatibility

For migrated legacy General budgets, Health remains excluded from the General fallback.

This preserves the prior app's separate-Health behavior.

### Legacy General fallback

`__general__` is an internal compatibility key, not a normal expense category.

Do not expose it as a standard Add Expense category.

### No income model yet

This version tracks:

- monthly planned category budgets
- monthly actual expenses

It does not yet track income/paychecks or enforce a true zero-based `income = assigned budget` constraint.

That omission is intentional to keep the app simple and avoid adding financial concepts the user did not explicitly request.

A future income feature should be designed as a separate schema addition, not inferred from expenses.

## TEST CHECKLIST

### Syntax / structure

- JavaScript parses without syntax errors.
- No duplicate DOM IDs.
- Interactive form controls have labels or aria-labels.
- No external JavaScript/CSS dependencies.

### Responsive

- 320px
- 360px
- 375px
- 390px
- 430px
- tablet
- 1024px
- 1280px
- 1440px+
- all five views
- long custom category names
- long bank names
- multiline notes
- privacy mode on/off

### Categories

- Groceries available
- Education absent from new-expense built-in list
- Old Education record still displays/edits as custom
- Investment available
- Mortgage available
- Travel available
- Other/custom category survives edit/import/export

### Expense

- Add
- Edit
- Delete
- Note textarea
- Custom payment
- Custom category
- Date validation
- Filter
- Multi-tab sync

### Bank

- New Debit card requires bank
- New Credit card requires bank
- New Bank transfer requires bank
- Other bank requires custom name
- Editing restores bank
- Legacy bankless Credit card can be edited without adding a bank
- Credit-card analytics groups banks correctly
- Missing bank shows Unspecified bank

### Budget

- No monthly plan
- Add category budget
- Edit category budget
- Remove category budget
- Clear month plan does not remove expenses
- Copy previous plan
- 3-month suggestion
- Under budget
- Over budget
- Ahead-of-pace warning
- Unbudgeted expense
- Custom category budget
- Future month
- Past month

### Legacy migration

- Old General only
- Old Health only
- Old General + Health
- Health does not consume legacy General fallback
- Old state receives categoryBudgets without changing storage key/schema version

### Import / export

- Full export + restore
- Expenses JSON export + merge
- Expenses JSON replace scope
- Budgets JSON export + merge
- Budgets JSON replace scope
- Old schema-v1 backup without bank
- Old schema-v1 backup without healthBudgets
- Old schema-v1 backup without categoryBudgets
- Duplicate imported expense IDs
- Invalid imported calendar date
- Invalid imported budget month
- Same expense ID with older imported updatedAt
- Same expense ID with newer imported updatedAt
- Category-budget merge preserves categories from both sides
- CSV formula-like note/category values

### Privacy

- Eye button hides/shows rendered amounts
- More toggle stays in sync with eye button
- Setting persists in localStorage
- History amount is masked
- Daily hover/title does not reveal hidden amount
- Confirm-delete text does not reveal amount while privacy mode is on

## SOURCE OF TRUTH

The current `index.html` in this package is the runtime source of truth.

This `HANDOFF.md` documents the intended behavior of the packaged version containing that file.
