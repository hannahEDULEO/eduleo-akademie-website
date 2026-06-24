/* EDULEO Akademie – main.js */

/* ── Testimonials Karussell ─────────────────── */
(function () {
  var track = document.getElementById('tTrack');
  var dotsWrap = document.getElementById('tDots');
  if (!track || !dotsWrap) return;

  var cards = Array.from(track.querySelectorAll('.testimonial-card'));
  var total = cards.length;
  var current = 0;
  var autoTimer;
  var GAP = 22;
  var viewport = track.parentElement;

  function isMobile() { return window.innerWidth < 768; }
  function visibleCount() { return isMobile() ? 1 : 3; }
  function maxIndex() { return Math.max(0, total - visibleCount()); }

  function updateLayout() {
    if (isMobile()) {
      var w = viewport.offsetWidth;
      track.style.gap = '0px';
      cards.forEach(function(c) { c.style.width = w + 'px'; c.style.flexBasis = w + 'px'; });
    } else {
      track.style.gap = '';
      cards.forEach(function(c) { c.style.width = ''; c.style.flexBasis = ''; });
    }
  }

  function cardWidth() { return cards[0].getBoundingClientRect().width; }

  function stepSize() { return isMobile() ? cardWidth() : cardWidth() + GAP; }

  function goTo(n) {
    current = Math.max(0, Math.min(n, maxIndex()));
    track.style.transform = 'translateX(-' + (current * stepSize()) + 'px)';
    buildDots();
  }

  function buildDots() {
    var max = maxIndex();
    dotsWrap.innerHTML = '';
    for (var i = 0; i <= max; i++) {
      var dot = document.createElement('button');
      dot.className = 't-dot' + (i === current ? ' active' : '');
      dot.setAttribute('aria-label', 'Testimonial ' + (i + 1));
      (function(idx) { dot.addEventListener('click', function() { goTo(idx); resetTimer(); }); })(i);
      dotsWrap.appendChild(dot);
    }
  }

  function resetTimer() {
    clearInterval(autoTimer);
    autoTimer = setInterval(function () {
      goTo(current >= maxIndex() ? 0 : current + 1);
    }, 6000);
  }

  var prevBtn = document.querySelector('.t-prev');
  var nextBtn = document.querySelector('.t-next');
  if (prevBtn) prevBtn.addEventListener('click', function () { goTo(current - 1); resetTimer(); });
  if (nextBtn) nextBtn.addEventListener('click', function () { goTo(current + 1); resetTimer(); });

  var outer = document.querySelector('.t-carousel-outer');
  if (outer) {
    outer.addEventListener('mouseenter', function () { clearInterval(autoTimer); });
    outer.addEventListener('mouseleave', resetTimer);
  }

  window.addEventListener('resize', function () { updateLayout(); goTo(current); });

  updateLayout();
  goTo(0);
  resetTimer();
})();

/* ── Bürozeiten: aktuellen Tag grün markieren ── */
(function () {
  var today = new Date().getDay(); // 0=So, 1=Mo, 2=Di, 3=Mi, 4=Do, 5=Fr, 6=Sa
  var card = document.querySelector('[data-day="' + today + '"]');
  if (card) card.classList.add('buerozeit-card--today');
})();

/* ── Hero Video Fade-in ─────────────────────── */
(function () {
  var v = document.querySelector('.hero-video');
  if (!v) return;
  function show() { v.classList.add('loaded'); }
  if (v.readyState >= 3) { show(); return; }
  v.addEventListener('canplaythrough', show, { once: true });
  v.addEventListener('loadeddata', show, { once: true });
  // Fallback für Mobile-Browser, die Events nicht zuverlässig feuern
  setTimeout(show, 2500);
})();

