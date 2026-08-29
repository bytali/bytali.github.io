/* ============================================================
   Amara & Julian — interaction layer
   No dependencies, no network, no build step.
   ============================================================ */
(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;
  var $ = function (id) { return doc.getElementById(id); };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel));
  };

  /* ---- the moment everything counts toward: 17 Oct 2026, 4:30pm ET ---- */
  var WEDDING = new Date("2026-10-17T16:30:00-04:00");
  var WEDDING_END = new Date("2026-10-18T00:00:00-04:00");
  var STORE_KEY = "aj-rsvp-2026";

  var reduced = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false, addEventListener: null };

  var fine = window.matchMedia
    ? window.matchMedia("(hover: hover) and (pointer: fine)").matches
    : false;

  /* ---- capability check: fall back to a plain readable page ---- */
  var css = window.CSS;
  var can = css && typeof css.supports === "function";
  var ok3d = can && css.supports("transform-style", "preserve-3d");
  var okClip = can && css.supports("clip-path", "polygon(0 0,100% 0,50% 100%)");
  var legacy = !ok3d || !okClip;
  if (legacy) root.className += " legacy";

  var raf = window.requestAnimationFrame
    ? window.requestAnimationFrame.bind(window)
    : function (fn) { return setTimeout(fn, 16); };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  /* ============================================================
     TOAST
     ============================================================ */
  var toastEl = $("toast");
  var toastTimer = 0;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.className = "toast show";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.className = "toast";
    }, 2600);
  }

  function copyText(text, okMsg) {
    function fallback() {
      var ta = doc.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
      doc.body.appendChild(ta);
      ta.select();
      try { doc.execCommand("copy"); toast(okMsg); }
      catch (e) { toast("Press and hold to copy: " + text); }
      doc.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast(okMsg);
      })["catch"](fallback);
    } else {
      fallback();
    }
  }

  /* ============================================================
     SPLIT THE NAMES INTO ANIMATABLE LETTERS
     ============================================================ */
  $$("[data-split]").forEach(function (el, wordIndex) {
    var text = el.textContent.trim();
    var frag = doc.createDocumentFragment();
    for (var i = 0; i < text.length; i++) {
      var s = doc.createElement("span");
      s.className = "ch";
      s.textContent = text.charAt(i);
      s.style.setProperty("--d", (wordIndex * 0.18 + i * 0.055).toFixed(3) + "s");
      frag.appendChild(s);
    }
    el.textContent = "";
    el.appendChild(frag);
  });

  /* ============================================================
     PETALS — ambient drift, bursts on demand
     ============================================================ */
  var petals = (function () {
    var cv = $("petals");
    if (!cv || legacy || reduced.matches) return { burst: function () {}, start: function () {} };

    var ctx = cv.getContext("2d");
    if (!ctx) return { burst: function () {}, start: function () {} };

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0, h = 0;
    var bits = [];
    var running = false;
    var tones = ["#e9b9a6", "#d9b166", "#f4dda8", "#c98f7a", "#efe0c8"];

    function size() {
      w = window.innerWidth;
      h = window.innerHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      cv.style.width = w + "px";
      cv.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function Bit(burst) {
      this.reset(burst);
    }
    Bit.prototype.reset = function (burst) {
      if (burst) {
        this.x = w / 2 + (Math.random() - 0.5) * w * 0.34;
        this.y = h * 0.46 + (Math.random() - 0.5) * h * 0.18;
        this.vy = -1.6 - Math.random() * 2.6;
        this.vx = (Math.random() - 0.5) * 4.2;
        this.life = 1;
        this.decay = 0.004 + Math.random() * 0.004;
      } else {
        this.x = Math.random() * w;
        this.y = -20 - Math.random() * h * 0.6;
        this.vy = 0.32 + Math.random() * 0.62;
        this.vx = (Math.random() - 0.5) * 0.34;
        this.life = 1;
        this.decay = 0;
      }
      this.r = 3 + Math.random() * 6;
      this.rot = Math.random() * Math.PI * 2;
      this.spin = (Math.random() - 0.5) * 0.045;
      this.sway = Math.random() * Math.PI * 2;
      this.swaySpeed = 0.012 + Math.random() * 0.02;
      this.tone = tones[(Math.random() * tones.length) | 0];
      this.alpha = 0.3 + Math.random() * 0.45;
    };

    Bit.prototype.step = function () {
      this.sway += this.swaySpeed;
      this.x += this.vx + Math.sin(this.sway) * 0.5;
      this.y += this.vy;
      this.rot += this.spin;

      if (this.decay) {
        this.vy += 0.045;          /* burst petals fall back down */
        this.vx *= 0.988;
        this.life -= this.decay;
      }

      if (this.y > h + 30 || this.life <= 0) {
        if (this.decay) return false;
        this.reset(false);
      }
      if (this.x < -40) this.x = w + 30;
      if (this.x > w + 40) this.x = -30;
      return true;
    };

    Bit.prototype.draw = function () {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.globalAlpha = this.alpha * (this.decay ? Math.max(this.life, 0) : 1);
      ctx.fillStyle = this.tone;
      ctx.beginPath();
      /* a soft petal: two arcs meeting at the tips */
      ctx.moveTo(0, -this.r);
      ctx.quadraticCurveTo(this.r * 0.92, 0, 0, this.r);
      ctx.quadraticCurveTo(-this.r * 0.5, 0, 0, -this.r);
      ctx.fill();
      ctx.restore();
    };

    function loop() {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (var i = bits.length - 1; i >= 0; i--) {
        if (!bits[i].step()) { bits.splice(i, 1); continue; }
        bits[i].draw();
      }
      raf(loop);
    }

    var api = {
      start: function () {
        if (running) return;
        size();
        var count = window.innerWidth < 700 ? 16 : 30;
        for (var i = 0; i < count; i++) bits.push(new Bit(false));
        running = true;
        loop();
      },
      burst: function (n) {
        if (!running) { size(); running = true; loop(); }
        for (var i = 0; i < (n || 46); i++) bits.push(new Bit(true));
      }
    };

    window.addEventListener("resize", function () { if (running) size(); }, false);

    doc.addEventListener("visibilitychange", function () {
      if (doc.hidden) { running = false; }
      else if (bits.length) { running = true; loop(); }
    });

    return api;
  }());

  /* ============================================================
     ENVELOPE GATE
     ============================================================ */
  var gate = $("gate");
  var stage = $("envStage");
  var site = $("site");
  var opened = false;

  /* stagger the "You are invited" letters */
  $$("#gateKicker span").forEach(function (s, i) {
    s.style.animationDelay = (0.12 + i * 0.045).toFixed(3) + "s";
  });

  function revealSite() {
    if (!site) return;
    site.className = "site is-live";
    root.className = root.className.replace(/\s*gate-locked/, "");
    petals.start();
    scan();
    render();
    setTimeout(function () { petals.burst(40); }, 220);
  }

  function openGate() {
    if (opened || legacy) return;
    opened = true;

    if (stage) {
      stage.className = "env-stage is-open";
      stage.setAttribute("aria-expanded", "true");
      stage.disabled = true;
    }

    if (gate) gate.className = "gate opening";

    if (reduced.matches) {
      if (gate) gate.className = "gate opening is-gone";
      revealSite();
      return;
    }

    petals.start();
    setTimeout(function () { petals.burst(30); }, 380);   /* seal cracks */

    setTimeout(function () {
      if (gate) gate.className = "gate opening is-gone";
      revealSite();
    }, 2450);

    setTimeout(function () {
      if (gate) gate.style.display = "none";
    }, 3550);
  }

  if (legacy) {
    if (gate) gate.style.display = "none";
    if (site) site.className = "site is-live";
  } else {
    root.className += " gate-locked";
    if (stage) stage.addEventListener("click", openGate, false);
  }

  /* envelope tilt follows the pointer */
  if (gate && stage && fine && !reduced.matches && !legacy) {
    var env = stage.querySelector(".env");
    gate.addEventListener("pointermove", function (e) {
      if (opened || !env) return;
      var r = stage.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      env.style.setProperty("--ty", (x * 13).toFixed(2) + "deg");
      env.style.setProperty("--tx", (-y * 9).toFixed(2) + "deg");
    }, false);
    gate.addEventListener("pointerleave", function () {
      if (!env) return;
      env.style.setProperty("--ty", "0deg");
      env.style.setProperty("--tx", "0deg");
    }, false);
  }

  /* ============================================================
     SCROLL — progress, parallax, time of day
     ============================================================ */
  var bar = $("progressBar");
  var layers = $$("[data-depth]");
  var ticking = false;

  function render() {
    var vh = window.innerHeight || root.clientHeight || 1;
    var docH = Math.max(
      doc.body.scrollHeight, root.scrollHeight,
      doc.body.offsetHeight, root.offsetHeight
    ) - vh;
    var y = window.pageYOffset || root.scrollTop || 0;
    var p = docH > 0 ? clamp(y / docH, 0, 1) : 0;

    if (bar) bar.style.width = (p * 100).toFixed(2) + "%";

    /* afternoon fades out, candlelight comes up */
    root.style.setProperty("--sun", (1 - clamp(p * 1.45, 0, 1)).toFixed(3));
    root.style.setProperty("--dusk", clamp((p - 0.28) * 1.7, 0, 1).toFixed(3));

    if (!reduced.matches) {
      var scale = window.innerWidth <= 700 ? 0.45 : 1;
      for (var i = 0; i < layers.length; i++) {
        var el = layers[i];
        var r = el.getBoundingClientRect();
        if (r.bottom < -vh || r.top > vh * 2) continue;
        var mid = (r.top + r.height / 2) - vh / 2;
        var prog = clamp(mid / vh, -1, 1);
        var depth = parseFloat(el.getAttribute("data-depth")) || 0;
        el.style.setProperty("--py", (prog * depth * 170 * scale).toFixed(1) + "px");
      }
    }
    ticking = false;
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    raf(render);
  }

  var passive = false;
  try {
    var opts = Object.defineProperty({}, "passive", {
      get: function () { passive = { passive: true }; return true; }
    });
    window.addEventListener("t", null, opts);
    window.removeEventListener("t", null, opts);
  } catch (e) { passive = false; }

  window.addEventListener("scroll", onScroll, passive);
  window.addEventListener("resize", onScroll, passive);
  render();

  /* ============================================================
     REVEALS — staggered per section
     ============================================================ */
  var observer = null;
  function scan() {
    var items = $$(".anim:not(.is-in), .timeline li:not(.is-in)");
    if (!("IntersectionObserver" in window) || reduced.matches || legacy) {
      items.forEach(function (el) { el.className += " is-in"; });
      return;
    }
    if (!observer) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var el = e.target;
          var group = el.parentNode ? $$(".anim, li", el.parentNode) : [el];
          var idx = group.indexOf(el);
          el.style.setProperty("--d", (Math.max(idx, 0) * 0.085).toFixed(3) + "s");
          el.className += " is-in";
          observer.unobserve(el);
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    }
    items.forEach(function (el) { observer.observe(el); });
  }
  scan();

  /* ============================================================
     COUNTDOWN
     ============================================================ */
  var cd = {
    d: $("cdDays"), h: $("cdHours"),
    m: $("cdMins"), s: $("cdSecs")
  };
  var note = $("clockNote");
  var last = {};

  function setDigit(el, key, val) {
    if (!el || last[key] === val) return;
    last[key] = val;
    el.textContent = val;
    if (reduced.matches) return;
    el.className = "digits";
    void el.offsetWidth;          /* restart the animation */
    el.className = "digits tick";
  }

  function tickClock() {
    var now = new Date();
    var diff = WEDDING - now;

    if (diff <= 0) {
      if (now < WEDDING_END) {
        setDigit(cd.d, "d", "00"); setDigit(cd.h, "h", "00");
        setDigit(cd.m, "m", "00"); setDigit(cd.s, "s", "00");
        if (note) note.textContent = "Today is the day. See you under the glass.";
      } else {
        if (note) note.textContent = "Married — 17 October 2026. Thank you for being there.";
      }
      return;
    }

    var secs = Math.floor(diff / 1000);
    setDigit(cd.d, "d", pad(Math.floor(secs / 86400)));
    setDigit(cd.h, "h", pad(Math.floor(secs / 3600) % 24));
    setDigit(cd.m, "m", pad(Math.floor(secs / 60) % 60));
    setDigit(cd.s, "s", pad(secs % 60));
  }
  tickClock();
  setInterval(tickClock, 1000);

  /* ============================================================
     ADD TO CALENDAR — builds a real .ics on the fly
     ============================================================ */
  function icsStamp(d) {
    return d.getUTCFullYear() +
      pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + "T" +
      pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + "Z";
  }

  function addToCalendar() {
    var lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Amara and Julian//Wedding//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      "UID:amara-julian-2026-10-17@invitation",
      "DTSTAMP:" + icsStamp(new Date()),
      "DTSTART:" + icsStamp(WEDDING),
      "DTEND:" + icsStamp(WEDDING_END),
      "SUMMARY:Wedding of Amara Bennett and Julian Hart",
      "LOCATION:The Willow Conservatory\\, 114 Ashley Row\\, Charleston\\, SC",
      "DESCRIPTION:Ceremony at 4:30 PM. Guests welcome from 4:00 PM. Dress code: garden formal.",
      "BEGIN:VALARM",
      "TRIGGER:-P1D",
      "ACTION:DISPLAY",
      "DESCRIPTION:Amara and Julian's wedding is tomorrow",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR"
    ];

    try {
      var blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = doc.createElement("a");
      a.href = url;
      a.download = "amara-and-julian.ics";
      doc.body.appendChild(a);
      a.click();
      doc.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
      toast("Calendar file saved");
    } catch (e) {
      toast("Saturday 17 October 2026, 4:30 PM");
    }
  }

  [$("calBtn"), $("calBtn2")].forEach(function (b) {
    if (b) b.addEventListener("click", addToCalendar, false);
  });

  /* ============================================================
     SHARE
     ============================================================ */
  var shareBtn = $("shareBtn");
  if (shareBtn) {
    shareBtn.addEventListener("click", function () {
      var data = {
        title: "Amara & Julian — 17 October 2026",
        text: "You're invited to the wedding of Amara Bennett and Julian Hart.",
        url: location.href
      };
      if (navigator.share) {
        navigator.share(data)["catch"](function () {});
      } else {
        copyText(location.href, "Link copied");
      }
    }, false);
  }

  /* copy-to-clipboard chips */
  $$("[data-copy]").forEach(function (b) {
    b.addEventListener("click", function () {
      copyText(b.getAttribute("data-copy"), "Copied");
    }, false);
  });

  /* ============================================================
     RSVP
     ============================================================ */
  var form = $("rsvpForm");
  var doneBox = $("rsvpDone");
  var nameIn = $("fName");
  var errName = $("errName");
  var guestField = $("guestField");
  var guestIn = $("fGuests");
  var msgIn = $("fMsg");
  var msgCount = $("msgCount");
  var submitBtn = $("submitBtn");
  var MAXMSG = 280;

  function attending() {
    var r = doc.querySelector("input[name=attending]:checked");
    return r ? r.value : "yes";
  }

  function syncGuestField() {
    if (!guestField) return;
    guestField.className = attending() === "no" ? "field hide" : "field";
  }

  $$("input[name=attending]").forEach(function (r) {
    r.addEventListener("change", syncGuestField, false);
  });

  /* guest stepper */
  function guests() { return parseInt(guestIn ? guestIn.value : "1", 10) || 1; }
  function setGuests(n) {
    n = clamp(n, 1, 8);
    if (guestIn) guestIn.value = n;
    var minus = $("guestMinus"), plus = $("guestPlus");
    if (minus) minus.disabled = n <= 1;
    if (plus) plus.disabled = n >= 8;
  }
  if ($("guestMinus")) $("guestMinus").addEventListener("click", function () { setGuests(guests() - 1); }, false);
  if ($("guestPlus")) $("guestPlus").addEventListener("click", function () { setGuests(guests() + 1); }, false);

  /* message counter */
  if (msgIn && msgCount) {
    msgIn.addEventListener("input", function () {
      if (msgIn.value.length > MAXMSG) msgIn.value = msgIn.value.slice(0, MAXMSG);
      msgCount.textContent = msgIn.value.length;
      msgCount.parentNode.className = msgIn.value.length > MAXMSG - 30 ? "count warn" : "count";
    }, false);
  }

  if (nameIn) {
    nameIn.addEventListener("input", function () {
      if (nameIn.value.trim()) {
        nameIn.className = "";
        if (errName) errName.textContent = "";
      }
    }, false);
  }

  function summarise(r) {
    var out = r.name + " — " + (r.attending === "yes" ? "attending" : "unable to attend");
    if (r.attending === "yes") {
      out += ", " + r.guests + (r.guests === 1 ? " guest" : " guests");
    }
    if (r.diet) out += "\nDietary: " + r.diet;
    if (r.message) out += "\nNote: " + r.message;
    out += "\nRSVP — Amara & Julian, 17 October 2026";
    return out;
  }

  function showDone(r) {
    if (!form || !doneBox) return;
    form.hidden = true;
    doneBox.hidden = false;
    var t = $("doneTitle"), b = $("doneBody");
    if (r.attending === "yes") {
      if (t) t.textContent = "You're on the list";
      if (b) b.textContent = "Thank you, " + r.name.split(" ")[0] + ". We've saved " +
        r.guests + (r.guests === 1 ? " seat" : " seats") +
        " for you on 17 October. Come hungry.";
      petals.burst(60);
    } else {
      if (t) t.textContent = "Reply received";
      if (b) b.textContent = "We'll miss you, " + r.name.split(" ")[0] +
        ". Thank you for letting us know — we'll raise a glass to you anyway.";
    }
    doneBox.setAttribute("data-payload", summarise(r));
  }

  function save(r) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(r)); } catch (e) {}
  }
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || "null"); }
    catch (e) { return null; }
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var nm = nameIn ? nameIn.value.trim() : "";
      if (nm.length < 2) {
        if (nameIn) { nameIn.className = "bad"; nameIn.focus(); }
        if (errName) errName.textContent = "Add your name so we know who's replying.";
        return;
      }

      var reply = {
        name: nm,
        attending: attending(),
        guests: attending() === "yes" ? guests() : 0,
        diet: $("fDiet") ? $("fDiet").value.trim() : "",
        message: msgIn ? msgIn.value.trim() : "",
        sent: new Date().toISOString()
      };

      if (submitBtn) submitBtn.className = "btn btn-solid btn-wide busy";

      setTimeout(function () {
        if (submitBtn) submitBtn.className = "btn btn-solid btn-wide";
        save(reply);
        showDone(reply);
      }, 850);
    }, false);
  }

  if ($("editBtn")) {
    $("editBtn").addEventListener("click", function () {
      if (!form || !doneBox) return;
      doneBox.hidden = true;
      form.hidden = false;
      if (nameIn) nameIn.focus();
    }, false);
  }

  if ($("copyBtn")) {
    $("copyBtn").addEventListener("click", function () {
      copyText(doneBox.getAttribute("data-payload") || "", "Reply copied");
    }, false);
  }

  /* restore a previous reply */
  (function restore() {
    var prev = load();
    if (!prev || !prev.name) { setGuests(1); syncGuestField(); return; }
    if (nameIn) nameIn.value = prev.name;
    if ($("fDiet")) $("fDiet").value = prev.diet || "";
    if (msgIn) {
      msgIn.value = prev.message || "";
      if (msgCount) msgCount.textContent = msgIn.value.length;
    }
    var radio = doc.querySelector("input[name=attending][value=" + prev.attending + "]");
    if (radio) radio.checked = true;
    setGuests(prev.guests || 1);
    syncGuestField();
    showDone(prev);
  }());

  /* ============================================================
     MICRO-INTERACTIONS
     ============================================================ */

  /* ripple */
  $$(".btn").forEach(function (b) {
    b.addEventListener("click", function (e) {
      if (reduced.matches) return;
      var r = b.getBoundingClientRect();
      var d = Math.max(r.width, r.height);
      var s = doc.createElement("span");
      s.className = "ripple";
      s.style.width = s.style.height = d + "px";
      s.style.left = (e.clientX - r.left - d / 2) + "px";
      s.style.top = (e.clientY - r.top - d / 2) + "px";
      b.appendChild(s);
      setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 640);
    }, false);
  });

  /* magnetic buttons */
  if (fine && !reduced.matches) {
    $$("[data-magnet]").forEach(function (b) {
      b.addEventListener("pointermove", function (e) {
        var r = b.getBoundingClientRect();
        b.style.setProperty("--mx", ((e.clientX - r.left - r.width / 2) * 0.16).toFixed(1) + "px");
        b.style.setProperty("--my", ((e.clientY - r.top - r.height / 2) * 0.22).toFixed(1) + "px");
      }, false);
      b.addEventListener("pointerleave", function () {
        b.style.setProperty("--mx", "0px");
        b.style.setProperty("--my", "0px");
      }, false);
    });

    /* pointer glow */
    var glow = $("glow");
    if (glow) {
      var gx = 0, gy = 0, cx = 0, cy = 0, glowing = false;
      window.addEventListener("pointermove", function (e) {
        gx = e.clientX; gy = e.clientY;
        if (!glowing) { glowing = true; glow.className = "glow on"; glowLoop(); }
      }, passive);
      window.addEventListener("pointerleave", function () {
        glow.className = "glow";
      }, false);
      function glowLoop() {
        cx += (gx - cx) * 0.1;
        cy += (gy - cy) * 0.1;
        glow.style.transform = "translate3d(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px,0)";
        raf(glowLoop);
      }
    }
  }

  /* keep reveals working if motion preference flips mid-visit */
  function motionChanged() {
    if (reduced.matches) {
      $$(".anim").forEach(function (el) {
        if (el.className.indexOf("is-in") < 0) el.className += " is-in";
      });
    }
  }
  if (reduced.addEventListener) reduced.addEventListener("change", motionChanged);
  else if (reduced.addListener) reduced.addListener(motionChanged);

  /* skip the gate for anyone landing on a deep link */
  if (!legacy && location.hash && location.hash !== "#top") {
    openGate();
  }
}());
