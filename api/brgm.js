// Proxy BRGM — contourne CORS de geoservices.brgm.fr
// Parse HTML côté serveur, retourne GeoJSON-compatible
// Rate-limiting in-memory : max 60 req/min par IP

const rateMap = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > 60000) {
    rateMap.set(ip, { count: 1, start: now });
    return false;
  }
  if (entry.count >= 60) return true;
  entry.count++;
  rateMap.set(ip, entry);
  return false;
}

function parseHtmlTable(html) {
  const cells = {};
  const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
  rows.forEach(row => {
    const tds = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
    if (tds.length >= 2) {
      const k = tds[0].replace(/<[^>]+>/g, '').trim().toUpperCase();
      const v = tds[1].replace(/<[^>]+>/g, '').trim();
      if (k) cells[k] = v;
    }
  });
  return cells;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ ok: false, error: 'Trop de requêtes. Réessaie dans une minute.' });
  }

  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ ok: false, error: 'Paramètres lat et lng requis.' });

  const latN = parseFloat(lat);
  const lngN = parseFloat(lng);
  if (isNaN(latN) || isNaN(lngN)) return res.status(400).json({ ok: false, error: 'Coordonnées invalides.' });

  // EPSG:4326 + text/html : format éprouvé avec geoservices.brgm.fr
  const d = 0.005;
  const bbox = `${latN - d},${lngN - d},${latN + d},${lngN + d}`;
  const url =
    `https://geoservices.brgm.fr/geologie?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo` +
    `&LAYERS=GEOLOGIE&QUERY_LAYERS=GEOLOGIE` +
    `&CRS=EPSG%3A4326&BBOX=${bbox}` +
    `&WIDTH=101&HEIGHT=101&I=50&J=50` +
    `&INFO_FORMAT=text%2Fhtml&FEATURE_COUNT=1`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const upstream = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!upstream.ok) {
      return res.status(502).json({ ok: false, error: `BRGM a répondu ${upstream.status}` });
    }

    const html = await upstream.text();

    if (!html || html.length < 30) {
      return res.status(200).json({ ok: true, data: { type: 'FeatureCollection', features: [] } });
    }

    const cells = parseHtmlTable(html);

    if (Object.keys(cells).length === 0) {
      return res.status(200).json({ ok: true, data: { type: 'FeatureCollection', features: [] } });
    }

    return res.status(200).json({
      ok: true,
      data: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {
            NOTATION:    cells['NOTATION']    || cells['CODE']        || cells['CODE_LEGENDE'] || cells['SYMBOL']  || '',
            DESCRIPTION: cells['DESCRIPTION'] || cells['NOM_LEGENDE'] || cells['LEGENDE']      || cells['LIBELLE'] || '',
            NOM_CARTE:   cells['NOM_CARTE']   || cells['FEUILLE']    || cells['NUMERO']        || '',
          },
        }],
      },
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ ok: false, error: "BRGM n'a pas répondu dans les délais (8s)." });
    }
    return res.status(502).json({ ok: false, error: 'BRGM indisponible.' });
  }
}
