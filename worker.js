export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;

    // Redirect non-www → www (301)
    if (url.hostname === 'eduleo-akademie.de') {
      const wwwUrl = new URL(request.url);
      wwwUrl.hostname = 'www.eduleo-akademie.de';
      wwwUrl.protocol = 'https:';
      return Response.redirect(wwwUrl.toString(), 301);
    }

    // API: Chatbot
    if (path === '/api/chat') {
      return handleChat(request, env);
    }

    // API: Formular-Proxy (umgeht Firewalls in Behörden-/Schulnetzwerken)
    if (path === '/submit') {
      return handleSubmit(request, env);
    }

    // API: Freebie-Anmeldung (sendet DOI-Bestätigungs-E-Mail)
    if (path === '/freebie-signup') {
      return handleFreebieSignup(request, env);
    }

    // API: Freebie-Bestätigung (DOI-Link aus E-Mail)
    if (path === '/freebie-confirm') {
      return handleFreebieConfirm(request, env);
    }

    // API: Newsletter-Anmeldung (DOI)
    if (path === '/newsletter-signup') {
      return handleNewsletterSignup(request, env);
    }

    // API: Newsletter-Bestätigung (DOI-Link aus E-Mail)
    if (path === '/newsletter-confirm') {
      return handleNewsletterConfirm(request, env);
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

async function handleFreebieSignup(request, env) {
  const json = { 'Content-Type': 'application/json' };

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, msg: 'Method not allowed' }), { status: 405, headers: json });
  }

  try {
    const { email, freebie, consent } = await request.json();

    if (!email || !freebie || !consent) {
      return new Response(JSON.stringify({ ok: false, msg: 'Fehlende Angaben.' }), { status: 400, headers: json });
    }

    // Signierten Bestätigungs-Token generieren
    const timestamp = Date.now();
    const data = `${email}|${freebie}|${timestamp}`;
    const sig = await signHmac(data, env.DOI_HMAC_SECRET);
    const token = encodeURIComponent(btoa(data) + '.' + sig);
    const confirmUrl = `https://www.eduleo-akademie.de/freebie-confirm?t=${token}`;

    // Bestätigungs-E-Mail via Brevo Transaktional-API senden
    const emailResp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: 'EDULEO Akademie', email: 'neuigkeiten@eduleo-akademie.de' },
        to: [{ email }],
        subject: 'Dein kostenloser Download wartet auf dich',
        htmlContent: `<!DOCTYPE html><html lang="de"><body style="margin:0;padding:0;background:#f5f0eb;font-family:sans-serif;"><div style="max-width:560px;margin:40px auto;background:#fff;border-radius:18px;padding:40px 32px;box-shadow:0 2px 12px rgba(38,29,24,0.08);"><p style="margin:0 0 16px;font-size:15px;color:#3d3026;line-height:1.6;">Hallo,</p><p style="margin:0 0 24px;font-size:15px;color:#3d3026;line-height:1.6;">du hast dich für einen kostenlosen Download der EDULEO Akademie angemeldet. Klick auf den Button, um deine E-Mail-Adresse zu bestätigen und deinen Download zu erhalten.</p><a href="${confirmUrl}" clicktracking="off" style="display:inline-block;padding:14px 32px;background:#4a7c3f;color:#fff;text-decoration:none;border-radius:100px;font-weight:700;font-size:15px;">Jetzt bestätigen</a><p style="margin:32px 0 0;font-size:13px;color:rgba(61,48,38,0.45);line-height:1.5;">Der Link ist 48 Stunden gültig. Falls du dich nicht angemeldet hast, kannst du diese E-Mail einfach ignorieren.</p></div></body></html>`,
      }),
    });

    if (!emailResp.ok) {
      const errText = await emailResp.text();
      return new Response(JSON.stringify({ ok: false, msg: errText }), { status: 500, headers: json });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: json });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, msg: String(e) }), { status: 500, headers: json });
  }
}

