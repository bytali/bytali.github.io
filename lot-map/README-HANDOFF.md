# Ubay Lot Map - v9 handoff

This build contains 8 survey lots and is optimized for landscape touchscreen use, including Android TV running Google Chrome.

## v9 changes

- Lot details now replace the lot list inside the **left sidebar**.
- A large **Back to lots** button returns to the lot list.
- Selecting a lot still does **not** zoom, pan, or recenter the map.
- Returning to the list clears the selection, so all parcels return to gray.

## v8 foundation

- BLLM No. 1 is now configured as WGS84:
  - latitude: `10.0575399083`
  - longitude: `124.4719672419`
- Survey tie and traverse calculations now use a WGS84 ellipsoidal forward-geodesic calculation (Vincenty direct) instead of the previous spherical approximation.
- Google Maps and OpenStreetMap use the exact same calculated WGS84 lot corner coordinates.
- Switching map providers preserves the current center/zoom as closely as possible instead of applying a provider-specific offset.
- Lot details no longer float over a parcel. They open in a left-panel details view.
- Clicking/tapping a lot still does **not** zoom or recenter the map.
- Inactive lot polygons are gray. Only the selected lot uses its assigned color.
- Map text labels such as `LOT 1`, `LOT 2`, etc. were removed.
- OpenStreetMap now has a deliberately small layer selector:
  - Street
  - Humanitarian
- The **All 8 lots** button is the intentional command for fitting all parcels on screen.

## Files

- `index.html` - page structure
- `style.css` - layout, Android TV/touch styles, left-panel details view
- `app.js` - WGS84 calculation, map renderer, selection behavior, Google Maps integration
- `config.js` - BLLM coordinate, map defaults, optional Google Maps key
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

## Google Maps

Google Maps is optional. OpenStreetMap remains the default and does not require a Google key.

For a deployed site, add the browser key in `config.js`:

```js
googleMapsApiKey: "YOUR_BROWSER_API_KEY"
```

If the field is blank, tapping **Google Maps** asks for a key and stores it only in that browser's local storage.

Google and OpenStreetMap are not given separate coordinate sets. Both providers receive the same WGS84 polygon coordinates calculated in `app.js`.

## OpenStreetMap layers

The top toolbar exposes one compact **Layer** selector while OpenStreetMap is active.

- **Street** uses the standard OpenStreetMap tile service.
- **Humanitarian** uses the HOT OpenStreetMap style and falls back to standard OSM tiles if an individual tile fails.

The layer switch changes only the background imagery/style. It does not alter parcel coordinates.

## Lot interaction

- Tap a lot polygon or a sidebar lot card: select it and replace the left-side lot list with that lot's details.
- Selecting a lot does not change center or zoom.
- Selected parcel: colored.
- Every other parcel: gray.
- Tap **Back to lots**: return to the lot list, clear the selection, and return all parcels to gray.
- **All 8 lots**: clear selection and fit all 8 parcels.

## Accuracy / legal-use note

The app uses the configured WGS84 BLLM coordinate and a WGS84 ellipsoidal forward-geodesic calculation. That is appropriate for web-map placement and removes the earlier spherical calculation error.

The land-description transcriptions and control coordinate should still be verified against the original DENR/LMB/approved survey records by a licensed geodetic professional before legal boundary setting, construction, engineering, or a transaction that depends on survey-grade location.
