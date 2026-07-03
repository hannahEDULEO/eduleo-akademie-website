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

/* ── Sitesuche ──────────────────────────────── */
(function () {
  var IDX = [
    // ── Blogartikel (Top-Level) ──
    { t: 'ADHS in der Kita', s: 'Verstehen und begleiten', u: '/adhs-in-der-kita-verstehen-und-begleiten/', c: 'blog', k: 'aufmerksamkeit hyperaktivität verhaltensauffälligkeit konzentration adhs' },
    { t: 'Autismus in der Kita', s: 'Grundlagenwissen für Fachkräfte', u: '/autismus-in-der-kita/', c: 'blog', k: 'asd asperger inklusion neurodiversität verhalten autismus' },
    { t: 'Autismus & Kita-Eingewöhnung', s: 'Fahrplan durch die Eingewöhnung', u: '/autismus-in-der-kita-eingewöhnung/', c: 'blog', k: 'eingewöhnung start übergang autismus konflikt' },
    { t: 'Autismus und TEACCH', s: 'Leitfaden für pädagogische Fachkräfte', u: '/autismus-und-teacch/', c: 'blog', k: 'teacch methode strukturierung autismus' },
    { t: 'AuDHS – ADHS & Autismus zusammen', s: 'Wenn beides zusammenkommt', u: '/wenn-adhs-und-autismus-zusammenkommen/', c: 'blog', k: 'adhs autismus audhs komorbidität doppeldiagnose' },
    { t: 'Inklusion in der Kita', s: 'Vielfalt gestalten & leben', u: '/inklusion-in-der-kita/', c: 'blog', k: 'inklusion behinderung teilhabe diversität förderung integration' },
    { t: 'Selbstfürsorge für ErzieherInnen', s: 'Burnout vorbeugen', u: '/selbstfuersorge-fuer-erzieherinnen/', c: 'blog', k: 'burnout stress erschöpfung fürsorge wohlbefinden erholung' },
    { t: 'Selbstständigkeit im Kita-Alltag', s: 'Warum du loslassen musst', u: '/selbstständigkeit-im-kita-alltag-fördern/', c: 'blog', k: 'selbstständigkeit eigenständigkeit autonomie förderung kinder' },
    { t: 'Doktorspiele & Sexualentwicklung', s: 'Sexualentwicklung 0–6 Jahren begleiten', u: '/doktorspiele-sexualentwicklung-in-der-kita/', c: 'blog', k: 'sexualentwicklung doktorspiele körper kinder prävention' },
    { t: 'Übergänge in der Kita', s: 'Eingewöhnung und Übergangsgestaltung', u: '/übergänge-in-der-kita/', c: 'blog', k: 'übergang transition eingewöhnung schule wechsel' },
    { t: 'Vorschule leicht gemacht', s: 'Wochenplan für die Kita', u: '/vorschule-leicht-gemacht/', c: 'blog', k: 'vorschule schulvorbereitung wochenplan planung' },
    { t: 'Vorschulkonzept für die Kita', s: 'Ein starkes Konzept entwickeln', u: '/vorschulkonzept-für-die-kita/', c: 'blog', k: 'vorschulkonzept konzept entwickeln schulvorbereitung' },
    { t: 'Waldpädagogik in der Kita', s: 'Natur als Lernraum', u: '/waldpädagogik-in-der-kita/', c: 'blog', k: 'waldpädagogik natur draußen wald naturkindergarten outdoor' },
    { t: 'Welche Fortbildung passt zu mir?', s: 'Entscheidungshilfe', u: '/welche-fortbildung/', c: 'blog', k: 'beratung auswahl fortbildung wahl empfehlung' },
    // ── Alle Fortbildungen ──
    { t: 'Alle Fortbildungen', s: 'Übersicht unserer Kurse', u: '/fortbildungen/', c: 'fortbildung', k: 'kurs seminar weiterbildung zertifikat übersicht' },
    // ── 3-Monats-Fortbildungen ──
    { t: 'Leitung der Vorschule', s: '3-Monats-Fortbildung', u: '/fortbildungen/leitung-vorschule/', c: 'fortbildung', k: 'vorschule leitung 3 monate zertifikat schulkind' },
    { t: 'Stressbewältigungscoach', s: '3-Monats-Fortbildung', u: '/fortbildungen/stressbewaetigungscoach/', c: 'fortbildung', k: 'stress coach burnout belastung entspannung 3 monate' },
    { t: 'FachberaterIn für Inklusion', s: '3-Monats-Fortbildung', u: '/fortbildungen/fachberaterin-inklusion/', c: 'fortbildung', k: 'inklusion fachberatung behinderung integration 3 monate' },
    { t: 'Marte Meo PraktikerIn', s: '3-Monats-Fortbildung', u: '/fortbildungen/marte-meo-praktikerin/', c: 'fortbildung', k: 'marte meo video beratung interaktion entwicklung 3 monate' },
    { t: 'Digitale Medien Beauftragte in der Kita', s: '3-Monats-Fortbildung', u: '/fortbildungen/digitale-medien-beauftragte-kita/', c: 'fortbildung', k: 'digital medien tablet ipad technologie 3 monate' },
    { t: 'Kinderyoga Kursleitung', s: '3-Monats-Fortbildung', u: '/fortbildungen/kinderyoga-kursleitung/', c: 'fortbildung', k: 'yoga kinder bewegung entspannung achtsamkeit 3 monate kursleitung' },
    { t: 'Kita-ExpertIn für Verhaltensauffälligkeiten', s: '3-Monats-Fortbildung', u: '/fortbildungen/kita-expertin-verhaltensauffaelligkeiten/', c: 'fortbildung', k: 'verhalten auffälligkeit experte expertise adhs autismus 3 monate' },
    { t: 'Teamcoach in der Kita', s: '3-Monats-Fortbildung', u: '/fortbildungen/teamcoach-kita/', c: 'fortbildung', k: 'team coaching führung leitung kommunikation 3 monate' },
    { t: 'Kita KoordinatorIn für Kinderschutz', s: '3-Monats-Fortbildung', u: '/fortbildungen/kinderschutz-koordinatorin-kita/', c: 'fortbildung', k: 'kinderschutz schutz gewalt missbrauch koordination 3 monate' },
    { t: 'Kita-ExpertIn für ADHS & Autismus', s: '3-Monats-Fortbildung', u: '/fortbildungen/kita-expertin-adhs-autismus/', c: 'fortbildung', k: 'adhs autismus experte expertise fachkraft 3 monate' },
    // ── Tagesfortbildungen ──
    { t: 'Stressbewältigung im Kita-Alltag', s: 'Tagesfortbildung', u: '/fortbildungen/tagesfortbildungen/stressbewaltigung-kita-alltag/', c: 'fortbildung', k: 'stress alltag bewältigung entspannung tagesfortbildung' },
    { t: 'Vorschulkonzept entwickeln und gestalten', s: 'Tagesfortbildung', u: '/fortbildungen/tagesfortbildungen/vorschulkonzept-gestalten/', c: 'fortbildung', k: 'vorschule konzept entwickeln gestalten tagesfortbildung' },
    { t: 'Autismus im Kita-Alltag', s: 'Tagesfortbildung', u: '/fortbildungen/tagesfortbildungen/autismus-kita-alltag/', c: 'fortbildung', k: 'autismus alltag fachkraft tagesfortbildung' },
    { t: 'Musik, Tanz und Bewegung mit „Bodo"', s: 'Tagesfortbildung', u: '/fortbildungen/tagesfortbildungen/musik-tanz-bodo/', c: 'fortbildung', k: 'musik tanz bewegung bodo rhythmus singen tagesfortbildung' },
    { t: 'Forschen und Entdecken mit „Fred"', s: 'Tagesfortbildung', u: '/fortbildungen/tagesfortbildungen/forschen-entdecken-fred/', c: 'fortbildung', k: 'forschen entdecken naturwissenschaft experiment fred tagesfortbildung' },
    { t: 'ADHS in der Kita – Struktur & Flexibilität', s: 'Tagesfortbildung', u: '/fortbildungen/tagesfortbildungen/adhs-kita/', c: 'fortbildung', k: 'adhs struktur flexibilität alltag tagesfortbildung' },
    { t: 'Kita Teams leiten und stärken', s: 'Tagesfortbildung', u: '/fortbildungen/tagesfortbildungen/teams-leiten-staerken/', c: 'fortbildung', k: 'team leiten stärken führung leitung tagesfortbildung' },
    { t: 'Meine Führungsrolle als Kita-Leitung', s: 'Tagesfortbildung', u: '/fortbildungen/tagesfortbildungen/fuehrungsrolle-kita-leitung/', c: 'fortbildung', k: 'führung leitung rolle management tagesfortbildung' },
    { t: 'Umgang mit Personalmangel', s: 'Tagesfortbildung', u: '/fortbildungen/tagesfortbildungen/umgang-mit-personalmangel/', c: 'fortbildung', k: 'personalmangel fachkräftemangel personal alltag tagesfortbildung' },
    { t: 'Kinderyoga für deine Kita', s: 'Tagesfortbildung', u: '/fortbildungen/tagesfortbildungen/kinderyoga-kita/', c: 'fortbildung', k: 'yoga kinder bewegung entspannung achtsamkeit tagesfortbildung' },
    { t: 'Sprache erforschen mit „Wuppi"', s: 'Tagesfortbildung', u: '/fortbildungen/tagesfortbildungen/sprache-wuppi/', c: 'fortbildung', k: 'sprache sprachförderung wuppi tagesfortbildung' },
    { t: 'Elterngespräche führen', s: 'Tagesfortbildung', u: '/fortbildungen/tagesfortbildungen/elterngespraeche-fuehren/', c: 'fortbildung', k: 'eltern gespräch kommunikation konflikt tagesfortbildung' },
    { t: 'Sexualentwicklung 0–6 Jahre', s: 'Tagesfortbildung', u: '/fortbildungen/tagesfortbildungen/sexualentwicklung-0-6-jahre/', c: 'fortbildung', k: 'sexualentwicklung doktorspiele körper schutz tagesfortbildung' },
    { t: 'Gewaltfreie Kommunikation', s: 'Tagesfortbildung', u: '/fortbildungen/tagesfortbildungen/gewaltfreie-kommunikation/', c: 'fortbildung', k: 'gfk kommunikation gewaltfrei empathie konflikt tagesfortbildung' },
    { t: 'Schule in Sicht', s: 'Tagesfortbildung', u: '/fortbildungen/tagesfortbildungen/schule-in-sicht/', c: 'fortbildung', k: 'schule übergang schulkind vorschule tagesfortbildung' },
    { t: 'Kinderyoga Praxisübungen', s: 'Tagesfortbildung', u: '/fortbildungen/tagesfortbildungen/kinderyoga-praxisuebungen/', c: 'fortbildung', k: 'yoga praxis übung kinder bewegung tagesfortbildung' },
    { t: 'Kinderschutz in der Kita', s: 'Tagesfortbildung', u: '/fortbildungen/tagesfortbildungen/kinderschutz-kita/', c: 'fortbildung', k: 'kinderschutz schutz gewalt missbrauch prävention tagesfortbildung' },
    { t: 'Digitale Kita mit Kitaversum', s: 'Tagesfortbildung', u: '/fortbildungen/tagesfortbildungen/digitale-kita-kitaversum/', c: 'fortbildung', k: 'digital kita kitaversum software app tagesfortbildung' },
    { t: 'Zahlen und Mengen spielerisch vermitteln mit „Baldur"', s: 'Tagesfortbildung', u: '/fortbildungen/tagesfortbildungen/zahlen-mengen-baldur/', c: 'fortbildung', k: 'mathematik zahlen mengen formen muster baldur zahlendrache frühförderung vorschule tagesfortbildung' },
    { t: 'Teamfortbildungen für Kita-Teams', s: 'Inhouse-Seminare', u: '/fortbildungen/teamfortbildungen/', c: 'fortbildung', k: 'team inhouse teamfortbildung seminar einrichtung' },
    // ── Blogartikel ──
    { t: 'Blog', s: 'Alle Artikel', u: '/blog-1/', c: 'blog', k: 'artikel lesen tipps wissen blog' },
    { t: 'Sommerprojekte für die Kita', s: 'Ideen für den Sommer', u: '/sommerprojekte-für-die-kita/', c: 'blog', k: 'sommer projekte ideen aktivitäten draußen' },
    { t: 'Halloween in der Kita', s: 'Basteln und Gemeinschaft', u: '/halloween-in-der-kita/', c: 'blog', k: 'halloween herbst basteln kostüm feiern' },
    { t: 'Weihnachten in der Kita', s: 'Advent stressfrei gestalten', u: '/weihnachten-in-der-kita/', c: 'blog', k: 'weihnachten advent basteln feiern winter' },
    { t: 'Kinderyoga im Sommer', s: 'Ideen für heiße Kita-Tage', u: '/kinderyoga-im-sommer/', c: 'blog', k: 'yoga sommer hitze bewegung entspannung kinder' },
    { t: 'Kinderyoga: Atemübungen für Kinder', s: 'Praxisübungen', u: '/kinderyoga-atmung/', c: 'blog', k: 'yoga atmung atemübungen entspannung kinder' },
    { t: 'Diese Art von Führung macht deine Kita kaputt', s: 'Führungsfehler erkennen', u: '/diese-art-von-führung-macht-deine-kita-kaputt/', c: 'blog', k: 'führung fehler leitung management burnout' },
    { t: 'Haltung statt Hamsterrad', s: 'Stress im Kita-Alltag meistern', u: '/haltung-statt-hamsterrad-wie-du-stress-im-kita-alltag-meisterst/', c: 'blog', k: 'stress haltung hamsterrad alltag burnout entspannung' },
    { t: 'Kita-Software-Vergleich 2026', s: 'Welche Lösung passt?', u: '/kita-software-vergleich-2026/', c: 'blog', k: 'software app digital kita verwaltung vergleich' },
    { t: 'Digitale Kita mit Kitaversum', s: 'Erfahrungsbericht', u: '/digitale-kita-mit-kitaversum/', c: 'blog', k: 'kitaversum digital software kita app' },
    { t: 'Selbstfürsorge & Burnout vorbeugen', s: 'Schlüssel zur Vorbeugung', u: '/2024/08/21/selbstfürsorge-für-erzieherinnen-der-schlüssel-zur-vorbeugung-von-burnout-in-der-kita/', c: 'blog', k: 'selbstfürsorge burnout stress erschöpfung erzieherin' },
    { t: 'Gewaltfreie Kommunikation in der Kita', s: 'GFK einfach erklärt', u: '/2025/06/09/gewaltfreie-kommunikation-in-der-kita/', c: 'blog', k: 'gfk kommunikation gewaltfrei empathie konflikt' },
    { t: '10 Vorschulideen für die Kita', s: 'Ideen und Aktivitäten', u: '/2021/11/04/10-vorschulideen-für-die-kita/', c: 'blog', k: 'vorschule ideen aktivitäten schulvorbereitung kinder' },
    { t: 'Ideen für Projekte im Kindergarten', s: 'Projektarbeit in der Kita', u: '/2024/05/03/ideen-für-projekte-im-kindergarten/', c: 'blog', k: 'projekte kindergarten ideen thema gestaltung' },
    { t: 'Experiment: Der magische Pfeffertrick', s: 'Für Vorschulkinder', u: '/2025/04/28/spannendes-experiment-für-vorschulkinder-der-magische-pfeffertrick/', c: 'blog', k: 'experiment vorschule pfeffer trick naturwissenschaft kinder' },
    { t: 'Kinderyoga im Frühling', s: 'Bewegung, Achtsamkeit & Entspannung', u: '/2025/02/17/kinderyoga-im-frühling-bewegung-achtsamkeit-und-entspannung-in-der-kita/', c: 'blog', k: 'yoga frühling bewegung achtsamkeit entspannung kinder' },
    { t: 'Herausforderung Elterngespräch', s: 'Ruhig, klar und wertschätzend bleiben', u: '/2025/07/28/herausforderung-elterngespräch-so-bleibst-du-ruhig-klar-und-wertschätzend-auch-wenn-s-brenzlig-wird/', c: 'blog', k: 'eltern gespräch kommunikation konflikt schwierig' },
    { t: 'Teamarbeit und Kommunikation stärken', s: 'Ressourcen im Kita-Alltag', u: '/2025/01/13/ressourcen-stärken-teamarbeit-und-kommunikation-im-kita-alltag/', c: 'blog', k: 'team kommunikation ressourcen zusammenarbeit alltag' },
    // ── Infoseiten ──
    { t: 'Über uns', s: 'Das Team der EDULEO Akademie', u: '/ueber-uns/', c: 'info', k: 'team über uns gründerin leitung portrait' },
    { t: 'DozentInnen', s: 'Referentinnen und Referenten', u: '/dozentinnen/', c: 'info', k: 'dozentin dozent referent lehrer trainer' },
    { t: 'Bring a Friend', s: 'Empfehlen und sparen', u: '/bring-a-friend/', c: 'info', k: 'freund empfehlen rabatt bringen angebot' },
    { t: 'Anmeldebedingungen', s: 'Informationen zur Anmeldung', u: '/anmeldebedingungen.html', c: 'info', k: 'anmeldung bedingungen buchen zahlung' },
    { t: 'AGB', s: 'Allgemeine Geschäftsbedingungen', u: '/agb.html', c: 'info', k: 'agb geschäftsbedingungen vertrag regelungen' },
    { t: 'Datenschutz', s: 'Datenschutzerklärung', u: '/datenschutz.html', c: 'info', k: 'datenschutz daten privat gdpr dsgvo' },
    { t: 'Impressum', s: 'Rechtliche Angaben', u: '/impressum.html', c: 'info', k: 'impressum kontakt adresse rechtlich' },
    { t: 'Widerruf', s: 'Widerrufsbelehrung', u: '/widerruf.html', c: 'info', k: 'widerruf rücktritt stornierung kündigung' },
  ];

  var LUPE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path stroke-linecap="round" d="m21 21-4.35-4.35"/></svg>';

  function norm(s) {
    return (s || '').toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9\s]/g, ' ');
  }

  function search(q) {
    if (!q || q.trim().length < 2) return [];
    var terms = norm(q).trim().split(/\s+/).filter(Boolean);
    var out = [];
    IDX.forEach(function (p) {
      var tn = norm(p.t), sn = norm(p.s), kn = norm(p.k);
      var score = 0;
      var match = terms.every(function (term) {
        if (tn.includes(term)) { score += 10; return true; }
        if (sn.includes(term)) { score += 5;  return true; }
        if (kn.includes(term)) { score += 2;  return true; }
        return false;
      });
      if (match) out.push({ p: p, s: score });
    });
    var catOrder = { fortbildung: 0, blog: 1, info: 2 };
    out.sort(function (a, b) {
      var co = (catOrder[a.p.c] || 1) - (catOrder[b.p.c] || 1);
      return co !== 0 ? co : b.s - a.s;
    });
    return out.slice(0, 8).map(function (r) { return r.p; });
  }

  function badge(c) {
    var m = { fortbildung: ['badge-fortbildung', 'Fortbildung'], blog: ['badge-blog', 'Blog'], info: ['badge-info', 'Info'] };
    var d = m[c] || ['badge-info', c];
    return '<span class="search-result-badge ' + d[0] + '">' + d[1] + '</span>';
  }

  // ── Elemente injizieren ──
  var navCta = document.querySelector('.nav-cta');
  if (!navCta) return;

  var btn = document.createElement('button');
  btn.className = 'search-btn';
  btn.setAttribute('aria-label', 'Suche');
  btn.innerHTML = LUPE_SVG;
  navCta.insertBefore(btn, navCta.firstChild);

  var overlay = document.createElement('div');
  overlay.className = 'search-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Suche');
  overlay.innerHTML =
    '<div class="search-modal">' +
      '<div class="search-input-wrap">' +
        LUPE_SVG +
        '<input class="search-input" type="text" placeholder="Was suchst du? z. B. Autismus, Yoga, Stress …" autocomplete="off" spellcheck="false">' +
        '<button class="search-close" aria-label="Suche schließen">✕</button>' +
      '</div>' +
      '<div class="search-results"></div>' +
    '</div>';
  document.body.appendChild(overlay);

  var input     = overlay.querySelector('.search-input');
  var resultsEl = overlay.querySelector('.search-results');
  var closeBtn  = overlay.querySelector('.search-close');
  var focused   = -1;

  function render(results) {
    focused = -1;
    if (!input.value.trim()) {
      resultsEl.innerHTML = '<p class="search-hint">Tippe einen Begriff ein – z. B. <em>Autismus</em>, <em>Yoga</em> oder <em>Elterngespräch</em>.</p>';
      return;
    }
    if (!results.length) {
      resultsEl.innerHTML = '<p class="search-empty">Keine Treffer für „' + input.value + '“.<br>Versuch es mit einem anderen Stichwort.</p>';
      return;
    }
    resultsEl.innerHTML = results.map(function (p, i) {
      return '<a class="search-result-item" href="' + p.u + '" data-i="' + i + '">' +
        badge(p.c) +
        '<div><div class="search-result-title">' + p.t + '</div>' +
        (p.s ? '<div class="search-result-subtitle">' + p.s + '</div>' : '') +
        '</div></a>';
    }).join('');
  }

  function open() {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    render([]);
    setTimeout(function () { input.focus(); }, 40);
  }

  function close() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    input.value = '';
  }

  btn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

  input.addEventListener('input', function () { render(search(input.value)); });

  document.addEventListener('keydown', function (e) {
    if (!overlay.classList.contains('open')) return;
    if (e.key === 'Escape') { close(); return; }
    var items = resultsEl.querySelectorAll('.search-result-item');
    if (!items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); focused = Math.min(focused + 1, items.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focused = Math.max(focused - 1, -1); }
    else if (e.key === 'Enter') {
      var target = focused >= 0 ? items[focused] : items[0];
      if (target) { target.click(); return; }
    }
    items.forEach(function (el, i) { el.classList.toggle('focused', i === focused); });
    if (focused >= 0 && items[focused]) items[focused].scrollIntoView({ block: 'nearest' });
  });

  // ── Mobilmenü: Suche-Eintrag ──
  var mobileMenu = document.querySelector('.mobile-menu');
  if (mobileMenu) {
    var mobileBtn = document.createElement('button');
    mobileBtn.className = 'mobile-search-btn';
    mobileBtn.innerHTML = LUPE_SVG + '<span>Suche</span>';
    mobileBtn.addEventListener('click', function () {
      var hamburger = document.querySelector('.hamburger');
      if (hamburger && hamburger.classList.contains('active')) hamburger.click();
      open();
    });
    mobileMenu.insertBefore(mobileBtn, mobileMenu.firstChild);
  }
})();
