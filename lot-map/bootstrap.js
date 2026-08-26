(() => {
  "use strict";

  const status = document.getElementById("map-status");
  const retry = document.getElementById("retry-map");

  const SOURCES = [
    {
      name: "jsDelivr",
      css: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css",
      js: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"
    },
    {
      name: "cdnjs",
      css: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css",
      js: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"
    },
    {
      name: "unpkg",
      css: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
      js: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    }
  ];

  let started = false;
  let loading = false;

  function setStatus(message, isError = false) {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", isError);
    status.classList.remove("is-ok");
  }

  function loadStylesheet(url, timeoutMs = 7000) {
    return new Promise((resolve, reject) => {
      const link = document.createElement("link");
      let settled = false;
      const timer = window.setTimeout(() => finish(false, new Error("Stylesheet timeout")), timeoutMs);

      function finish(ok, value) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        if (!ok) link.remove();
        ok ? resolve(link) : reject(value);
      }

      link.rel = "stylesheet";
      link.href = url;
      link.onload = () => finish(true);
      link.onerror = () => finish(false, new Error("Stylesheet failed"));
      document.head.appendChild(link);
    });
  }

  function loadScript(url, timeoutMs = 7000) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      let settled = false;
      const timer = window.setTimeout(() => finish(false, new Error("Script timeout")), timeoutMs);

      function finish(ok, value) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        if (!ok) script.remove();
        ok ? resolve(script) : reject(value);
      }

      script.src = url;
      script.async = true;
      script.onload = () => finish(true);
      script.onerror = () => finish(false, new Error("Script failed"));
      document.head.appendChild(script);
    });
  }

  async function ensureLeaflet() {
    if (window.L) return true;

    for (const source of SOURCES) {
      setStatus(`Loading map engine from ${source.name}…`);
      try {
        await Promise.all([
          loadStylesheet(source.css),
          loadScript(source.js)
        ]);
        if (window.L) return true;
      } catch (_) {
        // Try the next CDN.
      }
    }
    return false;
  }

  function loadApp() {
    return new Promise((resolve, reject) => {
      const old = document.getElementById("property-map-app-script");
      if (old) old.remove();

      const script = document.createElement("script");
      script.id = "property-map-app-script";
      script.src = `app.js?v=${Date.now()}`;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  async function start() {
    if (loading || started) return;
    loading = true;
    if (retry) retry.disabled = true;

    try {
      const leafletReady = await ensureLeaflet();
      if (!leafletReady) {
        setStatus("Map engine could not load. Check internet access, firewall/ad-blocking, then press Retry map.", true);
        return;
      }

      setStatus("Initializing property map…");
      await loadApp();
      started = true;
    } catch (_) {
      setStatus("The map app could not start. Press Retry map or reload the page.", true);
    } finally {
      loading = false;
      if (retry && !started) retry.disabled = false;
    }
  }

  retry?.addEventListener("click", () => {
    // Before the map app starts, this retries dependency loading.
    // After startup, app.js owns this same button and redraws map tiles.
    if (!started) start();
  });

  if (document.readyState === "complete") {
    start();
  } else {
    window.addEventListener("load", start, { once: true });
  }
})();
