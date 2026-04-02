// Proxy BRGM — contourne les restrictions CORS de geoservices.brgm.fr
// Rate-limiting in-memory : max 60 req/min par IP

const rateMap = new Map();
const RATE_LIMIT = 60;
const RATE_WINDOW = 60 * 1000;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW) {
    rateMap.set(ip, { count: 1, start: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  rateMap.set(ip, entry);
  return false;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ ok: false, error: 'Trop de requêtes. Réessaie dans une minute.' });
  }

  const { lat, lng } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ ok: false, error: 'Paramètres lat et lng requis.' });
  }

  const latN = parseFloat(lat);
  const lngN = parseFloat(lng);
  if (isNaN(latN) || isNaN(lngN)) {
    return res.status(400).json({ ok: false, error: 'lat et lng doivent être des nombres.' });
  }

  const delta = 0.001;
  const bbox = `${lngN - delta},${latN - delta},${lngN + delta},${latN + delta}`;
  const url =
    `https://geoservices.brgm.fr/geologie?SERVICE=WMS&REQUEST=GetFeatureInfo` +
    `&VERSION=1.3.0&CRS=CRS:84` +
    `&BBOX=${bbox}` +
    `&WIDTH=101&HEIGHT=101&I=50&J=50` +
    `&LAYERS=GEOLOGIE&QUERY_LAYERS=GEOLOGIE` +
    `&INFO_FORMAT=application/json&FEATURE_COUNT=1`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const upstream = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!upstream.ok) {
      return res.status(502).json({ ok: false, error: `BRGM a répondu ${upstream.status}` });
    }

    const data = await upstream.json();
    return res.status(200).json({ ok: true, data });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ ok: false, error: 'BRGM n\'a pas répondu dans les délais (8s).' });
    }
    return res.status(502).json({ ok: false, error: 'BRGM indisponible.' });
  }
}