async function handleFreebieConfirm(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('t');
  const success = 'https://www.eduleo-akademie.de/freebies/bestaetigt/';
  const error   = 'https://www.eduleo-akademie.de/freebies/?fehler=1';

  if (!token) return Response.redirect(success, 302);

  try {
    const dotIdx = token.lastIndexOf('.');
    if (dotIdx === -1) return Response.redirect(error, 302);

    const encoded = token.slice(0, dotIdx);
    const sig     = token.slice(dotIdx + 1);
    const data    = atob(encoded);

    const expectedSig = await signHmac(data, env.DOI_HMAC_SECRET);
    if (sig !== expectedSig) return Response.redirect(error, 302);

    const parts = data.split('|');
    if (parts.length !== 3) return Response.redirect(error, 302);
    const [email, freebie, timestamp] = parts;

    if (Date.now() - Number(timestamp) > 48 * 60 * 60 * 1000) {
      return Response.redirect(error, 302);
    }

    // Kontakt in Brevo-Liste eintragen
    await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
      body: JSON.stringify({
        email,
        listIds: [Number(env.BREVO_FREEBIE_LIST_ID)],
        updateEnabled: true,
      }),
    });

    // Freebie-Download-E-Mail senden
    const freebieNames = {
      'checkliste-schulbereit':      'Checkliste: Ist mein Kind schulbereit?',
      'eingewoehnungs-poster':       'Eingewöhnungs-Poster',
      'pfeffertrick-anleitung':      'Anleitung: Der magische Pfeffertrick',
      'sprachentwicklung-im-blick':  'Sprachentwicklung im Blick',
    };
    const freebiePdfs = {
      'checkliste-schulbereit':      'https://www.eduleo-akademie.de/assets/downloads/checkliste-schulbereit.pdf',
      'eingewoehnungs-poster':       'https://www.eduleo-akademie.de/assets/blog/eingewoehnung/eingewoehnungs-poster.pdf',
      'pfeffertrick-anleitung':      'https://www.eduleo-akademie.de/assets/blog/pfeffertrick/anleitung.pdf',
      'sprachentwicklung-im-blick':  'https://www.eduleo-akademie.de/assets/blog/sprachentwicklung/sprachentwicklung-checkliste.pdf',
    };
    const freebieName = freebieNames[freebie] || 'dein Freebie';
    const pdfUrl = freebiePdfs[freebie];

    if (pdfUrl) {
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
        body: JSON.stringify({
          sender: { name: 'EDULEO Akademie', email: 'neuigkeiten@eduleo-akademie.de' },
          to: [{ email }],
          subject: `Dein Download: ${freebieName}`,
          htmlContent: `<!DOCTYPE html><html lang="de"><body style="margin:0;padding:0;background:#f5f0eb;font-family:sans-serif;"><div style="max-width:560px;margin:40px auto;background:#fff;border-radius:18px;padding:40px 32px;box-shadow:0 2px 12px rgba(38,29,24,0.08);"><p style="margin:0 0 16px;font-size:15px;color:#3d3026;line-height:1.6;">Hallo,</p><p style="margin:0 0 24px;font-size:15px;color:#3d3026;line-height:1.6;">vielen Dank für deine Bestätigung! Hier ist dein kostenloser Download:</p><p style="margin:0 0 24px;font-size:15px;font-weight:700;color:#3d3026;">📄 ${freebieName}</p><a href="${pdfUrl}" clicktracking="off" style="display:inline-block;padding:14px 32px;background:#4a7c3f;color:#fff;text-decoration:none;border-radius:100px;font-weight:700;font-size:15px;">PDF herunterladen</a><p style="margin:32px 0 0;font-size:13px;color:rgba(61,48,38,0.45);line-height:1.5;">Der Link ist dauerhaft gültig — du kannst ihn jederzeit erneut aufrufen.<br>Viel Freude damit! 🌱</p></div></body></html>`,
        }),
      });
    }

    return Response.redirect(success, 302);
  } catch (e) {
    return Response.redirect(success, 302);
  }
}

