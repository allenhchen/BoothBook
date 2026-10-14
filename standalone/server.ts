import { createServer, type IncomingMessage } from 'node:http';
import { readFileSync, existsSync, statSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join, extname, sep } from 'node:path';
import { createWorkspaceApi } from '../lib/workspace-api';
import { createBackupApi } from '../lib/workspace-backup';
import { createFinanceApi } from '../lib/finance-api';
import { openArtistWorkspace, type Artist } from '../lib/artist-store';
import { databasePath, openLocalDatabase } from './sqlite.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.BOOTHBOOK_PORT || 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw Error('BOOTHBOOK_PORT must be between 1024 and 65535.');
const local = openLocalDatabase(databasePath(), join(root, 'drizzle'));
const artist: Artist = {
  id: 'local:owner',
  email: 'Stored on this computer',
  displayName: 'Offline workspace',
  provider: 'local',
};
const dependencies = { database: () => local.db, authenticatedArtist: async () => artist };
await openArtistWorkspace(local.db, artist, '', '');
const workspace = createWorkspaceApi(dependencies),
  finance = createFinanceApi(dependencies),
  backup = createBackupApi({
    ...dependencies,
    beforeImport: () => {
      local.snapshot('before-restore');
    },
  });
const client = realpathSync(join(root, 'dist-local', 'client'));
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};
async function body(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32 * 1024 * 1024) throw Error('Request is too large (maximum 32 MB).');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cache-Control', 'no-store');
  try {
    // Loopback binding + strict Host/Origin checks prevent LAN access and DNS rebinding.
    const host = req.headers.host;
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) {
      res.writeHead(403);
      res.end('Local access only.');
      return;
    }
    const origin = `http://${host}`;
    if (
      req.headers['sec-fetch-site'] === 'cross-site' ||
      (req.headers.origin && req.headers.origin !== origin)
    ) {
      res.writeHead(403);
      res.end('Cross-site access is not allowed.');
      return;
    }
    const url = new URL(req.url || '/', origin),
      method = req.method || 'GET';
    if (url.pathname.startsWith('/api/')) {
      if (!['GET', 'POST'].includes(method)) {
        res.writeHead(405);
        res.end();
        return;
      }
      const h = new Headers();
      for (const [key, value] of Object.entries(req.headers))
        if (typeof value === 'string') h.set(key, value);
      const request = new Request(url, {
        method,
        headers: h,
        ...(method === 'POST' ? { body: await body(req) } : {}),
      });
      let response: Response;
      if (url.pathname === '/api/workspace')
        response = method === 'GET' ? await workspace.GET(request) : await workspace.POST(request);
      else if (url.pathname === '/api/finance')
        response = method === 'GET' ? await finance.GET(request) : await finance.POST(request);
      else if (url.pathname === '/api/backup')
        response = method === 'GET' ? await backup.GET() : await backup.POST(request);
      else if (url.pathname === '/api/auth/session' && method === 'GET')
        response = Response.json({ artist, mode: 'standalone', providers: {} });
      else response = Response.json({ error: 'Not found.' }, { status: 404 });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    if (!['GET', 'HEAD'].includes(method)) {
      res.writeHead(405);
      res.end();
      return;
    }
    if (url.pathname === '/account') {
      const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>BoothBook Offline</title></head><body style="font:16px system-ui;max-width:760px;margin:48px auto;padding:24px"><a href="/">Back to BoothBook</a><h1>Offline workspace</h1><p>No ChatGPT account or internet connection is needed. This copy saves only to your computer.</p><p>Database: <code>${escape(databasePath())}</code></p><p>Use Back up workspace to save a portable JSON copy. Restore backup replaces the offline workspace after making an automatic SQLite backup. Online and offline data do not sync automatically.</p><p>Keep this server running while using BoothBook. Stop it with Ctrl+C when finished.</p></body></html>`;
      res.writeHead(200, { 'Content-Type': mime['.html'] });
      res.end(method === 'HEAD' ? '' : html);
      return;
    }
    const file = resolve(
      client,
      '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname),
    );
    if (
      !file.startsWith(client + sep) ||
      !existsSync(file) ||
      !statSync(file).isFile() ||
      !realpathSync(file).startsWith(client + sep)
    ) {
      res.writeHead(404);
      res.end('Not found.');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
    res.end(method === 'HEAD' ? undefined : readFileSync(file));
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unable to complete the request.' }),
    );
  }
});
server.on('error', (e) => {
  console.error(e.message);
  local.close();
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(
    `BoothBook offline: http://127.0.0.1:${port}\nDatabase: ${databasePath()}\nNo internet or login required. Keep this window open; Ctrl+C to stop.`,
  );
});
function stop() {
  server.close(() => {
    local.close();
    process.exit(0);
  });
  server.closeIdleConnections();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
