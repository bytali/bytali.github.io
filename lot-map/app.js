(() => {
  "use strict";

  const DATA = window.LOT_MAP_DATA || { lots: [] };
  const LOTS = Array.isArray(DATA.lots) ? DATA.lots : [];
  const TILE_SIZE = 256;
  const MIN_ZOOM = 3;
  const MAX_ZOOM = 20;
  const TILE_URL = (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

  const COLORS = {
    lot1: { stroke: "#1e6e4d", fill: "#2b8a62" },
    lot2: { stroke: "#7a541d", fill: "#b98533" }
  };

  const mapEl = document.getElementById("map");
  const tileLayer = document.getElementById("tile-layer");
  const svg = document.getElementById("vector-layer");
  const listEl = document.getElementById("lot-list");
  const statusEl = document.getElementById("map-status");
  const showAllBtn = document.getElementById("show-all");
  const retryBtn = document.getElementById("retry-tiles");
  const zoomInBtn = document.getElementById("zoom-in");
  const zoomOutBtn = document.getElementById("zoom-out");
  const popupEl = document.getElementById("lot-popup");
  const popupContent = document.getElementById("popup-content");
  const popupClose = document.getElementById("popup-close");

  const state = {
    center: { lat: 10.0686, lng: 124.4480 },
    zoom: 17,
    selectedId: null,
    tiles: new Map(),
    renderQueued: false,
    drag: null,
    movedDuringDrag: false,
    tileLoadedOnce: false,
    tileErrors: 0
  };

  const polygonEls = new Map();
  const labelEls = new Map();
  const cardEls = new Map();

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setStatus(message, kind = "") {
    statusEl.textContent = message;
    statusEl.classList.remove("is-ok", "is-error");
    if (kind) statusEl.classList.add(kind);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function wrapLng(lng) {
    let out = lng;
    while (out < -180) out += 360;
    while (out >= 180) out -= 360;
    return out;
  }

  function project(lat, lng, zoom) {
    const safeLat = clamp(Number(lat), -85.05112878, 85.05112878);
    const sin = Math.sin(safeLat * Math.PI / 180);
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
    const lat = 180 / Math.PI * Math.atan(Math.sinh(n));
    return { lat: clamp(lat, -85.05112878, 85.05112878), lng: wrapLng(lng) };
  }

  function lotCenter(lot) {
    const valid = (lot.coordinates || []).filter(p => Array.isArray(p) && p.length >= 2);
    if (!valid.length) return { lat: 0, lng: 0 };
    return {
      lat: valid.reduce((sum, p) => sum + Number(p[0]), 0) / valid.length,
      lng: valid.reduce((sum, p) => sum + Number(p[1]), 0) / valid.length
    };
  }

  function boundsForLots(lots) {
    const pts = lots.flatMap(lot => lot.coordinates || []);
    return {
      minLat: Math.min(...pts.map(p => Number(p[0]))),
      maxLat: Math.max(...pts.map(p => Number(p[0]))),
      minLng: Math.min(...pts.map(p => Number(p[1]))),
      maxLng: Math.max(...pts.map(p => Number(p[1])))
    };
  }

  function fitBounds(bounds, maxZoom = 18, padding = 70) {
    const w = Math.max(240, mapEl.clientWidth);
    const h = Math.max(240, mapEl.clientHeight);
    let chosen = MIN_ZOOM;
    let center = state.center;

    for (let z = Math.min(MAX_ZOOM, maxZoom); z >= MIN_ZOOM; z--) {
      const nw = project(bounds.maxLat, bounds.minLng, z);
      const se = project(bounds.minLat, bounds.maxLng, z);
      const spanX = Math.abs(se.x - nw.x);
      const spanY = Math.abs(se.y - nw.y);
      if (spanX <= w - padding * 2 && spanY <= h - padding * 2) {
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
    state.selectedId = null;
    hidePopup();
    updateSelectionStyles();
    if (LOTS.length) fitBounds(boundsForLots(LOTS), 18, 72);
  }

  function fitLot(lot) {
    fitBounds(boundsForLots([lot]), 18, 150);
  }

  function boundaryRows(lot) {
    return (lot.boundaries || []).map(row => `
      <tr>
        <td>${esc(row.line)}</td>
        <td>${esc(row.direction)}</td>
        <td>${esc(row.adjoining)}</td>
      </tr>`).join("");
  }

  function traverseRows(lot) {
    return (lot.traverse || []).map(row => `
      <tr>
        <td>${esc(row.line)}</td>
        <td>${esc(row.bearing)}</td>
        <td>${esc(row.distance)}</td>
      </tr>`).join("");
  }

  function popupMarkup(lot) {
    return `
      <div class="popup-heading">
        <p class="popup-kicker">${esc(lot.id)} · TCT</p>
        <h2>${esc(lot.tct)}</h2>
        <p class="popup-area">${esc(lot.area)} · more or less</p>
      </div>

      <div class="popup-summary">
        <div><span>Tie point</span><strong>${esc(lot.tiePoint)}</strong></div>
        <div><span>To Corner 1</span><strong>${esc(lot.tieBearing)} · ${esc(lot.tieDistance)}</strong></div>
      </div>

      <details open>
        <summary>Bearings & distances</summary>
        <div class="popup-table-wrap">
          <table>
            <thead><tr><th>Line</th><th>Bearing</th><th>Distance</th></tr></thead>
            <tbody>${traverseRows(lot)}</tbody>
          </table>
        </div>
      </details>

      <details>
        <summary>Adjoining boundaries</summary>
        <div class="popup-table-wrap">
          <table>
            <thead><tr><th>Line</th><th>Dir.</th><th>Adjoining lot(s)</th></tr></thead>
            <tbody>${boundaryRows(lot)}</tbody>
          </table>
        </div>
      </details>

      <div class="popup-foot">
        <p><strong>Bearings:</strong> ${lot.bearingsTrue ? "True" : "—"}</p>
        <p><strong>Subdivision/Consolidation Survey:</strong> ${esc(lot.surveyDate)}</p>
        <p><strong>Date approved:</strong> ${esc(lot.approvedDate)}</p>
        <p><strong>Geodetic Engineer:</strong> ${esc(lot.engineer)}</p>
        <p><strong>Corner monuments:</strong> ${esc(lot.cornerDescription)}</p>
      </div>

      <p class="popup-disclaimer">Map placement is illustrative until BLLM No. 1 is georeferenced.</p>`;
  }

  function createSidebar() {
    listEl.replaceChildren();
    LOTS.forEach(lot => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "lot-card";
      card.innerHTML = `
        <div class="lot-card-head">
          <h2>${esc(lot.id)}</h2>
          <span class="kind-pill ${esc(lot.colorKey)}">TCT ${esc(lot.tct.slice(-4))}</span>
        </div>
        <div class="lot-meta">
          <span><strong>Area:</strong> ${esc(lot.area)}</span>
          <span><strong>TCT:</strong> ${esc(lot.tct)}</span>
        </div>
        <p class="lot-note">${esc(lot.note)}</p>`;
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
      const palette = COLORS[lot.colorKey] || COLORS.lot1;
      const poly = svgEl("polygon", {
        class: "lot-polygon",
        fill: palette.fill,
        "fill-opacity": "0.38",
        stroke: palette.stroke,
        "stroke-width": "3",
        "data-id": lot.id,
        tabindex: "0",
        role: "button",
        "aria-label": `View details for ${lot.id}`
      });
      poly.addEventListener("click", event => {
        event.stopPropagation();
        if (!state.movedDuringDrag) selectLot(lot);
      });
      poly.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectLot(lot);
        }
      });

      const label = svgEl("text", { class: "map-label" });
      label.textContent = lot.shortLabel || lot.id;
      svg.append(poly, label);
      polygonEls.set(lot.id, poly);
      labelEls.set(lot.id, label);
    });
  }

  function updateSelectionStyles() {
    LOTS.forEach(lot => {
      polygonEls.get(lot.id)?.classList.toggle("is-selected", state.selectedId === lot.id);
      cardEls.get(lot.id)?.classList.toggle("is-selected", state.selectedId === lot.id);
    });
  }

  function showPopup(lot) {
    popupContent.innerHTML = popupMarkup(lot);
    popupEl.hidden = false;
    scheduleRender();
  }

  function hidePopup() {
    popupEl.hidden = true;
  }

  function selectLot(lot) {
    state.selectedId = lot.id;
    updateSelectionStyles();
    showPopup(lot);
    fitLot(lot);
  }

  function scheduleRender() {
    if (state.renderQueued) return;
    state.renderQueued = true;
    requestAnimationFrame(() => {
      state.renderQueued = false;
      render();
    });
  }

  function render() {
    const w = mapEl.clientWidth;
    const h = mapEl.clientHeight;
    if (w < 2 || h < 2) return;

    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    const centerWorld = project(state.center.lat, state.center.lng, state.zoom);
    const topLeft = { x: centerWorld.x - w / 2, y: centerWorld.y - h / 2 };

    renderTiles(topLeft, w, h);
    renderVectors(topLeft);
    renderPopup(topLeft, w, h);
  }

  function renderTiles(topLeft, w, h) {
    const z = state.zoom;
    const n = 2 ** z;
    const buffer = 1;
    const minX = Math.floor(topLeft.x / TILE_SIZE) - buffer;
    const maxX = Math.floor((topLeft.x + w) / TILE_SIZE) + buffer;
    const minY = Math.max(0, Math.floor(topLeft.y / TILE_SIZE) - buffer);
    const maxY = Math.min(n - 1, Math.floor((topLeft.y + h) / TILE_SIZE) + buffer);
    const needed = new Set();

    for (let tx = minX; tx <= maxX; tx++) {
      const wrappedX = ((tx % n) + n) % n;
      for (let ty = minY; ty <= maxY; ty++) {
        const key = `${z}/${wrappedX}/${ty}/${tx}`;
        needed.add(key);
        let img = state.tiles.get(key);
        if (!img) {
          img = document.createElement("img");
          img.className = "map-tile";
          img.alt = "";
          img.decoding = "async";
          img.loading = "eager";
          img.draggable = false;
          img.addEventListener("load", () => {
            state.tileLoadedOnce = true;
            if (state.tileErrors === 0) setStatus("Map ready", "is-ok");
            else setStatus("Map ready; some background tiles did not load. Lot boundaries remain available.", "is-error");
          });
          img.addEventListener("error", () => {
            state.tileErrors += 1;
            img.style.visibility = "hidden";
            setStatus("Background tiles are unavailable or slow. The lot boundaries still work; use Retry background when online.", "is-error");
          });
          img.src = TILE_URL(z, wrappedX, ty);
          tileLayer.appendChild(img);
          state.tiles.set(key, img);
        }
        img.style.left = `${Math.round(tx * TILE_SIZE - topLeft.x)}px`;
        img.style.top = `${Math.round(ty * TILE_SIZE - topLeft.y)}px`;
      }
    }

    for (const [key, img] of state.tiles) {
      if (!needed.has(key)) {
        img.remove();
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
      const points = lot.coordinates.map(p => {
        const screen = screenPoint(Number(p[0]), Number(p[1]), topLeft);
        return `${screen.x.toFixed(1)},${screen.y.toFixed(1)}`;
      }).join(" ");
      polygonEls.get(lot.id)?.setAttribute("points", points);

      const center = lotCenter(lot);
      const screenCenter = screenPoint(center.lat, center.lng, topLeft);
      const label = labelEls.get(lot.id);
      if (label) {
        label.setAttribute("x", screenCenter.x.toFixed(1));
        label.setAttribute("y", screenCenter.y.toFixed(1));
      }
    });
  }

  function renderPopup(topLeft, mapWidth, mapHeight) {
    if (popupEl.hidden || !state.selectedId) return;
    const lot = LOTS.find(item => item.id === state.selectedId);
    if (!lot) return;

    const center = lotCenter(lot);
    const point = screenPoint(center.lat, center.lng, topLeft);
    const popupWidth = Math.min(popupEl.offsetWidth || 360, mapWidth - 20);
    const popupHeight = popupEl.offsetHeight || 360;
    const halfWidth = popupWidth / 2;
    const x = clamp(point.x, halfWidth + 10, mapWidth - halfWidth - 10);
    const canPlaceAbove = point.y - popupHeight - 22 > 10;

    popupEl.style.left = `${x}px`;
    popupEl.classList.toggle("is-below", !canPlaceAbove);
    popupEl.style.top = `${canPlaceAbove ? point.y - 18 : point.y + 18}px`;

    if (point.y < -40 || point.y > mapHeight + 40) popupEl.hidden = true;
  }

  function zoomBy(delta, anchorX = mapEl.clientWidth / 2, anchorY = mapEl.clientHeight / 2) {
    const oldZoom = state.zoom;
    const newZoom = clamp(oldZoom + delta, MIN_ZOOM, MAX_ZOOM);
    if (newZoom === oldZoom) return;

    const oldCenter = project(state.center.lat, state.center.lng, oldZoom);
    const oldTopLeft = { x: oldCenter.x - mapEl.clientWidth / 2, y: oldCenter.y - mapEl.clientHeight / 2 };
    const anchorGeo = unproject(oldTopLeft.x + anchorX, oldTopLeft.y + anchorY, oldZoom);
    const anchorNew = project(anchorGeo.lat, anchorGeo.lng, newZoom);
    const newCenterWorld = {
      x: anchorNew.x - anchorX + mapEl.clientWidth / 2,
      y: anchorNew.y - anchorY + mapEl.clientHeight / 2
    };

    state.zoom = newZoom;
    state.center = unproject(newCenterWorld.x, newCenterWorld.y, newZoom);
    scheduleRender();
  }

  mapEl.addEventListener("wheel", event => {
    event.preventDefault();
    const rect = mapEl.getBoundingClientRect();
    zoomBy(event.deltaY < 0 ? 1 : -1, event.clientX - rect.left, event.clientY - rect.top);
  }, { passive: false });

  mapEl.addEventListener("pointerdown", event => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const center = project(state.center.lat, state.center.lng, state.zoom);
    state.drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, centerX: center.x, centerY: center.y };
    state.movedDuringDrag = false;
    mapEl.classList.add("is-dragging");
    mapEl.setPointerCapture?.(event.pointerId);
  });

  mapEl.addEventListener("pointermove", event => {
    if (!state.drag || state.drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - state.drag.startX;
    const dy = event.clientY - state.drag.startY;
    if (Math.hypot(dx, dy) > 4) state.movedDuringDrag = true;
    state.center = unproject(state.drag.centerX - dx, state.drag.centerY - dy, state.zoom);
    scheduleRender();
  });

  function endDrag(event) {
    if (!state.drag || state.drag.pointerId !== event.pointerId) return;
    state.drag = null;
    mapEl.classList.remove("is-dragging");
    window.setTimeout(() => { state.movedDuringDrag = false; }, 0);
  }

  mapEl.addEventListener("pointerup", endDrag);
  mapEl.addEventListener("pointercancel", endDrag);
  zoomInBtn.addEventListener("click", () => zoomBy(1));
  zoomOutBtn.addEventListener("click", () => zoomBy(-1));
  showAllBtn.addEventListener("click", fitAll);
  popupClose.addEventListener("click", event => {
    event.stopPropagation();
    state.selectedId = null;
    hidePopup();
    updateSelectionStyles();
  });

  retryBtn.addEventListener("click", () => {
    setStatus("Retrying OpenStreetMap background…");
    state.tileErrors = 0;
    state.tileLoadedOnce = false;
    for (const img of state.tiles.values()) img.remove();
    state.tiles.clear();
    scheduleRender();
  });

  const resizeObserver = new ResizeObserver(() => scheduleRender());
  resizeObserver.observe(mapEl);
  window.addEventListener("orientationchange", () => window.setTimeout(scheduleRender, 100));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) window.setTimeout(scheduleRender, 80);
  });

  createSidebar();
  createVectors();
  updateSelectionStyles();
  setStatus("Loading OpenStreetMap background…");
  fitAll();

  window.setTimeout(() => {
    if (!state.tileLoadedOnce) {
      setStatus("The lot viewer is ready. Background map tiles may still be loading or blocked; property outlines remain usable.", "is-error");
    }
  }, 5000);
})();
