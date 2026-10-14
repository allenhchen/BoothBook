import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const origin = 'https://booth.example', listeners = {}, stores = new Map();
let offline = false;
async function network(input) {
  if (offline)
    throw new TypeError('Disconnected'); const url = new URL(typeof input === 'string' ? input : input.url, origin); if (url.pathname.startsWith('/offline/'))
    return new Response(fs.readFileSync('public' + url.pathname), { headers: { 'Content-Type': url.pathname.endsWith('.json') ? 'application/json' : 'text/html' } }); return new Response('online page');
}
const caches = {
  async open(name) {
    if (!stores.has(name))
      stores.set(name, new Map()); const map = stores.get(name); return {
        async addAll(urls) {
          for (const url of urls)
            map.set(new URL(url, origin).href, await network(url));
        }, async match(request) { return map.get(new URL(typeof request === 'string' ? request : request.url, origin).href)?.clone(); }
      };
  }, async keys() { return [...stores.keys()]; }, async delete(name) { return stores.delete(name); }
};
vm.runInNewContext(fs.readFileSync('public/boothbook-sw.js', 'utf8'), { self: { location: { origin }, clients: { async claim() { } }, async skipWaiting() { }, addEventListener: (name, handler) => listeners[name] = handler }, caches, fetch: network, URL, Response, Error });
async function event(name) { let result; listeners[name]({ waitUntil: p => result = p }); await result; }
await event('install');
await event('activate');
async function request(path, mode = 'navigate') { let result; listeners.fetch({ request: { url: origin + path, method: 'GET', mode }, respondWith: p => result = p }); return result; }
assert.equal(await (await request('/')).text(), 'online page');
offline = true;
const shell = await request('/');
assert.equal(shell.status, 200);
assert.match(await shell.text(), /id="root"/);
const assets = JSON.parse(fs.readFileSync('public/offline/asset-list.json', 'utf8'));
assert(assets.some(p => p.endsWith('.js')));
assert(assets.some(p => p.endsWith('.css')));
for (const path of assets)
  assert.equal((await request(path, 'cors')).status, 200);
assert.equal(await request('/api/workspace'), undefined);
assert.equal(await request('/signin-with-chatgpt'), undefined);
console.log('Service worker caches complete offline shell/assets, falls back on lost connectivity, and never intercepts account/API requests. Browser/iPad validation still required.');
