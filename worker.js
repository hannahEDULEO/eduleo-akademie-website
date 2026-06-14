export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;

    // API: Termine von SimplyOrg
    if (path === '/api/termine') {
      return handleTermine(url);
    }

    // Statische Assets
    let response = await env.ASSETS.fetch(request);
    if (response.status === 404) {
      if (!path.endsWith('/')) path += '/';
      const indexUrl = new URL(request.url);
      indexUrl.pathname = path + 'index.html';
      response = await env.ASSETS.fetch(new Request(indexUrl.toString(), request));
    }
    return response;
  }
};

async function handleTermine(url) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=3600'
  };

  const eventId  = url.searchParams.get('event_id');
  const qualId   = url.searchParams.get('qualification_id');
  const catId    = url.searchParams.get('category_id');
  if (!eventId && !qualId && !catId) {
    return new Response(JSON.stringify({ dates: [] }), { headers });
  }

  const simplyUrl = catId
    ? `https://eduleo-akademie.simplyorg-seminare.de/event-list?page=1&categoryId=${catId}`
    : eventId
      ? `https://eduleo-akademie.simplyorg-seminare.de/event-details?event_id=${eventId}`
      : `https://eduleo-akademie.simplyorg-seminare.de/qualification-details?qualification_id=${qualId}`;

  try {
    const resp = await fetch(simplyUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EDULEO/1.0)' }
    });
    const html = await resp.text();

    // Uhrzeiten extrahieren
    const timeRe = /(\d{1,2}:\d{2})\s*Uhr\s*[–\-]\s*(\d{1,2}:\d{2})\s*Uhr/g;
    const times = [];
    let tm;
    while ((tm = timeRe.exec(html)) !== null) times.push(`${tm[1]}–${tm[2]} Uhr`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dates = [];
    const seen = new Set();

    if (catId) {
      // Kategorie-Seiten (3-Monats): nur Kursstart (erstes Datum jeder Range) anzeigen
      const eventIdLinks = [];
      const linkRe = /event-details\?event_id=(\d+)/g;
      const seen2 = new Set();
      let lm;
      while ((lm = linkRe.exec(html)) !== null) {
        if (!seen2.has(lm[1])) { seen2.add(lm[1]); eventIdLinks.push(lm[1]); }
      }

      // Nur Startdaten aus "DD.MM.YY – DD.MM.YY"-Ranges extrahieren
      const rangeRe = /(\d{2})\.(\d{2})\.(\d{2})\s*[–\-]\s*\d{2}\.\d{2}\.\d{2}/g;
      let rm, ti = 0;
      while ((rm = rangeRe.exec(html)) !== null) {
        const [, d, mo, y] = rm;
        const moNum = +mo, dNum = +d;
        if (moNum < 1 || moNum > 12 || dNum < 1 || dNum > 31) continue;
        const iso = `20${y}-${mo}-${d}`;
        if (seen.has(iso)) continue;
        const dt = new Date(+`20${y}`, moNum - 1, dNum);
        if (dt.getMonth() !== moNum - 1) continue;
        if (dt >= today) {
          seen.add(iso);
          const eventUrl = eventIdLinks[ti]
            ? `https://eduleo-akademie.simplyorg-seminare.de/event-details?event_id=${eventIdLinks[ti]}`
            : simplyUrl;
          dates.push({ date: `${d}.${mo}.${y}`, dateISO: iso, time: times[ti] || '', url: eventUrl });
          ti++;
        }
      }
    } else {
      // Event- und Qualifikations-Seiten (Tagesfortbildungen): Einzeltermine anzeigen
      const endDates = new Set();
      const endRe = /\d{2}\.\d{2}\.\d{2}\s*[–\-]\s*(\d{2})\.(\d{2})\.(\d{2})(?!\d)/g;
      let er;
      while ((er = endRe.exec(html)) !== null) endDates.add(`${er[1]}.${er[2]}.${er[3]}`);

      const dateRe = /(\d{2})\.(\d{2})\.(\d{2})(?!\d)/g;
      let dm, ti = 0;
      while ((dm = dateRe.exec(html)) !== null) {
        const [, d, mo, y] = dm;
        const moNum = +mo, dNum = +d;
        if (moNum < 1 || moNum > 12 || dNum < 1 || dNum > 31) continue;
        if (endDates.has(`${d}.${mo}.${y}`)) continue;
        const iso = `20${y}-${mo}-${d}`;
        if (seen.has(iso)) continue;
        const dt = new Date(+`20${y}`, moNum - 1, dNum);
        if (dt.getMonth() !== moNum - 1) continue;
        if (dt >= today) {
          seen.add(iso);
          dates.push({ date: `${d}.${mo}.${y}`, dateISO: iso, time: times[ti] || '', url: simplyUrl });
          ti++;
        }
      }
    }

    return new Response(JSON.stringify({ dates, source: simplyUrl }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ dates: [], error: String(e) }), { headers });
  }
}
