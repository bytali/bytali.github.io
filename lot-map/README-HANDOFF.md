# Property Lot Map v2 — Handoff Guide

This is the hardened version of the 8-lot client map.

## What changed in v2

- Uses the current canonical OpenStreetMap raster tile URL: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`.
- Removed the old `{a,b,c}` OpenStreetMap subdomain pattern.
- Removed aggressive tile-update settings that could leave a temporarily blank-looking map during zoom/pan.
- Added Leaflet CDN failover: jsDelivr → cdnjs → unpkg.
- Added a visible **Retry map** control.
- Added recovery for resize, orientation changes, browser back/forward restore, tab visibility changes, and late layout changes.
- Keeps lot polygons independent from background tile errors once the map engine has loaded.
- Uses `lots.js` as the maintenance boundary for property data.

## Files

- `index.html` — page shell.
- `style.css` — layout and branding.
- `lots.js` — edit lot coordinates/details here.
- `bootstrap.js` — loads Leaflet from multiple CDNs and starts the app.
- `app.js` — map/polygon logic.
- `start-server.bat` — Windows local server.
- `start-server.sh` — macOS/Linux local server.

## Run locally

Recommended: do not double-click `index.html` for client testing. Use HTTP.

### Windows

Double-click `start-server.bat`, then open:

`http://localhost:8080`

### macOS / Linux

```bash
./start-server.sh
```

Then open:

`http://localhost:8080`

## Edit lot data

Only edit `lots.js` for normal property updates.

```js
{
  id: "Lot 1",
  area: "240 sqm",
  price: "₱3,600,000",
  status: "Available",
  coordinates: [
    [14.60000, 120.98200],
    [14.60000, 120.98240],
    [14.60040, 120.98240],
    [14.60040, 120.98200]
  ]
}
```

Coordinates are `[latitude, longitude]`, ordered around the lot boundary.

## Important operational note

The code is local, but the map engine and background imagery still require internet access. `bootstrap.js` can recover from one blocked CDN by trying two others. Background map tiles come from OpenStreetMap.

For a public/high-traffic commercial website, use a dedicated production tile provider rather than relying on OpenStreetMap's community tile service as an SLA-backed service.

## If the map still appears wrong

1. Run through `http://localhost:8080`, not `file://`.
2. Confirm the browser can access jsDelivr/cdnjs/unpkg and `tile.openstreetmap.org`.
3. Disable an ad/privacy blocker for the test page if it blocks map/CDN domains.
4. Press **Retry map**.
5. If the lots are in the wrong place, the problem is the coordinates in `lots.js`, not map rendering.
6. If the gray map area shows but lot cards do not, inspect `lots.js` for malformed JavaScript.

## Future handoff boundary

- Lot data → `lots.js`
- Branding/layout → `style.css` / `index.html`
- Dependency startup → `bootstrap.js`
- Map behavior/provider → `app.js`
