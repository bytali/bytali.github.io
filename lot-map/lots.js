/*
 * LOT DATA - HANDOFF FILE
 * =======================
 * Coordinates use [latitude, longitude].
 *
 * Both parcel SHAPES are reconstructed from the supplied TCT technical
 * descriptions. Their shared survey edge is preserved in this demo geometry.
 *
 * IMPORTANT GEOREFERENCE NOTE
 * ---------------------------
 * Both titles use the same tie point:
 *   BLLM No. 1, Municipality of Ubay, Province of Bohol
 *   To Corner 1: S 32°43' E, 6,918.52 m
 *
 * The official latitude/longitude of BLLM No. 1 was not supplied, so Corner 1
 * is placed at a DEMO anchor near Ubay. The polygon shapes and their relative
 * adjacency come from the survey bearings/distances, but the absolute map
 * placement must NOT be represented as an official title location.
 */

window.LOT_MAP_DATA = {
  locationLabel: "Ubay, Bohol",
  placementIsDemo: true,
  lots: [
    {
      id: "Lot 1",
      shortLabel: "LOT 1",
      colorKey: "lot1",
      tct: "101-CARP2023000087",
      page: "2",
      area: "20,580 sqm",
      areaText: "TWENTY THOUSAND FIVE HUNDRED EIGHT (20,580) SQUARE METERS, MORE OR LESS",
      status: "Survey-derived",
      tiePoint: "BLLM No. 1, Municipality of Ubay, Province of Bohol",
      tieBearing: "S 32°43′ E",
      tieDistance: "6,918.52 m",
      bearingsTrue: true,
      surveyDate: "January 23–24, 2014",
      approvedDate: "May 6, 2014",
      engineer: "Arnel D. Cabulao",
      cornerDescription: "Points 3 and 4 are B.L. cylindrical concrete monuments 15×40 cm; the rest are A.R. cylindrical concrete monuments 15×50 cm.",
      boundaries: [
        { line: "1–2", direction: "SW", adjoining: "B-25-A, BSD-07-093598 (AR)" },
        { line: "2–3", direction: "NW", adjoining: "B-35, BSD-07-035133 (AR)" },
        { line: "3–4", direction: "NE", adjoining: "B-24, BSD-07-035133 (AR)" },
        { line: "4–1", direction: "SE", adjoining: "B-22, BSD-07-035133 (AR)" }
      ],
      traverse: [
        { line: "1–2", bearing: "N 44°33′ W", distance: "156.91 m" },
        { line: "2–3", bearing: "N 54°23′ E", distance: "145.40 m" },
        { line: "3–4", bearing: "S 44°30′ E", distance: "129.79 m" },
        { line: "4–1", bearing: "S 43°38′ W", distance: "143.57 m" }
      ],
      note: "Boundary shape reconstructed from TCT bearings/distances. Absolute map position is illustrative until BLLM No. 1 is georeferenced.",
      coordinates: [
        [10.06820000, 124.44850000],
        [10.06921096, 124.44749579],
        [10.06997649, 124.44857411],
        [10.06913955, 124.44940401]
      ]
    },
    {
      id: "Lot 2",
      shortLabel: "LOT 2",
      colorKey: "lot2",
      tct: "101-CARP2023000086",
      page: "2",
      area: "20,580 sqm",
      areaText: "TWENTY THOUSAND FIVE HUNDRED EIGHTY (20,580) SQUARE METERS, MORE OR LESS",
      status: "Survey-derived",
      tiePoint: "BLLM No. 1, Municipality of Ubay, Province of Bohol",
      tieBearing: "S 32°43′ E",
      tieDistance: "6,918.52 m",
      bearingsTrue: true,
      surveyDate: "January 23–24, 2014",
      approvedDate: "May 6, 2014",
      engineer: "Arnel D. Cabulao",
      cornerDescription: "Points 2 and 3 are B.L. cylindrical concrete monuments 15×40 cm; the rest are A.R. cylindrical concrete monuments 15×50 cm.",
      boundaries: [
        { line: "1–2", direction: "SE", adjoining: "B-22, BSD-07-035133 (AR)" },
        { line: "2–3", direction: "SE", adjoining: "B-26, BSD-07-035133 (AR)" },
        { line: "3–4", direction: "NW", adjoining: "B-35, BSD-07-035133 (AR)" },
        { line: "4–1", direction: "NE", adjoining: "B-25-B, BSD-07-039598 (AR)" }
      ],
      traverse: [
        { line: "1–2", bearing: "S 43°38′ W", distance: "122.23 m" },
        { line: "2–3", bearing: "N 44°33′ W", distance: "179.99 m" },
        { line: "3–4", bearing: "N 54°23′ E", distance: "123.67 m" },
        { line: "4–1", bearing: "S 44°33′ E", distance: "156.91 m" }
      ],
      note: "Boundary shape reconstructed from the second supplied TCT. It shares the 156.91 m survey edge with Lot 1. Absolute map position is illustrative until BLLM No. 1 is georeferenced.",
      coordinates: [
        [10.06820000, 124.44850000],
        [10.06740018, 124.44773056],
        [10.06855984, 124.44657864],
        [10.06921097, 124.44749580]
      ]
    }
  ]
};
