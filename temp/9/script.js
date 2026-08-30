(function () {
  "use strict";

  var $ = function (selector) { return document.querySelector(selector); };
  var $$ = function (selector) { return Array.prototype.slice.call(document.querySelectorAll(selector)); };

  var progress = $("#progressBar");
  var topbar = $("#topbar");

  function onScroll() {
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
    var max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    if (progress) progress.style.width = Math.min(100, (scrollTop / max) * 100) + "%";
    if (topbar) topbar.classList.toggle("scrolled", scrollTop > 24);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var revealItems = $$(".reveal");
  if (reducedMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach(function (el) { el.classList.add("in"); });
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    revealItems.forEach(function (el) { observer.observe(el); });
  }

  // 12 Dec 2026, 2:30 PM Philippine Standard Time (UTC+8)
  var weddingTime = new Date("2026-12-12T14:30:00+08:00").getTime();
  var days = $("#days");
  var hours = $("#hours");
  var minutes = $("#minutes");
  var seconds = $("#seconds");

  function pad(value, length) {
    var out = String(Math.max(0, value));
    while (out.length < length) out = "0" + out;
    return out;
  }

  function updateCountdown() {
    var distance = weddingTime - Date.now();
    if (distance <= 0) {
      if (days) days.textContent = "000";
      if (hours) hours.textContent = "00";
      if (minutes) minutes.textContent = "00";
      if (seconds) seconds.textContent = "00";
      return;
    }
    var d = Math.floor(distance / 86400000);
    var h = Math.floor((distance % 86400000) / 3600000);
    var m = Math.floor((distance % 3600000) / 60000);
    var s = Math.floor((distance % 60000) / 1000);
    if (days) days.textContent = pad(d, 3);
    if (hours) hours.textContent = pad(h, 2);
    if (minutes) minutes.textContent = pad(m, 2);
    if (seconds) seconds.textContent = pad(s, 2);
  }
  updateCountdown();
  setInterval(updateCountdown, 1000);

  var toast = $("#toast");
  var toastTimer;
  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 2400);
  }

  var calendarButton = $("#calendarButton");
  if (calendarButton) {
    calendarButton.addEventListener("click", function () {
      var ics = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Camille and Miguel//Wedding Invitation//EN",
        "CALSCALE:GREGORIAN",
        "BEGIN:VEVENT",
        "UID:camille-miguel-20261212@example.local",
        "DTSTAMP:20260829T000000Z",
        "DTSTART:20261212T063000Z",
        "DTEND:20261212T140000Z",
        "SUMMARY:Camille & Miguel's Wedding",
        "LOCATION:Santuario de San Antonio Parish, Makati City / Shangri-La The Fort, Taguig City",
        "DESCRIPTION:Ceremony at 2:30 PM PHT. Reception follows at 5:30 PM in BGC.",
        "END:VEVENT",
        "END:VCALENDAR"
      ].join("\r\n");
      var blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "camille-miguel-wedding.ics";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      showToast("Calendar file downloaded");
    });
  }

  var form = $("#rsvpForm");
  var status = $("#formStatus");
  if (form) {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem("cmWeddingRsvp") || "null"); } catch (e) {}
    if (saved) {
      if ($("#guestName")) $("#guestName").value = saved.guestName || "";
      if ($("#guestCount")) $("#guestCount").value = saved.guestCount || "1";
      if ($("#guestMessage")) $("#guestMessage").value = saved.guestMessage || "";
      var attendance = document.querySelector('input[name="attendance"][value="' + (saved.attendance || "") + '"]');
      if (attendance) attendance.checked = true;
      if (status) status.textContent = "A saved demo RSVP was found on this device.";
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var data = new FormData(form);
      var payload = {
        guestName: String(data.get("guestName") || "").trim(),
        attendance: String(data.get("attendance") || ""),
        guestCount: String(data.get("guestCount") || "1"),
        guestMessage: String(data.get("guestMessage") || "").trim(),
        savedAt: new Date().toISOString()
      };
      try {
        localStorage.setItem("cmWeddingRsvp", JSON.stringify(payload));
        if (status) status.textContent = "Saved on this device. Connect this form to your backend, Google Sheet, or Formspree for live RSVPs.";
        showToast("RSVP saved on this device");
      } catch (e) {
        if (status) status.textContent = "Your browser blocked local storage. The form is ready to connect to a live RSVP endpoint.";
      }
    });
  }
}());
