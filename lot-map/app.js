(() => {
  "use strict";

  const DATA = window.LOT_MAP_DATA || { lots: [] };
  const CONFIG = window.LOT_MAP_CONFIG || {};

  const TILE_SIZE = 256;
  const MIN_ZOOM = 3;
  const MAX_ZOOM = 20;

  // WGS84 ellipsoid
  const WGS84_A = 6378137.0;
  const WGS84_F = 1 / 298.257223563;
  const WGS84_B = (1 - WGS84_F) * WGS84_A;

  const ACTIVE_COLORS = [
    ["#1d6d4c", "#2d956a"],
    ["#8b5e1d", "#c18a38"],
    ["#315a8c", "#4d7db5"],
    ["#7e456c", "#a8618f"],
    ["#3f6d74", "#5f9299"],
    ["#815243", "#ad7562"],
    ["#526b2f", "#789447"],
    ["#66538a", "#8770ad"]
  ];
  const LOT_HIGHLIGHT = { stroke: "#e0b400", fill: "#ffd84d" };
  const LOT_SELECTED = { stroke: "#d95f02", fill: "#ff8a00" };

  const MAP_LAYERS = {
    satellite: {
      label: "Satellite",
      maxZoom: 20,
      url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
      attribution: 'Imagery &copy; Esri, Vantor, Earthstar Geographics, GIS User Community'
    },
    standard: {
      label: "Street",
      maxZoom: 19,
      url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
    }
  };

  const osmMapEl = document.getElementById("osm-map");
  const mapPanel = document.getElementById("map-panel");
  const tileLayer = document.getElementById("tile-layer");
  const svg = document.getElementById("vector-layer");
  const listEl = document.getElementById("lot-list");
  const statusEl = document.getElementById("map-status");
  const attributionEl = document.getElementById("map-attribution");
  const showAllBtn = document.getElementById("show-all");
  const zoomInBtn = document.getElementById("zoom-in");
  const zoomOutBtn = document.getElementById("zoom-out");
  const fullscreenBtn = document.getElementById("fullscreen");
  const osmLayerSelect = document.getElementById("osm-layer");
  const sidebarEl = document.getElementById("sidebar");
  const sidebarListView = document.getElementById("sidebar-list-view");
  const sidebarDetailsView = document.getElementById("sidebar-details-view");
  const sidebarBack = document.getElementById("sidebar-back");
  const detailsContent = document.getElementById("details-content");

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function toRad(v) { return v * Math.PI / 180; }
  function toDeg(v) { return v * 180 / Math.PI; }
  function formatArea(v) { return new Intl.NumberFormat("en-PH").format(v) + " sqm"; }
  function formatDistance(v) {
    return Number(v).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + " m";
  }

  function parseBearing(text) {
    const s = String(text).trim().toUpperCase().replace(/DEG\.?/g, "D");
    const m = s.match(/^([NS])\s*([0-9.]+)\s*(?:\u00B0|D)?\s*([0-9.]*)\s*['M]?\s*([EW])$/);
    if (!m) throw new Error("Invalid bearing: " + text);
    const ns = m[1];
    const ew = m[4];
    const angle = Number(m[2]) + (m[3] ? Number(m[3]) / 60 : 0);
    if (ns === "N" && ew === "E") return angle;
    if (ns === "N" && ew === "W") return 360 - angle;
    if (ns === "S" && ew === "E") return 180 - angle;
    return 180 + angle;
  }

  // Vincenty direct solution on the WGS84 ellipsoid.
  // Returns the destination WGS84 latitude/longitude from a WGS84 start,
  // true azimuth, and ground distance in metres.
  function destinationWgs84(point, bearingText, distanceM) {
    const alpha1 = toRad(parseBearing(bearingText));
    const s = Number(distanceM);
    const phi1 = toRad(Number(point.lat));
    const lambda1 = toRad(Number(point.lng));

    const sinAlpha1 = Math.sin(alpha1);
    const cosAlpha1 = Math.cos(alpha1);
    const tanU1 = (1 - WGS84_F) * Math.tan(phi1);
    const cosU1 = 1 / Math.sqrt(1 + tanU1 * tanU1);
    const sinU1 = tanU1 * cosU1;
    const sigma1 = Math.atan2(tanU1, cosAlpha1);
    const sinAlpha = cosU1 * sinAlpha1;
    const cosSqAlpha = 1 - sinAlpha * sinAlpha;
    const uSq = cosSqAlpha * (WGS84_A * WGS84_A - WGS84_B * WGS84_B) / (WGS84_B * WGS84_B);
    const A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
    const B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));

    let sigma = s / (WGS84_B * A);
    let previousSigma = Infinity;
    let cos2SigmaM = 0;
    let sinSigma = 0;
    let cosSigma = 0;
    let iterations = 0;

    while (Math.abs(sigma - previousSigma) > 1e-12 && iterations < 100) {
      cos2SigmaM = Math.cos(2 * sigma1 + sigma);
      sinSigma = Math.sin(sigma);
      cosSigma = Math.cos(sigma);
      const deltaSigma = B * sinSigma * (
        cos2SigmaM + B / 4 * (
          cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
          B / 6 * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)
        )
      );
      previousSigma = sigma;
      sigma = s / (WGS84_B * A) + deltaSigma;
      iterations += 1;
    }

    sinSigma = Math.sin(sigma);
    cosSigma = Math.cos(sigma);
    cos2SigmaM = Math.cos(2 * sigma1 + sigma);

    const tmp = sinU1 * sinSigma - cosU1 * cosSigma * cosAlpha1;
    const phi2 = Math.atan2(
      sinU1 * cosSigma + cosU1 * sinSigma * cosAlpha1,
      (1 - WGS84_F) * Math.sqrt(sinAlpha * sinAlpha + tmp * tmp)
    );
    const lambda = Math.atan2(
      sinSigma * sinAlpha1,
      cosU1 * cosSigma - sinU1 * sinSigma * cosAlpha1
    );
    const C = WGS84_F / 16 * cosSqAlpha * (4 + WGS84_F * (4 - 3 * cosSqAlpha));
    const L = lambda - (1 - C) * WGS84_F * sinAlpha * (
      sigma + C * sinSigma * (
        cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)
      )
    );

    const lng = ((toDeg(lambda1 + L) + 540) % 360) - 180;
    return { lat: toDeg(phi2), lng };
  }

  function localTraverseStats(traverse) {
    let x = 0;
    let y = 0;
    let area = 0;
    const pts = [[0, 0]];
    for (const seg of traverse || []) {
      const az = toRad(parseBearing(seg.bearing));
      x += Number(seg.distanceM) * Math.sin(az);
      y += Number(seg.distanceM) * Math.cos(az);
      pts.push([x, y]);
    }
    const polygon = pts.slice(0, -1);
    for (let i = 0; i < polygon.length; i += 1) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    return {
      closureM: Math.hypot(x, y),
      computedAreaSqm: Math.abs(area) / 2
    };
  }

  function configuredBllm() {
    const bllm = CONFIG.bllm || CONFIG.demoBLLM;
    if (!bllm || !Number.isFinite(Number(bllm.lat)) || !Number.isFinite(Number(bllm.lng))) {
      throw new Error("A valid BLLM latitude/longitude is required in config.js");
    }
    return { lat: Number(bllm.lat), lng: Number(bllm.lng) };
  }

  function prepareLot(raw, index) {
    const lot = { ...raw, colorIndex: index % ACTIVE_COLORS.length };
    if (Array.isArray(raw.coordinates) && raw.coordinates.length >= 3) {
      lot.coordinates = raw.coordinates.map(p => [Number(p[0]), Number(p[1])]);
    } else {
      const bllm = configuredBllm();
      const corner1 = destinationWgs84(bllm, raw.tie.bearing, raw.tie.distanceM);
      const coords = [[corner1.lat, corner1.lng]];
      let current = corner1;
      for (let i = 0; i < raw.traverse.length - 1; i += 1) {
        current = destinationWgs84(current, raw.traverse[i].bearing, raw.traverse[i].distanceM);
        coords.push([current.lat, current.lng]);
      }
      lot.coordinates = coords;
    }
    Object.assign(lot, localTraverseStats(raw.traverse || []));
    return lot;
  }

  let LOTS = [];
  try {
    LOTS = (Array.isArray(DATA.lots) ? DATA.lots : []).map(prepareLot);
  } catch (error) {
    console.error(error);
  }

  const configuredLayer = CONFIG.defaultMapLayer || CONFIG.defaultOsmLayer || "standard";
  const initialLayer = MAP_LAYERS[configuredLayer] ? configuredLayer : "standard";
  const state = {
    layer: initialLayer,
    center: { lat: configuredBllm().lat, lng: configuredBllm().lng },
    zoom: 15,
    selectedId: null,
    tiles: new Map(),
    renderQueued: false,
    drag: null,
    tileLoadedOnce: false,
    tileErrors: 0
  };

  const polygonEls = new Map();
  const cardEls = new Map();

  function setStatus(message, kind = "") {
    statusEl.textContent = message;
    statusEl.classList.remove("is-ok", "is-error");
    if (kind) statusEl.classList.add(kind);
  }

  function wrapLng(lng) {
    let out = lng;
    while (out < -180) out += 360;
    while (out >= 180) out -= 360;
    return out;
  }

  function project(lat, lng, zoom) {
    const safeLat = clamp(Number(lat), -85.05112878, 85.05112878);
    const sin = Math.sin(toRad(safeLat));
    const scale = TILE_SIZE * 2 ** zoom;
    return {
      x: (wrapLng(Number(lng)) + 180) / 360 * scale,
      y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale
    };
  }

  function unproject(x, y, zoom) {
    const scale = TILE_SIZE * 2 ** zoom;
    const lng = x / scale * 360 - 180;
    const n = Math.PI - 2 * Math.PI * y / scale;
    return {
      lat: clamp(toDeg(Math.atan(Math.sinh(n))), -85.05112878, 85.05112878),
      lng: wrapLng(lng)
    };
  }

  function boundsForLots(lots) {
    const pts = lots.flatMap(lot => lot.coordinates);
    return {
      minLat: Math.min(...pts.map(p => p[0])),
      maxLat: Math.max(...pts.map(p => p[0])),
      minLng: Math.min(...pts.map(p => p[1])),
      maxLng: Math.max(...pts.map(p => p[1]))
    };
  }

  function boundaryRows(lot) {
    return (lot.boundaries || []).map(row =>
      `<tr><td>${esc(row.line)}</td><td>${esc(row.direction)}</td><td>${esc(row.adjoining)}</td></tr>`
    ).join("");
  }

  function traverseRows(lot) {
    return (lot.traverse || []).map(row =>
      `<tr><td>${esc(row.line)}</td><td>${esc(row.bearing)}</td><td>${esc(formatDistance(row.distanceM))}</td></tr>`
    ).join("");
  }

  function detailsMarkup(lot) {
    const bllm = CONFIG.bllm || {};
    return `
      <div class="details-heading">
        <div>
          <p class="details-kicker">${esc(lot.id)} · ${esc(lot.plan || "Survey")}</p>
          <h2>${esc(lot.surveyLot || lot.id)}</h2>
        </div>
        <p class="details-area">${esc(formatArea(lot.areaSqm))} · more or less</p>
      </div>

      <div class="details-summary">
        <div><span>Location</span><strong>${esc(lot.barangay || DATA.locationLabel)}</strong></div>
        <div><span>Tie point</span><strong>${esc(lot.tiePoint)}</strong></div>
        <div><span>To Corner 1</span><strong>${esc(lot.tie.bearing)} · ${esc(formatDistance(lot.tie.distanceM))}</strong></div>
      </div>

      <div class="details-sections">
        <div class="details-section">
          <button class="details-section-toggle" type="button" aria-expanded="true">
            <span>Bearings &amp; distances</span><span class="details-chevron">⌄</span>
          </button>
          <div class="details-section-panel">
            <div class="details-table-wrap">
              <table><thead><tr><th>Line</th><th>Bearing</th><th>Distance</th></tr></thead><tbody>${traverseRows(lot)}</tbody></table>
            </div>
          </div>
        </div>

        <div class="details-section">
          <button class="details-section-toggle" type="button" aria-expanded="false">
            <span>Adjoining boundaries</span><span class="details-chevron">⌄</span>
          </button>
          <div class="details-section-panel" hidden>
            <div class="details-table-wrap">
              <table><thead><tr><th>Line</th><th>Dir.</th><th>Adjoining lot</th></tr></thead><tbody>${boundaryRows(lot)}</tbody></table>
            </div>
          </div>
        </div>

        <div class="details-section">
          <button class="details-section-toggle" type="button" aria-expanded="false">
            <span>Survey information</span><span class="details-chevron">⌄</span>
          </button>
          <div class="details-section-panel" hidden>
            <div class="details-foot">
              <p><strong>Bearings:</strong> ${lot.bearingsTrue ? "True" : "Not specified"}</p>
              <p><strong>Original survey:</strong> ${esc(lot.originalSurveyDate || "-")}</p>
              <p><strong>Survey / execution:</strong> ${esc(lot.surveyDate || "-")}</p>
              <p><strong>Approved:</strong> ${esc(lot.approvedDate || "-")}</p>
              <p><strong>Geodetic Engineer:</strong> ${esc(lot.engineer || "-")}</p>
              <p><strong>Corner monuments:</strong> ${esc(lot.cornerDescription || "-")}</p>
              <p><strong>Traverse closure check:</strong> ${lot.closureM.toFixed(3)} m</p>
              <p><strong>BLLM WGS84:</strong> ${Number(bllm.lat).toFixed(10)}, ${Number(bllm.lng).toFixed(10)}</p>
            </div>
          </div>
        </div>
      </div>

      <p class="details-disclaimer">${esc(lot.sourceNote || "Survey geometry is derived from the supplied technical description.")} Geographic positions are calculated from the configured BLLM WGS84 coordinate using a WGS84 ellipsoidal forward geodesic. Verify against official survey/control records before legal, engineering, construction, or boundary-setting use.</p>
    `;
  }

  function bindDetailsAccordions() {
    detailsContent.addEventListener("click", event => {
      const button = event.target.closest(".details-section-toggle");
      if (!button) return;
      event.preventDefault();
      const panel = button.nextElementSibling;
      if (!panel) return;
      const open = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!open));
      panel.hidden = open;
    });
  }

  function createSidebar() {
    listEl.replaceChildren();
    LOTS.forEach(lot => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "lot-card";
      const color = ACTIVE_COLORS[lot.colorIndex];
      card.style.setProperty("--lot-color", color[0]);
      card.innerHTML = `
        <div class="lot-card-head"><h2>${esc(lot.id)}</h2><span class="lot-ref">${esc(lot.surveyLot)}</span></div>
        <div class="lot-meta"><span>${esc(formatArea(lot.areaSqm))}</span><span>${esc(lot.barangay)}</span></div>
        <div class="lot-action">Tap for details</div>
      `;
      card.addEventListener("click", () => selectLot(lot));
      listEl.appendChild(card);
      cardEls.set(lot.id, card);
    });
  }

  function svgEl(name, attrs = {}) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    return el;
  }

  function createVectors() {
    svg.replaceChildren();
    LOTS.forEach(lot => {
      const polygon = svgEl("polygon", {
        class: "lot-polygon",
        fill: LOT_HIGHLIGHT.fill,
        "fill-opacity": "0.30",
        stroke: LOT_HIGHLIGHT.stroke,
        "stroke-width": "4",
        "data-id": lot.id,
        tabindex: "0",
        role: "button",
        "aria-label": `View details for ${lot.id}`
      });
      polygon.addEventListener("pointerdown", event => event.stopPropagation());
      polygon.addEventListener("click", event => {
        event.stopPropagation();
        selectLot(lot);
      });
      polygon.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectLot(lot);
        }
      });
      svg.appendChild(polygon);
      polygonEls.set(lot.id, polygon);
    });
  }

  function updateSelectionStyles() {
    LOTS.forEach(lot => {
      const selected = state.selectedId === lot.id;
      const polygon = polygonEls.get(lot.id);
      if (polygon) {
        polygon.classList.toggle("is-selected", selected);
        polygon.setAttribute("stroke", selected ? LOT_SELECTED.stroke : LOT_HIGHLIGHT.stroke);
        polygon.setAttribute("fill", selected ? LOT_SELECTED.fill : LOT_HIGHLIGHT.fill);
        polygon.setAttribute("fill-opacity", selected ? "0.52" : "0.30");
      }
      cardEls.get(lot.id)?.classList.toggle("is-selected", selected);
    });

  }

  let sidebarListScrollTop = 0;

  function openDetails(lot) {
    if (!sidebarListView.hidden) sidebarListScrollTop = sidebarEl.scrollTop;
    detailsContent.innerHTML = detailsMarkup(lot);
    sidebarListView.hidden = true;
    sidebarDetailsView.hidden = false;
    sidebarDetailsView.setAttribute("aria-label", `Details for ${lot.id}`);
    sidebarEl.scrollTop = 0;
    sidebarBack.focus({ preventScroll: true });
  }

  function closeDetails() {
    state.selectedId = null;
    sidebarDetailsView.hidden = true;
    sidebarListView.hidden = false;
    sidebarDetailsView.setAttribute("aria-label", "Selected lot details");
    detailsContent.replaceChildren();
    updateSelectionStyles();
    requestAnimationFrame(() => { sidebarEl.scrollTop = sidebarListScrollTop; });
  }

  function selectLot(lot) {
    // Intentionally does not pan, recenter, or zoom.
    state.selectedId = lot.id;
    updateSelectionStyles();
    openDetails(lot);
  }

  function fitBoundsOsm(bounds, maxZoom = 18, padding = 80) {
    const w = Math.max(240, osmMapEl.clientWidth);
    const h = Math.max(240, osmMapEl.clientHeight);
    let chosen = MIN_ZOOM;
    let center = state.center;
    for (let z = Math.min(MAX_ZOOM, maxZoom); z >= MIN_ZOOM; z -= 1) {
      const nw = project(bounds.maxLat, bounds.minLng, z);
      const se = project(bounds.minLat, bounds.maxLng, z);
      if (Math.abs(se.x - nw.x) <= w - padding * 2 && Math.abs(se.y - nw.y) <= h - padding * 2) {
        chosen = z;
        center = unproject((nw.x + se.x) / 2, (nw.y + se.y) / 2, z);
        break;
      }
    }
    state.zoom = chosen;
    state.center = center;
    scheduleRender();
  }

  function fitAll() {
    closeDetails();
    if (!LOTS.length) return;
    fitBoundsOsm(boundsForLots(LOTS), 18, 85);
  }

  function scheduleRender() {
    if (state.renderQueued) return;
    state.renderQueued = true;
    requestAnimationFrame(() => {
      state.renderQueued = false;
      renderOsm();
    });
  }

  function renderOsm() {
    const w = osmMapEl.clientWidth;
    const h = osmMapEl.clientHeight;
    if (w < 2 || h < 2) return;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    const centerWorld = project(state.center.lat, state.center.lng, state.zoom);
    const topLeft = { x: centerWorld.x - w / 2, y: centerWorld.y - h / 2 };
    renderTiles(topLeft, w, h);
    renderVectors(topLeft);
  }

  function currentLayer() {
    return MAP_LAYERS[state.layer] || MAP_LAYERS.standard;
  }

  function clearTiles() {
    for (const image of state.tiles.values()) image.remove();
    state.tiles.clear();
    state.tileErrors = 0;
    state.tileLoadedOnce = false;
  }

  function renderTiles(topLeft, w, h) {
    const z = state.zoom;
    const n = 2 ** z;
    const buffer = 0;
    const minX = Math.floor(topLeft.x / TILE_SIZE) - buffer;
    const maxX = Math.floor((topLeft.x + w) / TILE_SIZE) + buffer;
    const minY = Math.max(0, Math.floor(topLeft.y / TILE_SIZE) - buffer);
    const maxY = Math.min(n - 1, Math.floor((topLeft.y + h) / TILE_SIZE) + buffer);
    const needed = new Set();
    const layerKey = state.layer;
    const layer = currentLayer();

    for (let tx = minX; tx <= maxX; tx += 1) {
      const wrappedX = ((tx % n) + n) % n;
      for (let ty = minY; ty <= maxY; ty += 1) {
        const key = `${layerKey}:${z}/${wrappedX}/${ty}/${tx}`;
        needed.add(key);
        let image = state.tiles.get(key);
        if (!image) {
          image = document.createElement("img");
          image.className = "map-tile";
          image.alt = "";
          image.decoding = "async";
          image.loading = "eager";
          image.draggable = false;
          image.addEventListener("load", () => {
            if (!image.isConnected) return;
            state.tileLoadedOnce = true;
            if (image.dataset.fallback === "1") {
              setStatus(`${layer.label} imagery is unavailable for part of this view; Street fallback is active.`, "is-error");
            } else if (state.tileErrors === 0) {
              setStatus(`${layer.label} map ready`, "is-ok");
            }
          });
          image.addEventListener("error", () => {
            if (!image.isConnected) return;
            if (layerKey !== "standard" && image.dataset.fallback !== "1") {
              image.dataset.fallback = "1";
              image.src = MAP_LAYERS.standard.url(z, wrappedX, ty);
              return;
            }
            state.tileErrors += 1;
            image.style.visibility = "hidden";
            setStatus("Some map tiles could not load. Lot boundaries remain interactive.", "is-error");
          });
          image.src = layer.url(z, wrappedX, ty);
          tileLayer.appendChild(image);
          state.tiles.set(key, image);
        }
        const tileX = Math.round(tx * TILE_SIZE - topLeft.x);
        const tileY = Math.round(ty * TILE_SIZE - topLeft.y);
        image.style.transform = `translate3d(${tileX}px, ${tileY}px, 0)`;
      }
    }

    for (const [key, image] of state.tiles) {
      if (!needed.has(key)) {
        image.remove();
        state.tiles.delete(key);
      }
    }
  }

  function screenPoint(lat, lng, topLeft) {
    const p = project(lat, lng, state.zoom);
    return { x: p.x - topLeft.x, y: p.y - topLeft.y };
  }

  function renderVectors(topLeft) {
    LOTS.forEach(lot => {
      const points = lot.coordinates.map(point => {
        const screen = screenPoint(point[0], point[1], topLeft);
        return `${screen.x.toFixed(1)},${screen.y.toFixed(1)}`;
      }).join(" ");
      polygonEls.get(lot.id)?.setAttribute("points", points);
    });
  }

  function zoomByOsm(delta, anchorX = osmMapEl.clientWidth / 2, anchorY = osmMapEl.clientHeight / 2) {
    const oldZoom = state.zoom;
    const layerMaxZoom = currentLayer().maxZoom || MAX_ZOOM;
    const newZoom = clamp(oldZoom + delta, MIN_ZOOM, layerMaxZoom);
    if (newZoom === oldZoom) return;
    const oldCenter = project(state.center.lat, state.center.lng, oldZoom);
    const oldTopLeft = {
      x: oldCenter.x - osmMapEl.clientWidth / 2,
      y: oldCenter.y - osmMapEl.clientHeight / 2
    };
    const anchor = unproject(oldTopLeft.x + anchorX, oldTopLeft.y + anchorY, oldZoom);
    const anchorNew = project(anchor.lat, anchor.lng, newZoom);
    const newCenterWorld = {
      x: anchorNew.x - anchorX + osmMapEl.clientWidth / 2,
      y: anchorNew.y - anchorY + osmMapEl.clientHeight / 2
    };
    state.zoom = newZoom;
    state.center = unproject(newCenterWorld.x, newCenterWorld.y, newZoom);
    scheduleRender();
  }

  function setMapLayer(layerKey) {
    if (!MAP_LAYERS[layerKey] || state.layer === layerKey) return;
    state.layer = layerKey;
    state.zoom = clamp(state.zoom, MIN_ZOOM, MAP_LAYERS[layerKey].maxZoom || MAX_ZOOM);
    attributionEl.innerHTML = MAP_LAYERS[layerKey].attribution;
    clearTiles();
    setStatus(`Loading ${MAP_LAYERS[layerKey].label} layer...`);
    scheduleRender();
  }

  osmMapEl.addEventListener("wheel", event => {
    event.preventDefault();
    const rect = osmMapEl.getBoundingClientRect();
    zoomByOsm(event.deltaY < 0 ? 1 : -1, event.clientX - rect.left, event.clientY - rect.top);
  }, { passive: false });

  function isUiTarget(target) {
    return target instanceof Element && Boolean(target.closest("button, a, input, select, textarea"));
  }

  osmMapEl.addEventListener("pointerdown", event => {
    if (isUiTarget(event.target)) return;
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const center = project(state.center.lat, state.center.lng, state.zoom);
    state.drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      centerX: center.x,
      centerY: center.y
    };
    osmMapEl.classList.add("is-dragging");
    osmMapEl.setPointerCapture?.(event.pointerId);
  });

  osmMapEl.addEventListener("pointermove", event => {
    if (!state.drag || state.drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - state.drag.startX;
    const dy = event.clientY - state.drag.startY;
    state.center = unproject(state.drag.centerX - dx, state.drag.centerY - dy, state.zoom);
    scheduleRender();
  });

  function endDrag(event) {
    if (!state.drag || state.drag.pointerId !== event.pointerId) return;
    state.drag = null;
    osmMapEl.classList.remove("is-dragging");
  }

  osmMapEl.addEventListener("pointerup", endDrag);
  osmMapEl.addEventListener("pointercancel", endDrag);

  sidebarBack.addEventListener("click", closeDetails);
  bindDetailsAccordions();

  zoomInBtn.addEventListener("click", () => zoomByOsm(1));
  zoomOutBtn.addEventListener("click", () => zoomByOsm(-1));

  showAllBtn.addEventListener("click", fitAll);
  osmLayerSelect.addEventListener("change", () => setMapLayer(osmLayerSelect.value));

  fullscreenBtn.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
      else await document.exitFullscreen?.();
    } catch (error) {
      setStatus("Fullscreen is not available in this browser.", "is-error");
    }
  });


  const resizeObserver = new ResizeObserver(() => scheduleRender());
  resizeObserver.observe(mapPanel);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) window.setTimeout(scheduleRender, 80);
  });

  window.addEventListener("orientationchange", () => window.setTimeout(scheduleRender, 120));

  // Initialize.
  osmLayerSelect.value = state.layer;
  attributionEl.innerHTML = currentLayer().attribution;
  createSidebar();
  createVectors();
  updateSelectionStyles();

  if (!LOTS.length) {
    setStatus("No valid lot data could be loaded. Check config.js and lots.js.", "is-error");
  } else {
    setStatus(`Loading ${currentLayer().label} background...`);
    fitBoundsOsm(boundsForLots(LOTS), 18, 85);
  }


  window.setTimeout(() => {
    if (!state.tileLoadedOnce) {
      setStatus("The lot viewer is ready. Background tiles may still be loading; lot boundaries remain available.", "is-error");
    }
  }, 5000);
})();