/* ── SimplyOrg Termin-Widget ─────────────── */
(async function () {
  var widget = document.getElementById('termine-widget');
  if (!widget) return;
  var eventId  = widget.dataset.eventId;
  var eventIds = widget.dataset.eventIds;
  var qualId   = widget.dataset.qualificationId;
  var catId    = widget.dataset.categoryId;
  var catType    = widget.dataset.categoryType;
  var showLabels = widget.dataset.showLabels === 'true';
  if (!eventId && !eventIds && !qualId && !catId) return;

  var firstId = eventIds ? eventIds.split(',')[0].trim() : eventId;
  var portalUrl = catId
    ? 'https://eduleo-akademie.simplyorg-seminare.de/event-list?page=1&categoryId=' + catId
    : qualId
      ? 'https://eduleo-akademie.simplyorg-seminare.de/event-list?page=1&qualificationId=' + qualId
      : 'https://eduleo-akademie.simplyorg-seminare.de/event-details?event_id=' + firstId;

  var MONATE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  function fmtDate(d) {
    var p = d.split('.');
    return parseInt(p[0]) + '. ' + MONATE[parseInt(p[1]) - 1] + ' 20' + p[2];
  }

  try {
    var allDates = [];

    if (eventIds) {
      var ids = eventIds.split(',').map(function(s) { return s.trim(); });
      var responses = await Promise.all(ids.map(function(id) {
        return fetch('/api/termine?event_id=' + id).then(function(r) { return r.json(); });
      }));
      responses.forEach(function(res) {
        if (res.dates) allDates = allDates.concat(res.dates);
      });
      allDates.sort(function(a, b) { return a.dateISO < b.dateISO ? -1 : 1; });
    } else {
      var param = catId    ? 'category_id=' + catId + (catType ? '&category_type=' + catType : '')
                : qualId   ? 'qualification_id=' + qualId
                :            'event_id=' + eventId;
      var resp = await fetch('/api/termine?' + param);
      var data = await resp.json();
      allDates = data.dates || [];
    }

    var select = document.getElementById('tf-termin') || document.getElementById('m3-termin');

    if (allDates.length > 0) {
      widget.innerHTML = allDates.map(function (d) {
        return '<a class="termin-card" href="' + (d.url || portalUrl) + '" target="_blank" rel="noopener">'
          + '<div class="termin-card-info">'
          + '<span class="termin-datum">' + fmtDate(d.date) + (showLabels && d.label ? d.label : '') + '</span>'
          + (d.time ? '<span class="termin-zeit">' + d.time + '</span>' : '')
          + '</div><span class="termin-arrow">→</span></a>';
      }).join('');

      if (select && select.tagName === 'SELECT') {
        allDates.forEach(function (d) {
          var opt = document.createElement('option');
          var lbl = showLabels && d.label ? d.label : '';
          opt.value = d.date + (lbl ? ' ' + lbl : '') + (d.time ? ' · ' + d.time : '');
          opt.textContent = fmtDate(d.date) + lbl + (d.time ? ' · ' + d.time : '');
          select.appendChild(opt);
        });
      }
    } else {
      widget.innerHTML = '<p class="termin-empty">Aktuell keine Termine geplant.<br>Schreib uns – wir setzen dich auf die Warteliste.</p>';
    }
  } catch (e) {
    widget.innerHTML = '<p class="termin-empty">Termine konnten nicht geladen werden.<br>Schreib uns – wir helfen dir weiter.</p>';
  }
})();

/* ── Footer-Grid nachrüsten (Seiten mit Mini-Footer) ── */
(function () {
  var footer = document.querySelector('footer.footer .container');
  if (!footer || footer.querySelector('.footer-grid')) return;
  var grid = document.createElement('div');
  grid.className = 'footer-grid';
  grid.innerHTML =
    '<div class="footer-brand">' +
      '<span class="footer-logo-text">EDULEO <span>Akademie</span></span>' +
      '<p>Online-Fortbildungen für pädagogische Fachkräfte, ErzieherInnen und Kita-Leitungen. Praxisnah. Zertifiziert. Sofort anwendbar.</p>' +
      '<div class="footer-social">' +
        '<a href="https://www.instagram.com/eduleo_akademie" target="_blank" rel="noopener" class="footer-social-link" aria-label="Instagram">📷</a>' +
      '</div>' +
    '</div>' +
    '<div class="footer-col"><h4>Fortbildungen</h4><ul>' +
      '<li><a href="/fortbildungen/">Alle Fortbildungen</a></li>' +
      '<li><a href="/fortbildungen/#3-monate">3-Monats-Fortbildungen</a></li>' +
      '<li><a href="/fortbildungen/#tagesfortbildungen">Tagesfortbildungen</a></li>' +
      '<li><a href="/fortbildungen/teamfortbildungen/">Teamfortbildungen</a></li>' +
    '</ul></div>' +
    '<div class="footer-col"><h4>Über uns</h4><ul>' +
      '<li><a href="/ueber-uns/">Das Team</a></li>' +
      '<li><a href="/ueber-uns/#dozentinnen">DozentInnen</a></li>' +
      '<li><a href="/#kontakt">Kontakt</a></li>' +
    '</ul></div>' +
    '<div class="footer-col"><h4>Rechtliches</h4><ul>' +
      '<li><a href="/impressum.html">Impressum</a></li>' +
      '<li><a href="/datenschutz.html">Datenschutz</a></li>' +
      '<li><a href="/agb.html">AGB</a></li>' +
      '<li><a href="/widerruf.html">Widerruf</a></li>' +
    '</ul></div>';
  footer.insertBefore(grid, footer.firstChild);
})();

/* ── Pinterest im Footer ─────────────────────── */
(function () {
  if (document.querySelector('a[href*="pinterest"]')) return;
  var social = document.querySelector('.footer-social');
  if (!social) return;
  var a = document.createElement('a');
  a.href = 'https://de.pinterest.com/EduleoBerlin/';
  a.target = '_blank';
  a.rel = 'noopener';
  a.className = 'footer-social-link';
  a.setAttribute('aria-label', 'Pinterest');
  a.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>';
  social.appendChild(a);
})();

