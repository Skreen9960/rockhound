import { list, put, del } from '@vercel/blob';
import { readFileSync } from 'fs';
import { join } from 'path';

const RATE_MAP = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const entry = RATE_MAP.get(ip) || { count: 0, start: now };
  if (now - entry.start > 60000) {
    RATE_MAP.set(ip, { count: 1, start: now });
    return false;
  }
  if (entry.count >= 5) return true;
  entry.count++;
  RATE_MAP.set(ip, entry);
  return false;
}

async function readBlob(prefix, fallbackFile) {
  try {
    const blobs = await list({ prefix });
    if (blobs.blobs.length > 0) {
      const r = await fetch(blobs.blobs[0].url, { headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` } });
      return await r.json();
    }
  } catch (e) {}
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'data', fallbackFile), 'utf8'));
  } catch (e) {
    return [];
  }
}

async function writeBlob(filename, data) {
  const blobs = await list({ prefix: filename });
  for (const blob of blobs.blobs) {
    await del(blob.url);
  }
  await put(filename, JSON.stringify(data), { access: 'public', contentType: 'application/json' });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ ok: false, error: 'Trop de soumissions. Réessaie dans une minute.' });
  }

  try {
  const { name, lat, lng, category, description, species, minerals, source } = req.body || {};

  if (!name?.trim() || !lat || !lng || !description?.trim()) {
    return res.status(400).json({ ok: false, error: 'Champs obligatoires : nom, coordonnées, description.' });
  }

  const latN = parseFloat(lat);
  const lngN = parseFloat(lng);
  if (isNaN(latN) || isNaN(lngN) || latN < 43 || latN > 46 || lngN < 4 || lngN > 8) {
    return res.status(400).json({ ok: false, error: 'Coordonnées invalides (région PACA : lat 43–46, lng 4–8).' });
  }

  const typeMap = { fossils: 'f90', cenozoic: 'p', mines: 'm90', volcanic: 'vol' };
  const id = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const site = {
    id,
    name: name.trim().slice(0, 100),
    lat: latN,
    lng: lngN,
    type: typeMap[category] || 'custom',
    category: category || 'custom',
    subtitle: '',
    description: description.trim().slice(0, 500),
    species: species ? species.split(/[,·]/).map(s => s.trim()).filter(Boolean) : [],
    minerals: minerals ? minerals.split(/[,·]/).map(s => s.trim()).filter(Boolean) : [],
    source: source?.trim().slice(0, 200) || null,
    tags: [],
    isProtectedZone: false,
    protectedZoneName: null,
    hasToxicMinerals: false,
    toxicMinerals: [],
    distanceMinutes: null,
    status: 'pending',
    submittedAt: new Date().toISOString(),
  };

  const pending = await readBlob('pending.json', 'pending.json');
  pending.push(site);
  await writeBlob('pending.json', pending);

  // Email via Resend
  const host = req.headers.host || 'rockhound-lac.vercel.app';
  const base = `https://${host}`;
  const validateUrl = `${base}/api/moderate?id=${id}&action=validate&token=${process.env.ADMIN_TOKEN}`;
  const rejectUrl   = `${base}/api/moderate?id=${id}&action=reject&token=${process.env.ADMIN_TOKEN}`;

  const specLine = site.species.length ? `<tr><td style="padding:3px 12px 3px 0;color:#888">Espèces</td><td>${site.species.join(', ')}</td></tr>` : '';
  const minLine  = site.minerals.length ? `<tr><td style="padding:3px 12px 3px 0;color:#888">Minéraux</td><td>${site.minerals.join(', ')}</td></tr>` : '';
  const srcLine  = site.source ? `<tr><td style="padding:3px 12px 3px 0;color:#888">Source</td><td>${site.source}</td></tr>` : '';

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'RockHound <onboarding@resend.dev>',
      to: process.env.ADMIN_EMAIL,
      subject: `🪨 RockHound — Nouveau site proposé : ${site.name}`,
      html: `
        <div style="font-family:'Segoe UI',sans-serif;background:#0f0f1a;color:#e8e0d0;padding:24px;border-radius:10px;max-width:500px">
          <h2 style="color:#b8903e;margin-top:0">🪨 Nouveau site proposé</h2>
          <table style="border-collapse:collapse;font-size:14px;width:100%">
            <tr><td style="padding:3px 12px 3px 0;color:#888">Nom</td><td><b>${site.name}</b></td></tr>
            <tr><td style="padding:3px 12px 3px 0;color:#888">Coordonnées</td><td>${site.lat.toFixed(5)}°N ${site.lng.toFixed(5)}°E</td></tr>
            <tr><td style="padding:3px 12px 3px 0;color:#888">Catégorie</td><td>${site.category}</td></tr>
            <tr><td style="padding:3px 12px 3px 0;color:#888">Description</td><td>${site.description}</td></tr>
            ${specLine}${minLine}${srcLine}
          </table>
          <br>
          <a href="${validateUrl}" style="display:inline-block;padding:10px 22px;background:#22c55e;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;margin-right:10px">✅ Valider</a>
          <a href="${rejectUrl}"   style="display:inline-block;padding:10px 22px;background:#eb5757;color:#fff;text-decoration:none;border-radius:6px;font-weight:700">❌ Rejeter</a>
        </div>`,
    }),
  }).catch(e => console.warn('[Resend]', e.message));

  return res.status(200).json({ ok: true, message: 'Site soumis. Il sera visible après validation.' });

  } catch (err) {
    console.error('[submit]', err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
}
