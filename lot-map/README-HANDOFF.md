# Property Lot Map - v12 handoff

This build contains 8 survey lots and is optimized for landscape touchscreen use, including Android TV running Google Chrome.

## v12 changes

- **Street is now the default map background.**
- The Humanitarian/HOT background option has been removed.
- The map selector now contains only **Street** and **Satellite**.
- Initial network preconnect now targets the OpenStreetMap tile host used by the default view.


## v10 changes

- Satellite imagery was added as an optional map background.
- Satellite imagery uses **Esri World Imagery** through the existing lightweight XYZ tile renderer.
- The map selector now offers:
  - Street
  - Satellite
- Google Maps integration, API-key dialog, loader, and provider-switching code were removed.
- The app remains dependency-free: no Leaflet, MapLibre, Google Maps SDK, or other mapping library is loaded.
- Initial tile requests are lighter:
  - only visible tiles are requested (the old one-tile off-screen buffer was removed)
  - the default map host is preconnected in `index.html`
  - tile movement uses CSS `translate3d(...)` instead of updating layout positions on every drag frame
- If an individual Satellite tile fails, that tile falls back to the standard OpenStreetMap background so the parcel overlay remains usable.
- The same WGS84 lot corner coordinates and selection behavior from v9 are preserved.

## Preserved interaction behavior

- Lot details replace the lot list inside the **left sidebar**.
- A large **Back to lots** button returns to the lot list.
- Selecting a lot does **not** zoom, pan, or recenter the map.
- Returning to the list clears the selection, so all parcels return to the standard yellow overlay.
- Lot polygons use a yellow overlay for visibility on satellite imagery. The selected lot uses a stronger yellow highlight.
- The **All 8 lots** button is the intentional command for fitting all parcels on screen.

## Survey / coordinate foundation

BLLM No. 1 remains configured as WGS84:

- latitude: `10.0575399083`
- longitude: `124.4719672419`

Survey tie and traverse calculations use a WGS84 ellipsoidal forward-geodesic calculation (Vincenty direct). Every background layer receives the same calculated parcel coordinates; changing the map background does not alter or shift survey geometry.

## Files

- `index.html` - page structure, default Street preconnect, map selector
- `style.css` - layout, Android TV/touch styles, map UI, sidebar details view
- `app.js` - WGS84 calculation, lightweight tile renderer, selection behavior
- `config.js` - BLLM coordinate and default map layer
- `lots.js` - the 8 survey lot records
- `lots.template.json` - copy/paste reference for a future lot
- `DATA-GUIDE.md` - data-entry instructions
- `start-server.bat` - local Windows server helper
- `start-server.sh` - local macOS/Linux server helper

## Run locally

You can open `index.html` directly for a quick test. For more predictable browser behavior, run a local server.

### macOS / Linux

```bash
./start-server.sh
```

Then open:

```text
http://localhost:8080
```

### Windows

Double-click:

```text
start-server.bat
```

Then open `http://localhost:8080`.

## BLLM configuration

The current reference in `config.js` is:

```js
bllm: {
  lat: 10.0575399083,
  lng: 124.4719672419,
  label: "BLLM No. 1, Ubay, Bohol",
  datum: "WGS84"
}
```

All lots without direct `coordinates` are generated from this point using their title tie bearing/distance, followed by their traverse bearings/distances.

If an official control survey later supplies a different verified WGS84/PRS92 coordinate, update only the `bllm.lat` and `bllm.lng` values. All generated lot polygons will move automatically.

## Map backgrounds

The default is configured in `config.js`:

```js
defaultMapLayer: "standard"
```

Available values:

- `standard` - standard OpenStreetMap tiles
- `satellite` - Esri World Imagery

The selector changes only the visual background. It never recalculates parcel coordinates.

### Satellite source / terms

Esri World Imagery provides global satellite imagery and higher-resolution satellite/aerial imagery in many areas. This build uses the public World Imagery tile endpoint and displays source attribution on the map.

Esri imagery is **not open data in the same sense as OpenStreetMap**. Deployment and usage remain subject to Esri's current service/content terms and attribution requirements. If the deployment later needs guaranteed commercial quota/SLA, use an official ArcGIS Location Platform key/service plan or replace the satellite tile source with a licensed provider.

OpenStreetMap retains its normal attribution requirements.

## Lightweight design notes

The application intentionally avoids a mapping framework. The browser only loads:

- one CSS file
- three small JavaScript files (`config.js`, `lots.js`, `app.js`)
- raster tiles required for the visible map area

Google Maps JavaScript is no longer present, so selecting or loading the default map never downloads a third-party mapping SDK.

For fast initial rendering, the map requests only tiles intersecting the viewport. Browser caching still handles tiles revisited after panning/zooming.

## Lot interaction

- Tap a lot polygon or a sidebar lot card: select it and replace the left-side lot list with that lot's details.
- Selecting a lot does not change center or zoom.
- Selected parcel: colored.
- Every other parcel: standard yellow overlay.
- Tap **Back to lots**: return to the lot list, clear the selection, and return all parcels to the standard yellow overlay.
- **All 8 lots**: clear selection and fit all 8 parcels.

## Accuracy / legal-use note

The app uses the configured WGS84 BLLM coordinate and a WGS84 ellipsoidal forward-geodesic calculation. That is appropriate for web-map placement and removes the earlier spherical calculation error.

The land-description transcriptions and control coordinate should still be verified against the original DENR/LMB/approved survey records by a licensed geodetic professional before legal boundary setting, construction, engineering, or a transaction that depends on survey-grade location.

## v13 UI update

- Inactive lot overlays remain yellow.
- The active/selected lot overlay now switches to orange for clearer state feedback.
- Opening a lot's left-side detail view now uses a subtle 240 ms card-style slide/swing from the left.
- The detail animation is disabled automatically when the browser's reduced-motion preference is enabled.