async function handleNewsletterSignup(request, env) {
  const json = { 'Content-Type': 'application/json' };
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, msg: 'Method not allowed' }), { status: 405, headers: json });
  }
  try {
    const { email, consent } = await request.json();
    if (!email || !consent) {
      return new Response(JSON.stringify({ ok: false, msg: 'Fehlende Angaben.' }), { status: 400, headers: json });
    }
    const timestamp = Date.now();
    const data = `${email}|newsletter|${timestamp}`;
    const sig = await signHmac(data, env.DOI_HMAC_SECRET);
    const token = encodeURIComponent(btoa(data) + '.' + sig);
    const confirmUrl = `https://www.eduleo-akademie.de/newsletter-confirm?t=${token}`;

    const emailResp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
      body: JSON.stringify({
        sender: { name: 'EDULEO Akademie', email: 'neuigkeiten@eduleo-akademie.de' },
        to: [{ email }],
        subject: 'Bitte bestätige deine Newsletter-Anmeldung',
        htmlContent: `<!DOCTYPE html><html lang="de"><body style="margin:0;padding:0;background:#f5f0eb;font-family:sans-serif;"><div style="max-width:560px;margin:40px auto;background:#fff;border-radius:18px;padding:40px 32px;box-shadow:0 2px 12px rgba(38,29,24,0.08);"><p style="margin:0 0 16px;font-size:15px;color:#3d3026;line-height:1.6;">Hallo,</p><p style="margin:0 0 24px;font-size:15px;color:#3d3026;line-height:1.6;">du hast dich für den Newsletter der EDULEO Akademie angemeldet. Klick auf den Button um deine E-Mail-Adresse zu bestätigen:</p><a href="${confirmUrl}" clicktracking="off" style="display:inline-block;padding:14px 32px;background:#4a7c3f;color:#fff;text-decoration:none;border-radius:100px;font-weight:700;font-size:15px;">Jetzt bestätigen</a><p style="margin:32px 0 0;font-size:13px;color:rgba(61,48,38,0.45);line-height:1.5;">Der Link ist 48 Stunden gültig. Falls du dich nicht angemeldet hast, kannst du diese E-Mail einfach ignorieren.<br>Du kannst dich jederzeit wieder abmelden.</p></div></body></html>`,
      }),
    });

    if (!emailResp.ok) {
      const errText = await emailResp.text();
      return new Response(JSON.stringify({ ok: false, msg: errText }), { status: 500, headers: json });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: json });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, msg: String(e) }), { status: 500, headers: json });
  }
}

async function handleNewsletterConfirm(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('t');
  const success = 'https://www.eduleo-akademie.de/newsletter/bestaetigt/';
  const error   = 'https://www.eduleo-akademie.de/?newsletter=fehler';

  if (!token) return Response.redirect(success, 302);

  try {
    const dotIdx = token.lastIndexOf('.');
    if (dotIdx === -1) return Response.redirect(error, 302);

    const encoded = token.slice(0, dotIdx);
    const sig     = token.slice(dotIdx + 1);
    const data    = atob(encoded);

    const expectedSig = await signHmac(data, env.DOI_HMAC_SECRET);
    if (sig !== expectedSig) return Response.redirect(error, 302);

    const parts = data.split('|');
    if (parts.length !== 3 || parts[1] !== 'newsletter') return Response.redirect(error, 302);
    const [email, , timestamp] = parts;

    if (Date.now() - Number(timestamp) > 48 * 60 * 60 * 1000) {
      return Response.redirect(error, 302);
    }

    await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
      body: JSON.stringify({ email, listIds: [13], updateEnabled: true }),
    });

    return Response.redirect(success, 302);
  } catch (e) {
    return Response.redirect(success, 302);
  }
}

