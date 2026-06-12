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

  const eventId = url.searchParams.get('event_id');
  const qualId  = url.searchParams.get('qualification_id');
  if (!eventId && !qualId) {
    return new Response(JSON.stringify({ dates: [] }), { headers });
  }

  const simplyUrl = eventId
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

    // Daten extrahieren (DD.MM.YY, nicht als Teil einer längeren Zahl)
    const dateRe = /(\d{2})\.(\d{2})\.(\d{2})(?!\d)/g;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dates = [];
    const seen = new Set();
    let dm, ti = 0;
    while ((dm = dateRe.exec(html)) !== null) {
      const [, d, mo, y] = dm;
      const iso = `20${y}-${mo}-${d}`;
      if (seen.has(iso)) continue;
      const dt = new Date(+`20${y}`, +mo - 1, +d);
      if (dt >= today) {
        seen.add(iso);
        dates.push({ date: `${d}.${mo}.${y}`, dateISO: iso, time: times[ti] || '', url: simplyUrl });
        ti++;
      }
    }

    return new Response(JSON.stringify({ dates, source: simplyUrl }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ dates: [], error: String(e) }), { headers });
  }
}
