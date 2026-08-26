(() => {
  "use strict";

  if (window.__PROPERTY_LOT_MAP_STARTED__) return;
  window.__PROPERTY_LOT_MAP_STARTED__ = true;

  const STATUS_COLORS = {
    Available: "#25885f",
    Reserved: "#c68a21",
    Sold: "#737873"
  };

  const lotData = Array.isArray(window.LOT_DATA) ? window.LOT_DATA : [];
  const mapElement = document.getElementById("map");
  const listElement = document.getElementById("lot-list");
  const statusElement = document.getElementById("map-status");
  const resetButton = document.getElementById("reset-view");
  const retryButton = document.getElementById("retry-map");

  let map = null;
  let tileLayer = null;
  let allLotsBounds = null;
  let selectedLotId = null;
  let resizeTimer = null;
  let tileErrorCount = 0;
  let tileRetryDone = false;
  const polygonById = new Map();
  const cardById = new Map();

  function setStatus(message, state = "") {
    if (!statusElement) return;
    statusElement.textContent = message;
    statusElement.classList.remove("is-ok", "is-error");
    if (state) statusElement.classList.add(state);
  }

  function isValidCoordinate(point) {
    return Array.isArray(point)
      && point.length >= 2
      && Number.isFinite(Number(point[0]))
      && Number.isFinite(Number(point[1]))
      && Number(point[0]) >= -90
      && Number(point[0]) <= 90
      && Number(point[1]) >= -180
      && Number(point[1]) <= 180;
  }

  function getValidLots() {
    return lotData.filter((lot) => lot
      && typeof lot.id === "string"
      && Array.isArray(lot.coordinates)
      && lot.coordinates.length >= 3
      && lot.coordinates.every(isValidCoordinate));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function popupHtml(lot) {
    return `
      <div class="lot-popup">
        <h3>${escapeHtml(lot.id)}</h3>
        <dl>
          <dt>Area</dt><dd>${escapeHtml(lot.area || "—")}</dd>
          <dt>Price</dt><dd>${escapeHtml(lot.price || "—")}</dd>
          <dt>Status</dt><dd>${escapeHtml(lot.status || "—")}</dd>
        </dl>
      </div>`;
  }

  function safeInvalidateSize(delay = 70) {
    if (!map) return;
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (!map) return;
      map.invalidateSize({ pan: false, animate: false });
    }, delay);
  }

  function fitAllLots() {
    if (!map || !allLotsBounds?.isValid()) return;
    map.invalidateSize({ pan: false, animate: false });
    map.fitBounds(allLotsBounds, {
      padding: [34, 34],
      maxZoom: 19,
      animate: false
    });
  }

  function selectLot(lotId, openPopup = true) {
    if (!map) return;
    selectedLotId = lotId;

    cardById.forEach((card, id) => card.classList.toggle("is-selected", id === lotId));
    polygonById.forEach((polygon, id) => {
      const baseColor = STATUS_COLORS[polygon.__lot.status] || "#666666";
      polygon.setStyle({
        color: baseColor,
        weight: id === lotId ? 5 : 3,
        fillOpacity: id === lotId ? 0.56 : 0.34
      });
    });

    const polygon = polygonById.get(lotId);
    if (!polygon) return;

    map.invalidateSize({ pan: false, animate: false });
    map.fitBounds(polygon.getBounds(), {
      padding: [70, 70],
      maxZoom: 19,
      animate: false
    });
    if (openPopup) polygon.openPopup();
  }

  function buildSidebar(validLots) {
    listElement.replaceChildren();
    validLots.forEach((lot) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "lot-card";
      card.setAttribute("aria-label", `View ${lot.id}`);

      const statusClass = String(lot.status || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
      card.innerHTML = `
        <div class="lot-card-top">
          <h2 class="lot-title">${escapeHtml(lot.id)}</h2>
          <span class="status-pill status-${statusClass}">${escapeHtml(lot.status || "Unknown")}</span>
        </div>
        <div class="lot-meta">
          <span>${escapeHtml(lot.area || "Area not provided")}</span>
          <span>${escapeHtml(lot.price || "Price not provided")}</span>
        </div>`;

      card.addEventListener("click", () => selectLot(lot.id));
      listElement.appendChild(card);
      cardById.set(lot.id, card);
    });
  }

  function redrawTiles() {
    if (!tileLayer || !map) return;
    tileErrorCount = 0;
    setStatus("Retrying background map…");
    tileLayer.redraw();
    safeInvalidateSize(30);
  }

  function createMap(validLots) {
    map = L.map(mapElement, {
      preferCanvas: true,
      zoomControl: true,
      attributionControl: true,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 80,
      fadeAnimation: false,
      markerZoomAnimation: false,
      zoomAnimation: false,
      inertia: true
    });

    tileLayer = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        minZoom: 2,
        maxNativeZoom: 19,
        maxZoom: 20,
        keepBuffer: 2
      }
    );

    tileLayer.on("loading", () => setStatus("Loading background map…"));
    tileLayer.on("load", () => {
      if (tileErrorCount === 0) {
        setStatus("Map ready", "is-ok");
      } else {
        setStatus("Lot map is ready. A few background tiles could not load.", "is-error");
      }
    });
    tileLayer.on("tileerror", () => {
      tileErrorCount += 1;
      setStatus("Background map connection is unstable. Lot boundaries remain usable; press Retry map if needed.", "is-error");
      if (!tileRetryDone && tileErrorCount <= 3) {
        tileRetryDone = true;
        window.setTimeout(redrawTiles, 1600);
      }
    });
    tileLayer.addTo(map);

    const boundsAccumulator = [];
    validLots.forEach((lot) => {
      const baseColor = STATUS_COLORS[lot.status] || "#666666";
      const polygon = L.polygon(lot.coordinates, {
        color: baseColor,
        weight: 3,
        opacity: 1,
        fillColor: baseColor,
        fillOpacity: 0.34,
        smoothFactor: 0.5,
        bubblingMouseEvents: false
      }).addTo(map);

      polygon.__lot = lot;
      polygon.bindPopup(popupHtml(lot), {
        closeButton: true,
        autoPan: true,
        keepInView: true,
        maxWidth: 280
      });
      polygon.bindTooltip(lot.id, {
        permanent: true,
        direction: "center",
        className: "lot-label",
        opacity: 1,
        interactive: false
      });

      polygon.on("click", () => selectLot(lot.id, false));
      polygon.on("mouseover", () => {
        if (selectedLotId !== lot.id) polygon.setStyle({ fillOpacity: 0.48, weight: 4 });
      });
      polygon.on("mouseout", () => {
        if (selectedLotId !== lot.id) polygon.setStyle({ fillOpacity: 0.34, weight: 3 });
      });

      polygonById.set(lot.id, polygon);
      lot.coordinates.forEach((point) => boundsAccumulator.push(point));
    });

    allLotsBounds = L.latLngBounds(boundsAccumulator);
    resetButton.disabled = false;
    retryButton.disabled = false;

    resetButton.addEventListener("click", () => {
      selectedLotId = null;
      cardById.forEach((card) => card.classList.remove("is-selected"));
      polygonById.forEach((polygon) => {
        const color = STATUS_COLORS[polygon.__lot.status] || "#666666";
        polygon.setStyle({ color, weight: 3, fillOpacity: 0.34 });
        polygon.closePopup();
      });
      fitAllLots();
    });

    retryButton.addEventListener("click", redrawTiles);

    map.whenReady(() => {
      requestAnimationFrame(() => {
        map.invalidateSize({ pan: false, animate: false });
        fitAllLots();
      });
    });
  }

  function installResizeRecovery() {
    window.addEventListener("resize", () => safeInvalidateSize(80), { passive: true });
    window.addEventListener("orientationchange", () => safeInvalidateSize(200), { passive: true });
    window.addEventListener("pageshow", () => safeInvalidateSize(120), { passive: true });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) safeInvalidateSize(120);
    });

    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(() => safeInvalidateSize(60));
      observer.observe(mapElement);
      observer.observe(mapElement.parentElement);
    }

    [200, 600, 1200].forEach((delay) => window.setTimeout(() => safeInvalidateSize(0), delay));
  }

  function init() {
    if (!mapElement || !listElement || !statusElement || !resetButton || !retryButton) return;
    if (typeof window.L === "undefined") {
      setStatus("Leaflet map engine is unavailable. Press Retry map.", "is-error");
      return;
    }

    const validLots = getValidLots();
    if (validLots.length === 0) {
      setStatus("No valid lot polygons found. Check lots.js and provide at least 3 valid coordinates per lot.", "is-error");
      return;
    }
    if (validLots.length !== lotData.length) {
      setStatus("Some lots were skipped because their coordinates were invalid.", "is-error");
    }

    buildSidebar(validLots);
    createMap(validLots);
    installResizeRecovery();
  }

  init();
})();
