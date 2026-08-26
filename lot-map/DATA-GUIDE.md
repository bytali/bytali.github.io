# Lot data guide - v8

## Where the data lives

Edit `lots.js`.

The file is intentionally JSON-shaped data wrapped in a JavaScript assignment:

```js
window.LOT_MAP_DATA = {
  locationLabel: "Ubay, Bohol",
  placementIsDemo: false,
  lots: [
    // lot objects here
  ]
};
```

This keeps the data easy to edit while still allowing the page to work when opened locally.

## BLLM reference

The shared reference point is stored separately in `config.js`:

```js
bllm: {
  lat: 10.0575399083,
  lng: 124.4719672419,
  label: "BLLM No. 1, Ubay, Bohol",
  datum: "WGS84"
}
```

The app treats that as WGS84 latitude/longitude.

## Recommended lot input

For a technical description tied to BLLM No. 1, you normally do **not** need to manually calculate every corner latitude/longitude.

Enter:

1. the bearing and distance from BLLM No. 1 to Corner 1; and
2. every boundary bearing/distance around the parcel.

Example:

```js
{
  id: "Lot 9",
  shortLabel: "LOT 9",
  surveyLot: "Lot B-999",
  plan: "Bsd-00-000000 (AR)",
  barangay: "Ubay, Bohol",
  areaSqm: 25000,

  tiePoint: "BLLM No. 1, Ubay, Bohol",
  tie: {
    bearing: "S 35°32' E",
    distanceM: 6852.94
  },

  boundaries: [
    { line: "1-2", direction: "NW", adjoining: "Lot B-100" }
  ],

  traverse: [
    { line: "1-2", bearing: "N 43°50' E", distanceM: 220.07 },
    { line: "2-3", bearing: "S 25°02' E", distanceM: 119.73 },
    { line: "3-1", bearing: "S 60°00' W", distanceM: 200.00 }
  ],

  bearingsTrue: true,
  engineer: "",
  surveyDate: "",
  approvedDate: "",
  cornerDescription: ""
}
```

The app calculates:

```text
BLLM WGS84
   ↓ tie bearing + distance
Corner 1
   ↓ traverse line 1
Corner 2
   ↓ traverse line 2
Corner 3
   ↓ ...
remaining corners
```

The calculation in v8 uses the WGS84 ellipsoid, not a simple spherical Earth radius.

## Bearing format

Supported quadrant-bearing examples:

```text
N 43°50' E
N 44°33' W
S 25°02' E
S 43°38' W
```

`d` may also be used instead of the degree symbol:

```text
N 43d50' E
```

## Direct latitude/longitude override

If a licensed survey/control source already gives verified WGS84/PRS92 corner coordinates, add `coordinates` directly to that lot:

```js
coordinates: [
  [10.123456, 124.123456],
  [10.123700, 124.123900],
  [10.123200, 124.124000]
]
```

Order is always:

```text
[latitude, longitude]
```

The points must run around the boundary in sequence. When `coordinates` exists, it overrides the tie/traverse-generated map polygon for that lot.

## What appears in the left-panel details view

The UI reads these optional fields when available:

- `id`
- `surveyLot`
- `plan`
- `barangay`
- `areaSqm`
- `tiePoint`
- `tie`
- `traverse`
- `boundaries`
- `bearingsTrue`
- `originalSurveyDate`
- `surveyDate`
- `approvedDate`
- `engineer`
- `cornerDescription`
- `sourceNote`

`traverse` and `boundaries` become expandable sections in the left-panel details view.

## Adding a new lot

Copy `lots.template.json`, convert it into a JavaScript object inside the `lots` array, then replace the values with the new technical description.

Remember to put commas between objects in the `lots` array.

## Map providers and layers

There is only one coordinate calculation. Google Maps and OpenStreetMap share it.

OpenStreetMap's **Street / Humanitarian** layer selector changes only the background tiles; it does not recalculate or shift the parcel.

## Quality checks

The details panel displays the traverse closure error calculated from the entered bearings/distances. A very small closure is useful for catching transcription errors.

It is not a substitute for an approved survey or field verification.


## Sidebar interaction

The left sidebar has two states:

1. **Lot list** - shows all available lot cards.
2. **Lot details** - opens when a lot card or map polygon is tapped.

Use **Back to lots** at the top of the details view to return to the list. Selecting a lot never zooms, pans, or recenters the map.