async function signHmac(data, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function handleSubmit(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  try {
    const formData = await request.formData();
    const data = {};
    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }

    // Alle Felder als lesbare HTML-Tabelle zusammenbauen
    const rows = Object.entries(data)
      .filter(([k]) => k !== 'access_key' && k !== 'botcheck')
      .map(([k, v]) => `<tr><td style="padding:6px 12px;font-weight:600;color:#555;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:6px 12px;color:#261D18">${v || '–'}</td></tr>`)
      .join('');

    const subject = data['subject'] || data['Subject'] || 'Neue Formularanmeldung';
    const htmlContent = `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f5f0eb;padding:32px"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:14px;padding:32px"><h2 style="margin:0 0 20px;font-size:18px;color:#261D18">${subject}</h2><table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table></div></body></html>`;

    // In KV speichern (Archiv) + per Brevo versenden — parallel
    const key = new Date().toISOString() + '_' + Math.random().toString(36).slice(2, 8);
    const [brevoResp] = await Promise.all([
      fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
        body: JSON.stringify({
          sender: { name: 'EDULEO Website', email: 'neuigkeiten@eduleo-akademie.de' },
          to: [{ email: 'kontakt@eduleo-akademie.de', name: 'EDULEO Akademie' }],
          subject,
          htmlContent,
        }),
      }),
      env.FORM_SUBMISSIONS.put(key, JSON.stringify({ ...data, _receivedAt: key })),
    ]);

    if (brevoResp.ok) {
      return new Response(JSON.stringify({ success: true, message: 'Anmeldung erfolgreich übermittelt.' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      const err = await brevoResp.text();
      return new Response(JSON.stringify({ success: false, message: 'E-Mail-Fehler: ' + err.substring(0, 200) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

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

    const systemPrompt = `Du bist Leo, der freundliche Chatbot der EDULEO Akademie. Du hilfst pädagogischen Fachkräften, die passende Fortbildung zu finden, und beantwortest Fragen zu unseren Angeboten. Antworte immer auf Deutsch, kurz und herzlich (maximal 3-4 Sätze). Duze die Person. Verwende KEIN Markdown – keine Sternchen, keine Fettschrift, keine Aufzählungszeichen mit Bindestrich. Schreib in normalem Fließtext.

ÜBER DIE EDULEO AKADEMIE:
Die EDULEO Akademie bietet praxisnahe Online-Fortbildungen für ErzieherInnen, pädagogische Fachkräfte und Kita-Leitungen. Alle Fortbildungen sind 100% online & live, zertifiziert und sofort im Kita-Alltag umsetzbar.
Kontakt: kontakt@eduleo-akademie.de | Tel: +49 160 50590620
Website: www.eduleo-akademie.de

3-MONATS-FORTBILDUNGEN (intensive Expertenprogramme, 3 Monate, live online):
Alle 3-Monats-Fortbildungen kosten 900€ und umfassen 8 Live-Termine – außer die Kita-ExpertIn für Verhaltensauffälligkeiten: diese hat 9 Live-Termine und kostet 1000€.
1. Kita-ExpertIn für ADHS & Autismus – Strategien für Verhalten im Alltag (8 Termine, 900€)
2. Kita-ExpertIn für Verhaltensauffälligkeiten – (9 Termine, 1000€)
3. Digitale Medien Beauftragte/r in der Kita (8 Termine, 900€)
4. Leitung der Vorschule (8 Termine, 900€) – für Vorschulverantwortliche, ErzieherInnen die die Vorschulgruppe leiten oder übernehmen möchten, und Fachkräfte die ein Vorschulkonzept entwickeln wollen; NICHT ausschließlich für Kita-Leitungen
5. Teamcoach in der Kita (8 Termine, 900€)
6. Kita KoordinatorIn für Kinderschutz (8 Termine, 900€)
7. Kinderyoga Kursleitung (8 Termine, 900€)
8. Stressbewältigungscoach (8 Termine, 900€)
9. Marte Meo PraktikerIn (8 Termine, 900€)
10. FachberaterIn für Inklusion (8 Termine, 900€)

TAGESFORTBILDUNGEN (alle 150€, 1 Tag, live online):
- Stressbewältigung im Kita-Alltag
- Sexualentwicklung 0–6 Jahre
- Umgang mit Personalmangel
- Autismus im Kita-Alltag
- Elterngespräche führen
- ADHS in der Kita
- Kinderschutz in der Kita
- Kinderyoga in der Kita
- Kinderyoga Praxisübungen
- Digitale Kita mit Kitaversum
- Forschen & Entdecken mit FRED
- Führungsrolle Kita-Leitung
- Gewaltfreie Kommunikation
- Musik, Tanz & Bewegung mit Bodo
- Schule in Sicht (Vorschule)
- Sprache fördern mit Wuppi
- Teams leiten & stärken
- Vorschulkonzept gestalten

TEAMFORTBILDUNGEN (für das gesamte Kita-Team, online oder vor Ort, individuell geplant):
6 Kernthemen:
1. Ressourcen stärken: Teamarbeit und Kommunikation im Kita-Alltag
2. Herausfordernde Zeiten meistern: Personalmangel im Kita-Team
3. Elternarbeit auf Augenhöhe: Partnerschaftlich und professionell
4. Kinderschutz in der Praxis: Prävention und Handlungssicherheit
5. Smart Start: Digitale Medien in der Kita
6. Inklusion leben: Vielfalt in der Kita gestalten
Außerdem können alle Tages- und 3-Monats-Fortbildungen als Teamfortbildung gebucht werden.

Ablauf Teamfortbildung:
Schritt 1: Anfrageformular ausfüllen
Schritt 2: Persönlicher Austausch per Mail, individuelle Planung
Schritt 3: Ca. 1 Woche vorher Zoom-Link per E-Mail (bei Online-Terminen)
Dauer: 6 Stunden (9:00–15:00 Uhr inkl. 45 Min. Mittagspause)
Zertifikat auf Anfrage erhältlich. Alle Preise umsatzsteuerbefreit.

Preise Teamfortbildungen (Pauschalpreise):
- bis 10 Personen: 1.100€
- 11–20 Personen: ab 1.210€
- 21–29 Personen: ab 2.310€
- ab 30 Personen: 3.500€
- Präsenz vor Ort: +450€ Aufpreis

BRING A FRIEND (nur bei 3-Monats-Fortbildungen):
Eine Person meldet sich an und zahlt den regulären Kurspreis — eine zweite Person nimmt kostenlos teil. Beide melden sich zusammen über das Formular unter /bring-a-friend/ an. Das Angebot gilt ausschließlich für 3-Monats-Fortbildungen.
PREISE: Alle Tagesfortbildungen kosten genau 150€. Alle 3-Monats-Fortbildungen kosten 900€ (8 Termine), außer Verhaltensauffälligkeiten: 1.000€ (9 Termine).

STORNOREGELUNGEN (bei Absage durch Einrichtung oder Teilnehmende):
- Bis 6 Wochen vorher: 100% Erstattung
- Bis 4 Wochen vorher: 50% Erstattung
- Bis 1 Woche vorher: 20% Erstattung
- Weniger als 1 Woche vorher: keine Erstattung (0%)
Wurde eine Rechnung gestellt, muss diese gezahlt werden – es kann jedoch ein neuer Termin als Guthaben gewählt werden.


ZAHLUNGSBEDINGUNGEN:
Die Rechnung wird per E-Mail an den Auftraggeber (Einrichtung oder Person) geschickt und ist innerhalb von 14 Tagen nach Erhalt zu bezahlen. Bei 3-Monats-Fortbildungen ist Ratenzahlung möglich.

ANMELDUNG:
Die Anmeldung wird verbindlich, sobald das Formular abgesendet wird.

ZEITEN:
- Tagesfortbildungen: 9:00–15:00 Uhr (inkl. 45 Min. Mittagspause), Vorschul-Fortbildungen: 8:30–15:00 Uhr
- 3-Monats-Fortbildungen: je ca. 2–2,5 Stunden pro Live-Termin (abends oder vormittags, je nach Kurs)
- Teamfortbildungen: 9:00–15:00 Uhr (6 Stunden, inkl. 45 Min. Mittagspause)

ZERTIFIKAT:
- Tagesfortbildungen: Zertifikat wird bei Teilnahme ausgestellt
- 3-Monats-Fortbildungen: Zertifikat nach regelmäßiger Teilnahme – mindestens 6 von 8 Live-Sessions (bzw. 7 von 9 bei Verhaltensauffälligkeiten)
- Teamfortbildungen: Zertifikat auf Anfrage
Alle Zertifikate werden nach Abschluss der Fortbildung ausgestellt.

AUFZEICHNUNGEN (nur bei 3-Monats-Fortbildungen):
Die Live-Termine der 3-Monats-Fortbildungen werden aufgezeichnet und den Teilnehmenden zur Verfügung gestellt – wer einen Termin verpasst, kann ihn nachträglich anschauen. Die Aufzeichnungen werden nicht an Dritte weitergegeben.

PLATTFORM & TECHNISCHES:
Alle Online-Fortbildungen finden per Zoom statt. Der Zoom-Link wird ca. 1 Woche vor dem ersten Termin per E-Mail verschickt. Für die Teilnahme wird ein Computer, Tablet oder Smartphone mit Internetzugang benötigt. Bei technischen Problemen auf Seiten von EDULEO wird nach Möglichkeit ein Ersatztermin angeboten.

PORTAL & KURSUNTERLAGEN:
Ab ca. 1 Woche vor der Fortbildung stehen alle Unterlagen im Portal bereit. Auch nach der Fortbildung können die Materialien dort jederzeit heruntergeladen werden. Zugangsdaten zum Portal erhalten die Teilnehmenden nach der Anmeldung.

ZIELGRUPPE:
Die Fortbildungen richten sich an ErzieherInnen, pädagogische Fachkräfte und Kita-Leitungen. Auch Tagesmütter, Tagesväter, Berufseinsteiger und alle anderen Interessierten sind herzlich willkommen. Die Kosten können vom Träger oder der Einrichtung übernommen werden — die Rechnung geht direkt an den angegebenen Auftraggeber. Eine Anmeldung auf eigene Kosten ist ebenfalls möglich.

DOZENTINNEN:
Alle DozentInnen kommen aus der Praxis – aus dem Kita-Alltag, der Beratung oder der Therapie. Sie verbinden Fachwissen mit konkretem Alltagsbezug und haben jahrelange Berufserfahrung. Hier eine Übersicht der Fachgebiete:
- Janine Klumper (Gründerin): B.A. Pädagogin, Frühförderung, Vorschule
- Hannah Flunkert (Gründerin): B.Sc. Psychologie, kindliche Entwicklungspsychologie, Konzeption und Design
- Nadine Lehmann: Erzieherin, Krippenleitung seit 2007, Entspannungspädagogin, Integrationspädagogik, psychologische Beraterin
- Nadja Peuckert: Bildungswissenschaftlerin, Psychologie, Erzieherin mit 12 Jahren Praxiserfahrung, infans-Konzept
- Belinda Papajewski: 11 Jahre Kita-Erfahrung, Kinder mit Förderbedarf und herausforderndem Verhalten, Traumapädagogik, Kinderyoga
- Daniela Faller: Erzieherin mit 12 Jahren Erfahrung, Führungskraft, Elterngespräche, Elternarbeit
- Sarah Weber: über 7 Jahre therapeutische Arbeit mit Kindern im Autismus-Spektrum, ADHS, Neurodivergenz
- Lena Weisz: Erzieherin, Sprachförderung, Kinderyoga für Kinder und Erwachsene, internationale Erfahrung
- Melanie Schroeder: psychologische Beraterin, Schwerpunkt ADHS im Kindes- und Jugendalter, Schulbegleitung
- Silke Geschwenter-Westmeier: über 25 Jahre Erfahrung, Verhaltensauffälligkeiten, ressourcenorientierte Begleitung
- Isabelle Trittel: Musiktherapie, Autismustherapie, ADHS-Beratung, neurodivergenzfreundliche Haltung
- Calvin Klumper: Koordination und Ansprechpartner für alle organisatorischen Fragen (Mail, Telefon), B.Sc. Psychologie

ANSPRECHPARTNER:
Für alle organisatorischen Fragen (Zugangsdaten, Terminänderungen etc.) ist Calvin Klumper zuständig. Für Rechnungen ist Lutz der Ansprechpartner. Beide erreichbar per E-Mail an kontakt@eduleo-akademie.de oder Tel. +49 160 50590620.

ZOOM-LINK & PORTALZUGANG:
Den Zoom-Link erhalten Teilnehmende per E-Mail ca. 1 Woche vor dem ersten Termin — er ist außerdem auch im Portal zu finden.

KURSABSAGE DURCH DEN ANBIETER:
Wenn ein Kurs abgesagt wird, werden die Teilnehmenden auf den nächstmöglichen Kurstermin umgebucht. Es gibt dann individuelle Absprachen — wer den neuen Termin nicht wahrnehmen kann oder möchte, klärt das direkt mit EDULEO.

Schließe NIEMALS von einem Kursnamen auf eine bestimmte Zielgruppe — z.B. ist „Leitung der Vorschule" nicht nur für Kita-Leitungen, sondern für alle die mit der Vorschulgruppe arbeiten. Alle Kurse stehen grundsätzlich allen Interessierten offen.

Verweise NICHT auf die Website – die Person ist bereits darauf. Verweise auch NUR im absoluten Notfall auf kontakt@eduleo-akademie.de – nur wenn du eine Frage wirklich gar nicht beantworten kannst. Versuche zuerst immer selbst zu helfen. Empfehle bei Interesse immer einen passenden Kurs. Konkrete Starttermine kennst du nicht – sag dann ehrlich dass die Termine regelmäßig neu starten und frag nach welche Fortbildung sie interessiert.`;

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
