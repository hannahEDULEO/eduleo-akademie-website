/* EDULEO Akademie – main.js */

/* ── Hero Video Fade-in ─────────────────────── */
(function () {
  var v = document.querySelector('.hero-video');
  if (!v) return;
  if (v.readyState >= 3) { v.classList.add('loaded'); return; }
  v.addEventListener('canplaythrough', function () { v.classList.add('loaded'); }, { once: true });
  v.addEventListener('loadeddata', function () { v.classList.add('loaded'); }, { once: true });
})();

/* ── SimplyOrg Termin-Widget ─────────────── */
(async function () {
  var widget = document.getElementById('termine-widget');
  if (!widget) return;
  var eventId = widget.dataset.eventId;
  var qualId  = widget.dataset.qualificationId;
  var catId   = widget.dataset.categoryId;
  if (!eventId && !qualId && !catId) return;

  var param = catId    ? 'category_id=' + catId
            : eventId  ? 'event_id=' + eventId
            :            'qualification_id=' + qualId;
  var portalUrl = catId
    ? 'https://eduleo-akademie.simplyorg-seminare.de/event-list?page=1&categoryId=' + catId
    : eventId
      ? 'https://eduleo-akademie.simplyorg-seminare.de/event-details?event_id=' + eventId
      : 'https://eduleo-akademie.simplyorg-seminare.de/qualification-details?qualification_id=' + qualId;

  var MONATE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  function fmtDate(d) {
    var p = d.split('.');
    return parseInt(p[0]) + '. ' + MONATE[parseInt(p[1]) - 1] + ' 20' + p[2];
  }

  try {
    var resp = await fetch('/api/termine?' + param);
    var data = await resp.json();
    var select = document.getElementById('tf-termin') || document.getElementById('m3-termin');

    if (data.dates && data.dates.length > 0) {
      widget.innerHTML = data.dates.map(function (d) {
        return '<a class="termin-card" href="' + (d.url || portalUrl) + '" target="_blank" rel="noopener">'
          + '<div class="termin-card-info">'
          + '<span class="termin-datum">' + fmtDate(d.date) + '</span>'
          + (d.time ? '<span class="termin-zeit">' + d.time + '</span>' : '')
          + '</div><span class="termin-arrow">→</span></a>';
      }).join('');

      if (select && select.tagName === 'SELECT') {
        data.dates.forEach(function (d) {
          var opt = document.createElement('option');
          opt.value = d.date;
          opt.textContent = fmtDate(d.date) + (d.time ? ' · ' + d.time : '');
          select.appendChild(opt);
        });
      }
    } else {
      widget.innerHTML = '<p class="termin-empty">Aktuell keine Termine geplant.<br>Schreib uns – wir setzen dich auf die Warteliste.</p>'
        + '<a href="' + portalUrl + '" target="_blank" rel="noopener" class="btn btn-primary" style="width:100%;margin-top:8px;font-size:0.84rem;">Im Portal ansehen →</a>';
    }
  } catch (e) {
    widget.innerHTML = '<a href="' + portalUrl + '" target="_blank" rel="noopener" class="btn btn-primary" style="width:100%;font-size:0.84rem;">Termine im Portal ansehen →</a>';
  }
})();

/* ── Cookie-Banner ──────────────────────────── */
(function () {
  if (localStorage.getItem('eduleo-cookies-ok')) return;
  var b = document.createElement('div');
  b.id = 'cookie-banner';
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
      counterObserver.unobserve(el);
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
