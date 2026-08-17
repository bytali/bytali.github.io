/* ============================================================
   Baste & Tanja — interaction layer
   Touch first: tap, vertical swipe, native scrolling. No hover
   dependency, no scroll hijacking, no layout-thrashing animation.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- configuration ----------------------------------
     CEREMONY   the moment the countdown counts down to
     RSVP_ENDPOINT  a URL that accepts a POST (Formspree, Getform,
                    Google Apps Script, your own handler…).
                    Left empty, replies are confirmed locally and
                    logged to the console so you can test the flow.
  ------------------------------------------------------------ */
  var CEREMONY = new Date('2026-12-19T15:00:00+08:00');
  var RSVP_ENDPOINT = '';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  root.dataset.ready = '1';

  /* =========================================================
     1. THE ENVELOPE
     ========================================================= */
  var stage = $('.stage');
  var envelope = $('#envelope');
  var seal = $('#seal');
  var fab = $('#fab');
  var opened = false;

  function openEnvelope(instant) {
    if (opened) return;
    opened = true;

    root.classList.remove('is-sealed');
    root.classList.add('is-open');
    stage.classList.add('is-open');
    envelope.classList.add('is-open');
    seal.setAttribute('aria-expanded', 'true');
    seal.tabIndex = -1;

    // the floating menu only exists once there is something to navigate
    fab.hidden = false;
    window.setTimeout(function () { fab.classList.add('is-visible'); },
      instant || reduceMotion.matches ? 0 : 900);

    // the card is decorative; the real invitation is the page below it
    if (!instant) {
      window.setTimeout(function () {
        $('#invitation').setAttribute('tabindex', '-1');
      }, 0);
    }
  }

  if (seal) {
    seal.setAttribute('aria-expanded', 'false');

    // visual confirmation lands within a frame, ahead of the animation
    seal.addEventListener('pointerdown', function () {
      seal.classList.add('is-pressed');
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (evt) {
      seal.addEventListener(evt, function () { seal.classList.remove('is-pressed'); });
    });
    seal.addEventListener('click', function () { openEnvelope(false); });
  }

  // arriving on a deep link (a shared #rsvp, say) skips the seal
  if (window.location.hash && window.location.hash !== '#top') {
    openEnvelope(true);
    window.requestAnimationFrame(function () {
      var target = document.getElementById(window.location.hash.slice(1));
      if (target) target.scrollIntoView();
    });
  }

  /* =========================================================
     2. SCROLL REVEALS  (observation only — scrolling stays native)
     ========================================================= */
  var revealables = $$('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion.matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    revealables.forEach(function (el) { io.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* =========================================================
     3. COUNTDOWN
     ========================================================= */
  var cd = {
    days: $('#cdDays'), hours: $('#cdHours'),
    mins: $('#cdMins'), secs: $('#cdSecs'),
    units: $('.countdown__units'), done: $('#cdDone')
  };
  var cdTimer = null;

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function tickCountdown() {
    var diff = CEREMONY - new Date();
    if (diff <= 0) {
      cd.units.hidden = true;
      cd.done.hidden = false;
      stopCountdown();
      return;
    }
    var s = Math.floor(diff / 1000);
    cd.days.textContent = Math.floor(s / 86400);
    cd.hours.textContent = pad(Math.floor(s % 86400 / 3600));
    cd.mins.textContent = pad(Math.floor(s % 3600 / 60));
    cd.secs.textContent = pad(s % 60);
  }
  function startCountdown() {
    if (cdTimer) return;
    tickCountdown();
    cdTimer = window.setInterval(tickCountdown, 1000);
  }
  function stopCountdown() {
    window.clearInterval(cdTimer);
    cdTimer = null;
  }
  startCountdown();
  // don't burn battery on a backgrounded tab
  document.addEventListener('visibilitychange', function () {
    document.hidden ? stopCountdown() : startCountdown();
  });

  /* =========================================================
     4. BOTTOM SHEET NAVIGATION
     ========================================================= */
  var sheet = $('#sheet');
  var backdrop = $('#sheetBackdrop');
  var sheetClose = $('#sheetClose');
  var sheetLinks = $$('.sheet__list a');
  var lastFocus = null;

  function openSheet() {
    lastFocus = document.activeElement;
    sheet.hidden = false;
    backdrop.hidden = false;
    sheet.setAttribute('aria-hidden', 'false');
    fab.setAttribute('aria-expanded', 'true');
    window.requestAnimationFrame(function () {
      sheet.classList.add('is-open');
      backdrop.classList.add('is-visible');
    });
    sheetLinks[0].focus({ preventScroll: true });
  }

  function closeSheet() {
    sheet.classList.remove('is-open');
    backdrop.classList.remove('is-visible');
    sheet.setAttribute('aria-hidden', 'true');
    fab.setAttribute('aria-expanded', 'false');
    window.setTimeout(function () {
      sheet.hidden = true;
      backdrop.hidden = true;
    }, reduceMotion.matches ? 0 : 340);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }

  fab.addEventListener('click', function () {
    sheet.hidden ? openSheet() : closeSheet();
  });
  backdrop.addEventListener('click', closeSheet);
  sheetClose.addEventListener('click', closeSheet);
  sheetLinks.forEach(function (a) {
    a.addEventListener('click', function () { closeSheet(); });
  });

  // keep tab focus inside the sheet while it is up
  sheet.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var items = sheetLinks.concat([sheetClose]);
    var first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // filling in a reply should never mean tapping around the menu button
  form_focus_guard();
  function form_focus_guard() {
    var rsvpSection = $('#rsvp');
    rsvpSection.addEventListener('focusin', function () { fab.classList.add('is-tucked'); });
    rsvpSection.addEventListener('focusout', function () {
      window.setTimeout(function () {
        if (!rsvpSection.contains(document.activeElement)) fab.classList.remove('is-tucked');
      }, 60);
    });
  }

  /* =========================================================
     5. MAPS  (nothing loads, and nothing traps a scroll,
               until the guest asks for it)
     ========================================================= */
  $$('[data-map]').forEach(function (map) {
    var trigger = $('[data-map-open]', map);
    trigger.addEventListener('click', function () {
      var frame = document.createElement('iframe');
      frame.src = map.dataset.src;
      frame.loading = 'lazy';
      frame.title = 'Map';
      frame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
      frame.allowFullscreen = true;
      map.appendChild(frame);
      map.classList.add('is-live');
    });
  });

  /* =========================================================
     6. LIGHTBOX
     ========================================================= */
  var lb = $('#lightbox');
  var lbImg = $('#lbImg');
  var lbStage = $('#lbStage');
  var lbCaption = $('#lbCaption');
  var lbCount = $('#lbCount');
  var lbClose = $('#lbClose');
  var lbPrev = $('#lbPrev');
  var lbNext = $('#lbNext');
  var lbReturn = null;
  var current = 0;

  var photos = $$('.gal__btn').map(function (btn) {
    var img = $('img', btn);
    var srcset = img.getAttribute('srcset') || '';
    var largest = srcset.split(',').pop().trim().split(' ')[0] || img.src;
    var cap = btn.closest('figure').querySelector('figcaption');
    return { src: largest, alt: img.alt, caption: cap ? cap.textContent : img.alt, trigger: btn };
  });

  function show(i, animate) {
    current = (i + photos.length) % photos.length;
    var p = photos[current];
    if (animate) {
      lbStage.classList.add('is-swapping');
      window.setTimeout(function () {
        lbImg.src = p.src; lbImg.alt = p.alt;
        lbStage.classList.remove('is-swapping');
      }, reduceMotion.matches ? 0 : 130);
    } else {
      lbImg.src = p.src; lbImg.alt = p.alt;
    }
    lbCaption.textContent = p.caption;
    lbCount.textContent = (current + 1) + ' / ' + photos.length;
    // warm the next frame so a swipe feels instant
    var next = photos[(current + 1) % photos.length];
    new Image().src = next.src;
  }

  function openLightbox(i) {
    lbReturn = document.activeElement;
    lb.hidden = false;
    root.classList.add('is-locked');
    show(i, false);
    window.requestAnimationFrame(function () { lb.classList.add('is-open'); });
    lbClose.focus({ preventScroll: true });
  }

  function closeLightbox() {
    lb.classList.remove('is-open');
    root.classList.remove('is-locked');
    window.setTimeout(function () {
      lb.hidden = true;
      lbImg.removeAttribute('src');
    }, reduceMotion.matches ? 0 : 250);
    if (lbReturn) lbReturn.focus({ preventScroll: true });
  }

  photos.forEach(function (p, i) {
    p.trigger.addEventListener('click', function () { openLightbox(i); });
  });
  lbClose.addEventListener('click', closeLightbox);
  lbPrev.addEventListener('click', function () { show(current - 1, true); });
  lbNext.addEventListener('click', function () { show(current + 1, true); });

  // swipe left / right
  var touchX = 0, touchY = 0;
  lbStage.addEventListener('touchstart', function (e) {
    touchX = e.changedTouches[0].clientX;
    touchY = e.changedTouches[0].clientY;
  }, { passive: true });
  lbStage.addEventListener('touchend', function (e) {
    var dx = e.changedTouches[0].clientX - touchX;
    var dy = e.changedTouches[0].clientY - touchY;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) show(current + (dx < 0 ? 1 : -1), true);
  }, { passive: true });

  document.addEventListener('keydown', function (e) {
    if (!lb.hidden) {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') show(current + 1, true);
      if (e.key === 'ArrowLeft') show(current - 1, true);
      if (e.key === 'Tab') {
        var items = [lbClose, lbPrev, lbNext];
        var first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      return;
    }
    if (e.key === 'Escape' && !sheet.hidden) closeSheet();
  });

  /* =========================================================
     7. RSVP
     ========================================================= */
  var form = $('#rsvpForm');
  var conditional = $('#attendingFields');
  var conditionalInner = $('.conditional__inner', conditional);
  var status = $('#formStatus');
  var submitBtn = $('#rsvpSubmit');
  var done = $('#rsvpDone');
  var doneTitle = $('#rsvpDoneTitle');
  var doneBody = $('#rsvpDoneBody');
  var nameInput = $('#guestName');

  function setConditional(open) {
    conditional.dataset.open = open ? 'true' : 'false';
    conditionalInner.inert = !open;          // keeps hidden fields off the tab order
    $$('input, select', conditionalInner).forEach(function (el) {
      el.disabled = !open;                   // and out of the submitted payload
    });
  }
  setConditional(false);

  $$('input[name="attending"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      setConditional(radio.value === 'yes');
      clearError('attending');
    });
  });

  function showError(field, message) {
    var box = $('#err-' + field);
    if (box) { box.textContent = message; box.hidden = false; }
    var input = form.elements[field === 'guestName' ? 'name' : field];
    if (input && input.setAttribute) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', 'err-' + field);
    }
  }
  function clearError(field) {
    var box = $('#err-' + field);
    if (box) { box.hidden = true; box.textContent = ''; }
    var input = form.elements[field === 'guestName' ? 'name' : field];
    if (input && input.removeAttribute) input.removeAttribute('aria-invalid');
  }

  nameInput.addEventListener('input', function () {
    if (nameInput.value.trim()) clearError('guestName');
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearError('guestName');
    clearError('attending');

    var name = nameInput.value.trim();
    var attending = form.querySelector('input[name="attending"]:checked');

    if (!name) {
      showError('guestName', 'Tell us who is replying so we can find you on the list.');
      nameInput.focus();
      return;
    }
    if (!attending) {
      showError('attending', 'Choose one so we know whether to set a place for you.');
      form.querySelector('input[name="attending"]').focus();
      return;
    }

    var payload = {
      name: name,
      attending: attending.value,
      guests: attending.value === 'yes' ? $('#guestCount').value : '0',
      companion: attending.value === 'yes' ? $('#companion').value.trim() : '',
      diet: attending.value === 'yes' ? $('#diet').value.trim() : '',
      message: $('#message').value.trim(),
      sentAt: new Date().toISOString()
    };

    submitBtn.disabled = true;
    status.textContent = 'Sending your reply…';

    var finish = function () {
      form.hidden = true;
      done.hidden = false;
      doneTitle.textContent = payload.attending === 'yes'
        ? 'We will see you there'
        : 'Thank you for telling us';
      doneBody.textContent = payload.attending === 'yes'
        ? 'Your reply is in, ' + payload.name.split(' ')[0] + '. Details for the day are above, and we will send directions again the week before.'
        : 'You will be missed, ' + payload.name.split(' ')[0] + '. We will raise a glass to you anyway.';
      done.scrollIntoView({ block: 'center', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      doneTitle.setAttribute('tabindex', '-1');
      doneTitle.focus({ preventScroll: true });
    };

    if (!RSVP_ENDPOINT) {
      console.info('RSVP (no endpoint configured — see README):', payload);
      window.setTimeout(finish, 400);
      return;
    }

    fetch(RSVP_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) throw new Error(res.status);
      finish();
    }).catch(function () {
      submitBtn.disabled = false;
      status.textContent = 'That did not send. Check your connection and try again, or message Ate Marisol at 0917 123 4567.';
    });
  });

  $('#rsvpAgain').addEventListener('click', function () {
    form.reset();
    setConditional(false);
    status.textContent = '';
    submitBtn.disabled = false;
    done.hidden = true;
    form.hidden = false;
    nameInput.focus();
  });
})();
