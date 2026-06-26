export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;

    // API: Chatbot
    if (path === '/api/chat') {
      return handleChat(request, env);
    }

    // API: Termine von SimplyOrg
    if (path === '/api/termine') {
      return handleTermine(url);
    }

    // Redirects für alte QR-Code-URLs (Broschüre & Postkarte)
    const decodedPath = decodeURIComponent(path).replace(/\/?$/, '/');
    if (decodedPath === '/3-monats-fortbildungen/' || decodedPath === '/überblick-fortbildungen/') {
      return Response.redirect(new URL('/fortbildungen/', url).toString(), 301);
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

async function handleChat(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { message, history = [] } = await request.json();

    const systemPrompt = `Du bist der freundliche Chatbot der EDULEO Akademie. Du hilfst pädagogischen Fachkräften, die passende Fortbildung zu finden, und beantwortest Fragen zu unseren Angeboten. Antworte immer auf Deutsch, kurz und herzlich (maximal 3-4 Sätze). Duze die Person.

ÜBER DIE EDULEO AKADEMIE:
Die EDULEO Akademie bietet praxisnahe Online-Fortbildungen für ErzieherInnen, pädagogische Fachkräfte und Kita-Leitungen. Alle Fortbildungen sind 100% online & live, zertifiziert und sofort im Kita-Alltag umsetzbar.
Kontakt: kontakt@eduleo-akademie.de | Tel: +49 160 50590620
Website: www.eduleo-akademie.de

3-MONATS-FORTBILDUNGEN (intensive Expertenprogramme):
1. Kita-ExpertIn für ADHS & Autismus – Strategien für Verhalten im Alltag → /fortbildungen/kita-expertin-adhs-autismus/
2. Kita-ExpertIn für Verhaltensauffälligkeiten → /fortbildungen/kita-expertin-verhaltensauffaelligkeiten/
3. Digitale Medien Beauftragte/r in der Kita → /fortbildungen/digitale-medien-beauftragte-kita/
4. Leitung der Vorschule → /fortbildungen/leitung-vorschule/
5. Teamcoach in der Kita → /fortbildungen/teamcoach-kita/
6. Kita KoordinatorIn für Kinderschutz → /fortbildungen/kinderschutz-koordinatorin-kita/
7. Kinderyoga Kursleitung → /fortbildungen/kinderyoga-kursleitung/
8. Stressbewältigungscoach → /fortbildungen/stressbewaetigungscoach/
9. Marte Meo PraktikerIn → /fortbildungen/marte-meo-praktikerin/
10. FachberaterIn für Inklusion → /fortbildungen/fachberaterin-inklusion/

TAGESFORTBILDUNGEN (ab 150€, 1 Tag):
- Stressbewältigung im Kita-Alltag
- Sexualentwicklung 0–6 Jahre
- Umgang mit Personalmangel
- Autismus im Kita-Alltag
- Elterngespräche führen
- und weitere → /fortbildungen/

TEAMFORTBILDUNGEN: Maßgeschneidert für das gesamte Kita-Team → /fortbildungen/teamfortbildungen/
BRING A FRIEND: Gemeinsam anmelden mit Rabatt → /bring-a-friend/
PREISE: Tagesfortbildungen ab 150€, 3-Monats-Fortbildungen: Preise auf den jeweiligen Kursseiten.

Wenn du Preise oder Termine nicht kennst, verweise auf kontakt@eduleo-akademie.de oder die Kursseite. Empfehle bei Interesse immer einen passenden Kurs.`;

    const messages = [
      ...history.slice(-6),
      { role: 'user', content: message }
    ];

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: systemPrompt,
        messages,
      }),
    });

    const data = await resp.json();
    const reply = data.content?.[0]?.text ?? 'Entschuldigung, ich konnte deine Anfrage nicht verarbeiten. Schreib uns gerne an kontakt@eduleo-akademie.de!';

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ reply: 'Entschuldigung, da ist etwas schiefgelaufen. Schreib uns gerne an kontakt@eduleo-akademie.de!' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function handleTermine(url) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=3600'
  };

  const eventId  = url.searchParams.get('event_id');
  const qualId   = url.searchParams.get('qualification_id');
  const catId    = url.searchParams.get('category_id');
  const catType  = url.searchParams.get('category_type');
  if (!eventId && !qualId && !catId) {
    return new Response(JSON.stringify({ dates: [] }), { headers });
  }

  const typeParam = catType ? `type=${catType}&` : '';
  const simplyUrl = catId
    ? `https://eduleo-akademie.simplyorg-seminare.de/event-list?${typeParam}categoryId=${catId}&page=1`
    : eventId
      ? `https://eduleo-akademie.simplyorg-seminare.de/event-details?event_id=${eventId}`
      : `https://eduleo-akademie.simplyorg-seminare.de/event-list?page=1&qualificationId=${qualId}`;

  try {
    const resp = await fetch(simplyUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EDULEO/1.0)' }
    });
    const html = await resp.text();

    // Uhrzeiten extrahieren (mit oder ohne "Uhr")
    const timeRe = /(\d{1,2}:\d{2})(?:\s*Uhr)?\s*[-–]\s*(\d{1,2}:\d{2})(?:\s*Uhr)?/g;
    const times = [];
    let tm;
    while ((tm = timeRe.exec(html)) !== null) times.push(`${tm[1]}–${tm[2]} Uhr`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dates = [];
    const seen = new Set();

    if (catId) {
      // Kategorie-Seiten: event-Links sammeln
      const eventIdLinks = [];
      const linkRe = /event-details\?event_id=(\d+)/g;
      const seen2 = new Set();
      let lm;
      while ((lm = linkRe.exec(html)) !== null) {
        if (!seen2.has(lm[1])) { seen2.add(lm[1]); eventIdLinks.push(lm[1]); }
      }

      // Startdaten aus "DD.MM.YY – DD.MM.YY"-Ranges (3-Monats-Kurse)
      const rangeRe = /(\d{2})\.(\d{2})\.(\d{2})\s*[–\-]\s*\d{2}\.\d{2}\.\d{2}/g;
      let rm, ti = 0;
      while ((rm = rangeRe.exec(html)) !== null) {
        const [, d, mo, y] = rm;
        const moNum = +mo, dNum = +d;
        if (moNum < 1 || moNum > 12 || dNum < 1 || dNum > 31) continue;
        const iso = `20${y}-${mo}-${d}`;
        const timeVal = times[ti] || '';
        const eventId = eventIdLinks[ti] || '';
        const seenKey = eventId ? `ev_${eventId}` : `${iso}|${timeVal}`;
        if (seen.has(seenKey)) continue;
        const dt = new Date(+`20${y}`, moNum - 1, dNum);
        if (dt.getMonth() !== moNum - 1) continue;
        if (dt >= today) {
          seen.add(seenKey);
          const eventUrl = eventId
            ? `https://eduleo-akademie.simplyorg-seminare.de/event-details?event_id=${eventId}`
            : simplyUrl;
          const hour = timeVal ? parseInt(timeVal.split(':')[0]) : -1;
          const label = hour >= 0 ? (hour < 12 ? ' (Vormittagstermine)' : ' (Abendtermine)') : '';
          dates.push({ date: `${d}.${mo}.${y}`, dateISO: iso, time: timeVal, label, url: eventUrl });
          ti++;
        }
      }

      // Fallback: Einzeldaten (Tagesfortbildungen ohne Range)
      if (dates.length === 0) {
        const endDates = new Set();
        const endRe = /\d{2}\.\d{2}\.\d{2}\s*[–\-]\s*(\d{2})\.(\d{2})\.(\d{2})(?!\d)/g;
        let er;
        while ((er = endRe.exec(html)) !== null) endDates.add(`${er[1]}.${er[2]}.${er[3]}`);
        const singleRe = /(\d{2})\.(\d{2})\.(\d{2})(?!\d)/g;
        let sm, si = 0;
        while ((sm = singleRe.exec(html)) !== null) {
          const [, d, mo, y] = sm;
          const moNum = +mo, dNum = +d;
          if (moNum < 1 || moNum > 12 || dNum < 1 || dNum > 31) continue;
          if (endDates.has(`${d}.${mo}.${y}`)) continue;
          const iso = `20${y}-${mo}-${d}`;
          if (seen.has(iso)) continue;
          const dt = new Date(+`20${y}`, moNum - 1, dNum);
          if (dt.getMonth() !== moNum - 1) continue;
          if (dt >= today) {
            seen.add(iso);
            const eventUrl = eventIdLinks[si]
              ? `https://eduleo-akademie.simplyorg-seminare.de/event-details?event_id=${eventIdLinks[si]}`
              : simplyUrl;
            dates.push({ date: `${d}.${mo}.${y}`, dateISO: iso, time: times[si] || '', url: eventUrl });
            si++;
          }
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
