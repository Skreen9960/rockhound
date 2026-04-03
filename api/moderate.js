import { list, put, del } from '@vercel/blob';
import { readFileSync } from 'fs';
import { join } from 'path';

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

function page(title, msg, color) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — RockHound</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',sans-serif;background:#0f0f1a;color:#e8e0d0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
  .box{text-align:center;padding:40px 32px;border:2px solid ${color};border-radius:12px;max-width:420px;width:100%}
  h1{color:${color};margin-bottom:12px;font-size:1.4rem}p{color:#aaa;font-size:.9rem;line-height:1.6}
  a{display:inline-block;margin-top:20px;padding:8px 20px;background:${color}22;border:1px solid ${color};color:${color};text-decoration:none;border-radius:6px;font-size:.85rem}</style></head>
  <body><div class="box"><h1>${title}</h1><p>${msg}</p><a href="/">← Retour à RockHound</a></div></body></html>`;
}

export default async function handler(req, res) {
  const { id, action, token } = req.query;

  if (!token || token !== process.env.ADMIN_TOKEN) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(403).send(page('Accès refusé', 'Token invalide ou expiré.', '#eb5757'));
  }

  if (!id || !['validate', 'reject'].includes(action)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(page('Erreur', 'Paramètres manquants (id, action).', '#f59e0b'));
  }

  const pending = await readBlob('pending.json', 'pending.json');
  const idx = pending.findIndex(s => s.id === id);

  if (idx === -1) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(page('Déjà traité', 'Ce site a déjà été validé ou rejeté.', '#f59e0b'));
  }

  const [site] = pending.splice(idx, 1);
  await writeBlob('pending.json', pending);

  if (action === 'validate') {
    site.status = 'validated';
    delete site.submittedAt;
    const catalogue = await readBlob('catalogue.json', 'catalogue.json');
    catalogue.push(site);
    await writeBlob('catalogue.json', catalogue);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(page('✅ Site validé', `"${site.name}" est maintenant visible sur RockHound pour tous les visiteurs.`, '#22c55e'));
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(page('❌ Site rejeté', `"${site.name}" a été supprimé des soumissions en attente.`, '#eb5757'));
}