/* ── Widerruf-Link im Footer ─────────────────── */
(function () {
  if (document.querySelector('a[href*="widerruf"]')) return;
  var agbLink = document.querySelector('.footer-col a[href*="agb"]');
  if (!agbLink) return;
  var li = document.createElement('li');
  li.innerHTML = '<a href="/widerruf.html">Widerruf</a>';
  agbLink.closest('li').after(li);
})();

/* ── Kurzimpressum im Footer ─────────────────── */
(function () {
  var fb = document.querySelector('.footer-bottom');
  if (!fb || document.querySelector('.footer-mini-impressum')) return;
  var mi = document.createElement('div');
  mi.className = 'footer-mini-impressum';
  mi.innerHTML = '<p>Klumper &amp; Flunkert EDULEO GbR &middot; Janine Klumper &amp; Hannah Flunkert &middot; Ortlerweg 39, 12207 Berlin &middot; <a href="mailto:kontakt@eduleo-akademie.de">kontakt@eduleo-akademie.de</a></p>';
  fb.parentNode.insertBefore(mi, fb);
})();

/* ── Cookie-Banner ──────────────────────────── */
(function () {
  if (localStorage.getItem('eduleo-cookies-ok')) return;
  if (document.getElementById('cookie-banner')) return;
  var b = document.createElement('div');
  b.id = 'cookie-banner';
  b.className = 'cookie-floating';
  b.innerHTML =
    '<span class="cookie-icon">🍪</span>' +
    '<p>Diese Website nutzt technisch notwendige Cookies (z. B. für sicheres Hosting über Cloudflare). ' +
    '<a href="/datenschutz.html">Mehr erfahren</a></p>' +
    '<button id="cookie-btn">Alles klar!</button>';
  document.body.appendChild(b);
  document.getElementById('cookie-btn').addEventListener('click', function () {
    localStorage.setItem('eduleo-cookies-ok', '1');
    b.classList.add('hide');
    setTimeout(function () { b.remove(); }, 400);
  });
})();

/* ── Navigation ─────────────────────────────── */
const nav       = document.getElementById('nav');
const hamburger = document.querySelector('.hamburger');
const mobileMenu = document.querySelector('.mobile-menu');

window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 10);
});

if (hamburger) {
  hamburger.addEventListener('click', () => {
    const open = hamburger.classList.toggle('active');
    mobileMenu.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });

  document.querySelectorAll('.mobile-menu a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('active');
      mobileMenu.classList.remove('open');
      hamburger.setAttribute('aria-expanded', false);
      document.body.style.overflow = '';
    });
  });
}

/* ── Scroll-Animationen ─────────────────────── */
const animatedEls = document.querySelectorAll('.fade-in, .slide-up, .slide-left, .slide-right');

if (animatedEls.length && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  animatedEls.forEach(el => observer.observe(el));
} else {
  animatedEls.forEach(el => el.classList.add('visible'));
}

/* ── FAQ Accordion ──────────────────────────── */
document.querySelectorAll('.faq-question').forEach(question => {
  question.addEventListener('click', () => {
    const item = question.closest('.faq-item');
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(el => el.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
  });
});

/* ── Stats Zähler-Animation ─────────────────── */
const statNumbers = document.querySelectorAll('.stat-number[data-target]');
if (statNumbers.length && 'IntersectionObserver' in window) {
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.target, 10);
      const startVal = parseInt(el.dataset.from || '0', 10);
      const suffix = el.dataset.suffix || '';
      counterObserver.unobserve(el);
      if (target === startVal) { el.textContent = target + suffix; return; }
      const duration = 1400;
      const startTime = Date.now();
      function tick() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(startVal + (target - startVal) * ease);
        el.textContent = current + suffix;
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.5 });
  statNumbers.forEach(el => counterObserver.observe(el));
}

/* ── Kurs-Filter (Übersichtsseite) ──────────── */
const filterTabs = document.querySelectorAll('.filter-tab');
if (filterTabs.length) {
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const filter = tab.dataset.filter;

      document.querySelectorAll('.filterable').forEach(el => {
        if (filter === 'all' || el.dataset.type === filter) {
          el.style.display = '';
        } else {
          el.style.display = 'none';
        }
      });

      document.querySelectorAll('.filter-section').forEach(section => {
        const hasVisible = [...section.querySelectorAll('.filterable')]
          .some(el => el.style.display !== 'none');
        section.style.display = (filter === 'all' || hasVisible) ? '' : 'none';
      });
    });
  });
}


/* ── Back-to-top Button ─────────────────────── */
(function () {
  var btn = document.createElement('button');
  btn.id = 'back-to-top';
  btn.setAttribute('aria-label', 'Nach oben scrollen');
  btn.innerHTML = '&#8679;';
  document.body.appendChild(btn);
  window.addEventListener('scroll', function () {
    if (window.scrollY > 400) btn.classList.add('visible');
    else btn.classList.remove('visible');
  }, { passive: true });
  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();
