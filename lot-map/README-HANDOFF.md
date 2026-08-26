# Ubay Property Lot Map v4 — Handoff

This package contains **two adjoining survey-derived parcel shapes** based on the two supplied TCT technical-description images.

## What changed in v4

- Removed the generated 10 km sample parcel.
- Removed the dashed distance connector and all distance-label code.
- Added **Lot 2** from TCT `101-CARP2023000086`.
- Kept **Lot 1** from TCT `101-CARP2023000087`.
- Clicking either polygon now opens a speech-bubble/cloud-style detail card on the map.
- The popup includes TCT number, area, tie point, bearings/distances, adjoining boundaries, survey/approval dates, monument description and geodetic engineer.
- Both parcels remain usable even if OpenStreetMap background tiles are unavailable.

## Survey relationship between the lots

The two descriptions use the same tie point and the same Corner 1 call:

- Tie point: **BLLM No. 1, Municipality of Ubay, Province of Bohol**
- To Corner 1: **S 32°43′ E — 6,918.52 m**

They also contain a matching shared edge:

- Lot 1, line **1→2:** N 44°33′ W — **156.91 m**
- Lot 2, line **4→1:** S 44°33′ E — **156.91 m**

Those calls are reverse directions of the same length, so the demo geometry preserves them as the shared boundary between Lot 1 and Lot 2.

## Lot 1

TCT: `101-CARP2023000087`

- 1→2: N 44°33′ W — 156.91 m
- 2→3: N 54°23′ E — 145.40 m
- 3→4: S 44°30′ E — 129.79 m
- 4→1: S 43°38′ W — 143.57 m
- Stated area: 20,580 sqm, more or less
- Subdivision/Consolidation Survey: January 23–24, 2014
- Approved: May 6, 2014
- Geodetic Engineer: Arnel D. Cabulao

## Lot 2

TCT: `101-CARP2023000086`

- 1→2: S 43°38′ W — 122.23 m
- 2→3: N 44°33′ W — 179.99 m
- 3→4: N 54°23′ E — 123.67 m
- 4→1: S 44°33′ E — 156.91 m
- Stated area: 20,580 sqm, more or less
- Subdivision/Consolidation Survey: January 23–24, 2014
- Approved: May 6, 2014
- Geodetic Engineer: Arnel D. Cabulao

The Lot 2 traverse closes to roughly 0.002 m when calculated from the supplied calls; its calculated planar area is approximately 20,579.5 sqm, which is consistent with the stated 20,580 sqm.

## Important georeferencing limitation

The official coordinate of **BLLM No. 1, Ubay** has not been supplied. Because of that, Corner 1 is currently placed at a demo anchor near Ubay.

Therefore:

- the **shape** of each parcel is survey-derived;
- their **relative adjacency/shared edge** is survey-derived;
- the **absolute latitude/longitude location is illustrative only**.

Do not use the current basemap placement as an official legal/title boundary. Once an official BLLM No. 1 coordinate is available, the same survey calls can be georeferenced without changing the UI.

## Files

- `index.html` — page structure and map popup container.
- `style.css` — layout, polygons and speech-bubble popup styling.
- `lots.js` — all TCT/survey data and demo coordinates.
- `app.js` — built-in map renderer, pan/zoom, polygon interaction and popup logic.
- `start-server.bat` — Windows HTTP helper.
- `start-server.sh` — macOS/Linux HTTP helper.

## Quick start

For a quick test, open `index.html` directly. For development/deployment, use HTTP.

### Windows

Double-click `start-server.bat`, then open `http://localhost:8080`.

### macOS/Linux

Run:

```bash
./start-server.sh
```

Then open `http://localhost:8080`.

## OpenStreetMap background

The only network dependency is the raster background at:

`https://tile.openstreetmap.org/{z}/{x}/{y}.png`

The polygons and title-detail popup still render if those background images cannot be reached.
