import { list } from '@vercel/blob';
import { readFileSync } from 'fs';
import { join } from 'path';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const blobs = await list({ prefix: 'pending.json' });
    if (blobs.blobs.length > 0) {
      const response = await fetch(blobs.blobs[0].url);
      const data = await response.json();
      // Ne jamais exposer l'IP des contributeurs
      const safe = data.map(({ submittedIp, ...s }) => s);
      return res.status(200).json({ ok: true, data: safe });
    }
    const seed = JSON.parse(
      readFileSync(join(process.cwd(), 'data', 'pending.json'), 'utf8')
    );
    return res.status(200).json({ ok: true, data: seed });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
