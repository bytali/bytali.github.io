# Expense + Budget Tracker

A static, local-first monthly expense and category-budget tracker.

## Run locally

Open `index.html` in a modern browser, or serve the folder with any static web server.

Example:

```bash
python3 -m http.server 8000
```

Then open the local address shown by Python.

## Deploy to GitHub Pages

Upload the files in this folder to a GitHub repository and configure GitHub Pages to serve the branch/folder containing `index.html`.

No build step is required.

## Data

Financial records are stored in browser `localStorage` under:

```text
expense-tracker.v1
```

Use **More > Full backup** regularly if the data matters to you. Clearing browser/site storage can remove local data.

## Privacy

The app contains no backend, analytics SDK, third-party JavaScript, or remote data API. A Content Security Policy blocks script-initiated network connections.

The privacy toggle only masks monetary values on screen. It is not encryption.

See `HANDOFF.md` for the complete data model, migration behavior, backup rules, and test checklist.
