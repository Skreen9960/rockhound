import { list } from '@vercel/blob';
import { readFileSync } from 'fs';
import { join } from 'path';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'GET') {
    try {
      const blobs = await list({ prefix: 'pending.json' });
      if (blobs.blobs.length > 0) {
        const response = await fetch(blobs.blobs[0].url);
        const data = await response.json();
        return res.status(200).json({ ok: true, data });
      }
      // Fallback sur le fichier seed local
      const seed = JSON.parse(
        readFileSync(join(process.cwd(), 'data', 'pending.json'), 'utf8')
      );
      return res.status(200).json({ ok: true, data: seed });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
}
