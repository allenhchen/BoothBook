'use client';
import { useEffect, useState, useRef } from 'react';
import { Button } from './ui/button';
import {
  cachedWorkspace,
  pendingSales,
  removePending,
  savePending,
  cacheWorkspace,
  type CachedWorkspace,
  type PendingSale,
} from '../lib/offline-store';
export function OfflineStatus({
  artistId,
  busy,
  onSynced,
}: {
  artistId: string;
  busy: boolean;
  onSynced: () => void;
}) {
  const [count, setCount] = useState(0),
    [entries, setEntries] = useState<PendingSale[]>([]),
    [online, setOnline] = useState(true),
    [ready, setReady] = useState(false),
    [syncing, setSyncing] = useState(false),
    [message, setMessage] = useState('');
  const lock = useRef(false),
    busyRef = useRef(busy);
  busyRef.current = busy;
  async function refresh() {
    const sales = await pendingSales(artistId);
    setCount(sales.length);
    setEntries(sales);
  }
  async function enable() {
    try {
      if (!('serviceWorker' in navigator))
        throw Error('Offline page caching is unavailable in this browser.');
      const registration = await navigator.serviceWorker.register('/boothbook-sw.js');
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(Error('Offline setup did not finish. Keep internet connected and retry.')),
            20000,
          ),
        ),
      ]);
      setReady(!!registration.active);
      await navigator.storage?.persist?.();
      setMessage('Offline checkout ready on this device.');
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function sync(manual = true) {
    if (lock.current || busyRef.current) return;
    lock.current = true;
    setSyncing(true);
    try {
      for (const sale of await pendingSales(artistId)) {
        if (sale.error && !manual) break;
        const currentResponse = await fetch('/api/workspace', {
          cache: 'no-store',
          redirect: 'manual',
          signal: AbortSignal.timeout(10000),
        });
        if (
          !currentResponse.ok ||
          !currentResponse.headers.get('content-type')?.includes('application/json')
        )
          throw Error('Sign in again online to sync pending sales.');
        const current = (await currentResponse.json()) as CachedWorkspace;
        if (current.artist.id !== artistId)
          throw Error('Pending sales belong to a different account. Switch back to sync them.');
        const response = await fetch('/api/workspace', {
          method: 'POST',
          redirect: 'manual',
          signal: AbortSignal.timeout(10000),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: current.version,
            action: 'sale',
            clientSaleId: sale.id,
            recordedAt: sale.createdAt,
            expectedLines: sale.lines,
            eventId: sale.eventId,
            saleDate: sale.saleDate,
            units: sale.units,
            pools: sale.pools,
            reference: sale.reference,
            manualDiscount: sale.manualDiscount,
          }),
        });
        if (!response.headers.get('content-type')?.includes('application/json'))
          throw Error('Sign in again online to sync pending sales.');
        const result = (await response.json()) as CachedWorkspace & {
          error?: string;
        };
        if (!response.ok) {
          await savePending({ ...sale, error: result.error || 'Sync needs review.' });
          throw Error(result.error || 'Sync needs review.');
        }
        setOnline(true);
        await removePending(sale.id);
        await cacheWorkspace({ ...result, artist: current.artist });
        await refresh();
        onSynced();
      }
      setMessage('All pending sales synced.');
    } catch (e) {
      if (e instanceof TypeError || (e instanceof DOMException && e.name === 'TimeoutError'))
        setOnline(false);
      setMessage(
        navigator.onLine ? (e as Error).message : 'Offline — sales remain saved on this device.',
      );
    } finally {
      lock.current = false;
      setSyncing(false);
      await refresh();
    }
  }
  useEffect(() => {
    setOnline(navigator.onLine);
    void refresh().catch((e) => setMessage(e.message));
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker.getRegistration('/').then((r) => setReady(!!r?.active));
    const update = () => {
      setOnline(navigator.onLine);
      void refresh().catch((e) => setMessage(e.message));
      if (navigator.onLine) void sync(false);
    };
    const timer = setInterval(() => {
      void refresh().catch(() => {});
      if (navigator.onLine)
        void pendingSales(artistId)
          .then((s) => {
            if (s.length && !s[0].error) void sync(false);
          })
          .catch(() => {});
    }, 15000);
    window.addEventListener('focus', update);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    window.addEventListener('boothbook-pending', update);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', update);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      window.removeEventListener('boothbook-pending', update);
    };
  }, [artistId]);
  useEffect(() => {
    if (!busy && navigator.onLine)
      void pendingSales(artistId)
        .then((s) => {
          if (s.length && !s[0].error) void sync(false);
        })
        .catch(() => {});
  }, [busy, artistId]);
  async function exportPending() {
    const sales = await pendingSales(artistId),
      workspace = await cachedWorkspace();
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              app: 'BoothBook-pending',
              exportedAt: new Date().toISOString(),
              artistId,
              sales,
              workspace,
            },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'BoothBook-pending-sales.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="offline-status" aria-live="polite">
      <span>
        {online ? 'Connection available' : 'Offline'} · {count} pending sales
        {ready ? ' · Offline page ready' : ''}
      </span>
      {!ready && (
        <Button variant="outline" onClick={enable}>
          Enable offline
        </Button>
      )}
      {count > 0 && (
        <>
          <Button variant="outline" disabled={syncing || busy} onClick={() => sync()}>
            {syncing ? 'Syncing…' : 'Sync now'}
          </Button>
          <Button variant="outline" onClick={exportPending}>
            Export pending sales
          </Button>
          <details>
            <summary>Review pending sales</summary>
            {entries.map((s) => (
              <div key={s.id}>
                <strong>
                  {s.saleDate} · {s.lines.length} items · $
                  {(s.lines.reduce((n, l) => n + l.price - l.discount, 0) / 100).toFixed(2)}
                </strong>
                <p>
                  {s.lines.map((l) => l.name).join(', ')}
                  {s.error && ' — ' + s.error}
                </p>
                <Button
                  variant="outline"
                  disabled={syncing}
                  onClick={async () => {
                    if (
                      window.confirm(
                        'Permanently remove this pending sale from this device? Export pending sales first if you need a copy. This does not refund a Square payment.',
                      )
                    ) {
                      await removePending(s.id);
                      await refresh();
                    }
                  }}
                >
                  Remove pending sale
                </Button>
              </div>
            ))}
          </details>
        </>
      )}
      {message && <p>{message}</p>}
      {count > 0 && (
        <small>
          Pending sales are saved only on this device. Keep this page open to sync; do not clear
          website data.
        </small>
      )}
    </section>
  );
}
