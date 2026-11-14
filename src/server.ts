import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Mistral } from '@mistralai/mistralai';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC_DIR = join(ROOT, 'public');
const PORT = Number(process.env.PORT ?? 3000);
const MODEL = 'mistral-small-latest';

function loadEnv(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m && m[2] && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}
loadEnv(join(ROOT, '.env'));

const apiKey = process.env.MISTRAL_API_KEY;
const client = apiKey
  ? new Mistral({
      apiKey,
      ...(process.env.MISTRAL_SERVER_URL ? { serverURL: process.env.MISTRAL_SERVER_URL } : {}),
    })
  : null;

const SYSTEM_PROMPT = `Tu es l'assistant de GlyphLab, une app de dessin de lettres en vecto.
Tu réponds en français, brièvement.
Quand on te demande de dessiner une lettre, un chiffre ou un mot en vecto, tu réponds UNIQUEMENT avec un extrait SVG, sans aucun texte autour :
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="..." fill="#000000"/></svg>
Le dessin doit tenir dans le viewBox 0 0 100 100, être centré et lisible, constitué d'un ou quelques <path> remplis.
Pour toute autre question, réponds en texte simple, sans SVG.`;

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function sendJson(res: ServerResponse, status: number, obj: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

async function handleChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!client) {
    sendJson(res, 500, { error: "MISTRAL_API_KEY n'est pas définie côté serveur (voir .env.example)." });
    return;
  }
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1e5) {
      sendJson(res, 413, { error: 'Requête trop volumineuse.' });
      return;
    }
  }
  let data: { messages?: unknown };
  try {
    data = JSON.parse(body || '{}');
  } catch {
    sendJson(res, 400, { error: 'JSON invalide.' });
    return;
  }
  const raw = Array.isArray(data.messages) ? data.messages : [];
  const history = raw
    .filter(
      (m): m is ChatMessage =>
        typeof m === 'object' && m !== null &&
        ((m as ChatMessage).role === 'user' || (m as ChatMessage).role === 'assistant') &&
        typeof (m as ChatMessage).content === 'string'
    )
    .slice(-20);
  if (history.length === 0 || history[history.length - 1].role !== 'user') {
    sendJson(res, 400, { error: "Le champ messages doit se terminer par un message « user »." });
    return;
  }
  const response = await client.chat.complete({
    model: MODEL,
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
  });
  const content = response.choices?.[0]?.message?.content ?? '';
  sendJson(res, 200, { reply: typeof content === 'string' ? content : JSON.stringify(content) });
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

async function serveStatic(res: ServerResponse, url: string): Promise<void> {
  let path = normalize(decodeURIComponent(url.split('?')[0]));
  if (path === '/' || path === '\\') path = '/index.html';
  const file = join(PUBLIC_DIR, path);
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const content = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404');
  }
}

createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/chat') {
      await handleChat(req, res);
      return;
    }
    if (req.method === 'GET') {
      await serveStatic(res, req.url ?? '/');
      return;
    }
    res.writeHead(405);
    res.end();
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : 'Erreur serveur.' });
  }
}).listen(PORT, () => {
  console.log(`GlyphLab — chat vecto sur http://localhost:${PORT}`);
  if (!client) console.log('Avertissement : MISTRAL_API_KEY absente, /api/chat renverra une erreur.');
});
