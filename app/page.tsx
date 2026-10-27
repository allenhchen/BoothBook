'use client';
import { useEffect, useState, useRef, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CategoryItemGrid } from '@/components/category-item-grid';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { workspaceResponse } from '@/lib/api-response';
import { FandomBadge } from '@/components/fandom-badge';
import { workspaceFandomColors, assignFandomColors } from '@/lib/fandom-colors';
import { OfflineStatus } from '@/components/offline-status';
import {
  cachedWorkspace,
  clearCachedWorkspace,
  cacheWorkspace,
  cacheReport,
  cachedReport,
  savePending,
  type CachedWorkspace,
} from '@/lib/offline-store';
import { ThemeToggle } from '@/components/theme-toggle';
import { FinancePanel } from '@/components/finance-tabs';
import { ArtSchedule } from '@/components/art-schedule';
import { WorkspaceBackup } from '@/components/workspace-backup';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BookOpen,
  ShoppingBag,
  CalendarDays,
  Tag,
  Plus,
  Trash2,
  Layers,
  Check,
  ChevronDown,
  Wallet,
  LayoutGrid,
  List,
} from 'lucide-react';
import {
  calculate,
  eligible,
  money,
  path,
  weightedSales,
  eventsForYear,
  sortSalesNames,
  sortedSales,
  removeDeal,
  purchasedItems,
  assignUnit,
  salesGroups,
  sortedItems,
  catalogGroups,
  orderedCategories,
  removeCategory,
  removeItem,
  type Workspace,
  type Item,
  type Unit,
  type Pool,
  type Deal,
} from '@/lib/model';
import {
  conventionDays,
  defaultSaleDay,
  saleDay,
  salesForDay,
  dailySummary,
} from '@/lib/convention-days';
const uid = () => crypto.randomUUID();
function Pick({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: {
    id: string;
    name: string;
  }[];
  label: string;
}) {
  return (
    <Select value={value || 'none'} onValueChange={(v) => onChange(v === 'none' ? '' : v)}>
      <SelectTrigger aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectItem value="none">{label}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export default function App() {
  const [artist, setArtist] = useState<{
      id: string;
      displayName: string;
      email: string;
      provider?: string;
    } | null>(null),
    [signedOut, setSignedOut] = useState(false);
  const [w, setW] = useState<Workspace | null>(null),
    [version, setVersion] = useState(0),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [tab, setTab] = useState('catalog');
  const [units, setUnits] = useState<Unit[]>([]),
    [pools, setPools] = useState<Pool[]>([]),
    [eventId, setEvent] = useState('demo-event'),
    [reference, setReference] = useState(''),
    [query, setQuery] = useState('');
  const [catName, setCatName] = useState(''),
    [parent, setParent] = useState(''),
    [catPrice, setCatPrice] = useState(''),
    [itemName, setItemName] = useState(''),
    [itemCat, setItemCat] = useState(''),
    [itemFandom, setItemFandom] = useState('');
  const [dailySort, setDailySort] = useState<{
      column: 'day' | 'transactions' | 'units' | 'total' | 'discount' | 'weighted';
      direction: number;
    }>({ column: 'weighted', direction: -1 }),
    [year, setYear] = useState(() => String(new Date().getFullYear())),
    [reportSort, setReportSort] = useState<
      Record<
        string,
        {
          column: string;
          direction: number;
        }
      >
    >({}),
    [transactionSort, setTransactionSort] = useState({ column: 'date', direction: -1 });
  const [saleDate, setSaleDate] = useState(''),
    [reportDay, setReportDay] = useState(''),
    [dashboardOpen, setDashboardOpen] = useState(false),
    [reportLoading, setReportLoading] = useState(false),
    [exporting, setExporting] = useState(false),
    [reportEvent, setReportEvent] = useState('');
  const fandomColors = useMemo(() => (w ? workspaceFandomColors(w) : {}), [w]);
  const reportCache = useRef(new Map<string, Workspace>());
  const [catalogView, setCatalogView] = useState<'grid' | 'table'>('grid'),
    [editingItem, setEditingItem] = useState<Item | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  useEffect(() => setExpandedCategories({}), [query]);
  const [deletion, setDeletion] = useState<{
    kind: 'category' | 'item' | 'sale' | 'deal' | 'convention';
    id: string;
    name: string;
  } | null>(null);
  const [sort, setSort] = useState<{
    column: 'name' | 'category' | 'price' | 'fandom';
    direction: number;
  }>({ column: 'fandom', direction: 1 });
  const [dealKind, setDealKind] = useState<'free' | 'amount' | 'percent'>('free'),
    [discountValue, setDiscountValue] = useState('10');
  const [customKind, setCustomKind] = useState<'amount' | 'percent'>('amount'),
    [customValue, setCustomValue] = useState(''),
    [selectedUnit, setSelectedUnit] = useState(''),
    [draggedUnit, setDraggedUnit] = useState('');
  const [dealName, setDealName] = useState(''),
    [buy, setBuy] = useState('2'),
    [free, setFree] = useState('1'),
    [targets, setTargets] = useState<string[]>([]);
  const [eventName, setEventName] = useState(''),
    [start, setStart] = useState('2026-10-06'),
    [end, setEnd] = useState('2026-10-06'),
    [status, setStatus] = useState('awaiting');
  async function load(preserveSelection = false) {
    reportCache.current.clear();
    setReportEvent('');
    setError('');
    try {
      const r = await fetch('/api/workspace', { signal: AbortSignal.timeout(8000) });
      if (
        r.status === 401 ||
        r.redirected ||
        !r.headers.get('content-type')?.includes('application/json')
      ) {
        await clearCachedWorkspace().catch(() => {});
        setSignedOut(true);
        setW(null);
        return;
      }
      const j = (await workspaceResponse(r)) as {
        data: Workspace;
        version: number;
        error?: string;
        artist?: {
          id: string;
          displayName: string;
          email: string;
          provider?: string;
        };
      };
      if (r.status === 401) {
        setSignedOut(true);
        setW(null);
        return;
      }
      if (!r.ok) throw Error(j.error || 'Unable to save data.');
      setSignedOut(false);
      setArtist(j.artist || null);
      setW(j.data);
      setVersion(j.version);
      if (j.artist?.provider !== 'local' && j.artist) await cacheWorkspace(j as CachedWorkspace);
      if (!preserveSelection) {
        setItemCat(
          j.data.categories.find((c) => !j.data.categories.some((x) => x.parentId === c.id))?.id ||
            '',
        );
        setEvent(eventsForYear(j.data.events, year).find((e) => e.status === 'accepted')?.id || '');
      }
    } catch (e) {
      if (
        e instanceof TypeError ||
        (e instanceof DOMException && e.name === 'TimeoutError') ||
        !navigator.onLine
      ) {
        try {
          const cached = await cachedWorkspace();
          if (cached) {
            setArtist(cached.artist);
            setW(cached.data);
            setVersion(cached.version);
            if (!preserveSelection)
              setEvent(
                eventsForYear(cached.data.events, year).find((e) => e.status === 'accepted')?.id ||
                  '',
              );
            setNotice('Offline — using saved catalog on this device.');
            return;
          }
        } catch {}
      }
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    const event = w?.events.find((e) => e.id === eventId);
    if (!event) return;
    const now = new Date(),
      today = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
      ].join('-');
    setSaleDate(defaultSaleDay(event, today));
    setReportDay('');
  }, [
    eventId,
    w?.events.find((e) => e.id === eventId)?.start,
    w?.events.find((e) => e.id === eventId)?.end,
  ]);
  async function persist(
    data: Workspace | undefined,
    sale = false,
    saleId?: string,
    conventionId?: string,
  ) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (sale && artist?.provider !== 'local') {
        if (!w || !artist) throw Error('Load your workspace before recording.');
        const manualDiscount = customValue
          ? {
              kind: customKind,
              value:
                customKind === 'amount'
                  ? Math.round(Number(customValue) * 100)
                  : Number(customValue),
            }
          : undefined;
        const result = calculate(w, units, pools, manualDiscount);
        await savePending({
          id: uid(),
          artistId: artist.id,
          createdAt: new Date().toISOString(),
          eventId,
          saleDate,
          units: structuredClone(units),
          pools: structuredClone(pools),
          reference,
          manualDiscount,
          lines: result.lines.map(({ itemId, name, fandom, category, price, discount, deal }) => ({
            itemId,
            name,
            fandom,
            category,
            price,
            discount,
            deal,
          })),
        });
        setUnits([]);
        setPools([]);
        setReference('');
        setCustomValue('');
        setSelectedUnit('');
        setNotice('Paid sale saved on this device. It will sync when connected.');
        window.dispatchEvent(new Event('boothbook-pending'));
        return true;
      }
      const r = await fetch('/api/workspace', {
        method: 'POST',
        credentials: 'same-origin',
        redirect: 'manual',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(
          conventionId
            ? { version, action: 'delete-convention', eventId: conventionId }
            : saleId
              ? { version, action: 'delete-sale', saleId }
              : sale
                ? {
                    version,
                    action: 'sale',
                    eventId,
                    saleDate,
                    units,
                    pools,
                    reference,
                    manualDiscount: customValue
                      ? {
                          kind: customKind,
                          value:
                            customKind === 'amount'
                              ? Math.round(Number(customValue) * 100)
                              : Number(customValue),
                        }
                      : undefined,
                  }
                : {
                    version,
                    action: 'workspace',
                    data: data
                      ? {
                          ...data,
                          sales: undefined,
                          fandomColors: assignFandomColors(
                            data.items.map((i) => i.fandom || ''),
                            fandomColors,
                          ),
                        }
                      : data,
                  },
        ),
      });
      const j = (await workspaceResponse(r)) as {
        data: Workspace;
        version: number;
        error?: string;
        artist?: {
          id: string;
          displayName: string;
          email: string;
          provider?: string;
        };
      };
      if (!r.ok) throw Error(j.error || 'Unable to save data.');
      setW((old) => ({
        ...j.data,
        sales: conventionId
          ? (old?.sales || []).filter((s) => s.eventId !== conventionId)
          : sale
            ? [...(old?.sales || []).filter((s) => s.eventId === eventId), ...j.data.sales]
            : saleId
              ? j.data.sales
              : old?.sales || [],
      }));
      setVersion(j.version);
      if (artist && artist.provider !== 'local')
        void cacheWorkspace({ ...j, artist } as CachedWorkspace).catch(() =>
          setNotice(
            'Saved online. Offline cache update failed; reload online before going offline.',
          ),
        );
      if (conventionId) {
        reportCache.current.clear();
        if (eventId === conventionId) {
          setDashboardOpen(false);
          setReportEvent('');
          setReportDay('');
          setEvent(
            eventsForYear(j.data.events, year).find((e) => e.status === 'accepted')?.id || '',
          );
        }
      }
      setNotice(
        conventionId
          ? 'Convention and all its recorded sales deleted.'
          : saleId
            ? 'Sale deleted. Dashboard totals updated.'
            : sale
              ? 'Sale recorded for ' + saleDate + '. Every item is included in the tally.'
              : 'Changes saved.',
      );
      if (sale) {
        setUnits([]);
        setPools([]);
        setReference('');
        setCustomValue('');
        setSelectedUnit('');
      }
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  // Browser cache is scoped by artist session, convention, and saved version.
  useEffect(() => {
    if (tab !== 'conventions' || !dashboardOpen || !eventId) return;
    const controller = new AbortController();
    const key = eventId + ':' + version;
    const cached = reportCache.current.get(key);
    if (cached) {
      setW(cached);
      setReportEvent(eventId);
    }
    setReportLoading(true);
    fetch('/api/workspace?eventId=' + encodeURIComponent(eventId), {
      signal: controller.signal,
      cache: 'no-store',
      headers: cached
        ? { 'If-None-Match': '"v' + version + ':' + encodeURIComponent(eventId) + '"' }
        : {},
    })
      .then(async (r) => {
        if (r.status === 304 && cached) return;
        const j = (await workspaceResponse(r)) as {
          data: Workspace;
          version: number;
          error?: string;
        };
        if (!r.ok) throw Error(j.error || 'Unable to load convention.');
        if (!controller.signal.aborted) {
          reportCache.current.clear();
          reportCache.current.set(eventId + ':' + j.version, j.data);
          setW(j.data);
          setReportEvent(eventId);
          setVersion(j.version);
          if (artist && artist.provider !== 'local')
            void cacheReport({ ...j, artist }, eventId).catch(() => {});
        }
      })
      .catch(async () => {
        if (!controller.signal.aborted && artist) {
          const cached = await cachedReport(artist.id, eventId).catch(() => undefined);
          if (cached) {
            setW((old) => (old ? { ...old, sales: cached.data.sales } : cached.data));
            setReportEvent(eventId);
            setNotice(
              'Offline — showing the last saved dashboard. Pending sales are listed separately.',
            );
          } else setError('This dashboard is not cached. Open it online before using it offline.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setReportLoading(false);
      });
    return () => controller.abort();
  }, [tab, dashboardOpen, eventId, version]);
  async function exportDashboard() {
    if (!w) return;
    setExporting(true);
    try {
      const { conventionWorkbook } = await import('@/lib/convention-export');
      const bytes = conventionWorkbook(w, eventId, reportDay);
      const url = URL.createObjectURL(
        new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download =
        (w.events.find((e) => e.id === eventId)?.name || 'Convention').replace(
          /[^a-zA-Z0-9_-]+/g,
          '-',
        ) +
        '-' +
        (reportDay || 'all-days') +
        '-BoothBook.xlsx';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }
  function patch(next: Workspace) {
    void persist(next);
  }
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const abort = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: 'read_artist_alley_workspace',
          description: 'Read the loaded catalog, deals, conventions, and recorded sales.',
          inputSchema: { type: 'object', properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: true },
          execute: (input: unknown) => {
            if (!input || typeof input !== 'object' || Object.keys(input).length)
              throw Error('No arguments are accepted.');
            if (!w) throw Error('Workspace is not loaded.');
            return w;
          },
        },
        { signal: abort.signal },
      ),
    ).catch(() => {});
    return () => abort.abort();
  }, [w]);
  if (signedOut)
    return (
      <main className="loading">
        <ThemeToggle />
        <h1>BoothBook</h1>
        <p>Sign in to open your artist workspace.</p>
        <a href="/account" className="auth-link">
          View sign-in options
        </a>
      </main>
    );
  if (!w)
    return (
      <main className="loading">
        <ThemeToggle />
        <h1>BoothBook</h1>
        <p>{error || 'Opening your workspace…'}</p>
        {error && <Button onClick={() => load()}>Retry</Button>}
      </main>
    );
  const catalogCategories = orderedCategories(w.categories);
  const leaves = catalogCategories.filter((c) => !w.categories.some((x) => x.parentId === c.id));
  const categoryOptions = catalogCategories.map((c) => ({
    id: c.id,
    name: path(w, c.id)
      .map((x) => x.name)
      .join(' / '),
  }));
  const conventionEvents = eventsForYear(w.events, year);
  const years = Array.from(new Set([String(new Date().getFullYear()), ...w.events.map((e) => e.start.slice(0, 4))]))
    .sort()
    .reverse()
    .map((id) => ({ id, name: id }));
  const dashboardAccepted = conventionEvents.filter((e) => e.status === 'accepted');
  const accepted = conventionEvents.filter((e) => e.status === 'accepted');
  let calc: ReturnType<typeof calculate> = {
      lines: [],
      gross: 0,
      discount: 0,
      total: 0,
      dealDiscount: 0,
      manualDiscount: 0,
    },
    cartError = '';
  try {
    calc = calculate(
      w,
      units,
      pools,
      customValue
        ? {
            kind: customKind,
            value:
              customKind === 'amount' ? Math.round(Number(customValue) * 100) : Number(customValue),
          }
        : undefined,
    );
  } catch (e) {
    cartError = (e as Error).message;
  }
  const selected = w.events.find((e) => e.id === eventId),
    eventSales = w.sales.filter((s) => s.eventId === eventId),
    sales = selected ? salesForDay(eventSales, selected, reportDay) : [],
    allLines = sales.flatMap((s) => s.lines),
    total = allLines.reduce((a, l) => a + l.price - l.discount, 0);
  const reportGroups = salesGroups(w, allLines);
  const dayOptions = selected
      ? conventionDays(selected).map((id, n) => ({ id, name: `Day ${n + 1} · ${id}` }))
      : [],
    daily = selected ? dailySummary(eventSales, selected) : [];
  const reportDayOptions = [
    ...dayOptions,
    ...(daily.some((d) => d.day === 'unassigned')
      ? [{ id: 'unassigned', name: 'Outside dates / unassigned' }]
      : []),
  ];
  const toggle = (t: string) =>
    setTargets((old) => (old.includes(t) ? old.filter((x) => x !== t) : [...old, t]));
  function moveTo(poolId: string, unitId = selectedUnit) {
    if (!unitId || !w) return;
    const workspace = w;
    try {
      setUnits(assignUnit(workspace, units, pools, unitId, poolId));
      setSelectedUnit('');
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function reportHeader(root: string, column: string, label: string) {
    const current = reportSort[root] || { column: 'weighted', direction: -1 };
    return (
      <TableHead
        key={column}
        aria-sort={
          current.column === column
            ? current.direction === 1
              ? 'ascending'
              : 'descending'
            : 'none'
        }
      >
        <Button
          variant="ghost"
          onClick={() =>
            setReportSort((old) => ({
              ...old,
              [root]: { column, direction: current.column === column ? -current.direction : 1 },
            }))
          }
        >
          {label} {current.column === column ? (current.direction === 1 ? '↑' : '↓') : '↕'}
        </Button>
      </TableHead>
    );
  }
  const visibleItems = sortedItems(
    w,
    w.items.filter((i) =>
      (
        i.name +
        ' ' +
        (i.fandom || '') +
        ' ' +
        path(w, i.categoryId)
          .map((c) => c.name)
          .join(' ')
      )
        .toLowerCase()
        .includes(query.toLowerCase()),
    ),
    sort.column,
    sort.direction,
  );
  return (
    <main>
      <header>
        <div className="brand">
          <span className="mark">
            <Layers size={21} />
          </span>
          <div>
            <strong>BoothBook</strong>
            <span>ARTIST ALLEY WORKSPACE</span>
          </div>
        </div>
        <div className="account-actions">
          <ThemeToggle />
          <WorkspaceBackup
            local={artist?.provider === 'local'}
            version={version}
            busy={busy}
            onBusy={setBusy}
            onError={setError}
            onRestored={async () => {
              setUnits([]);
              setPools([]);
              setCustomValue('');
              setDashboardOpen(false);
              await load();
              setNotice('Backup restored to this computer. Hosted data is unchanged.');
            }}
          />
          <a href="/account" className="account-link">
            {artist?.displayName || 'Your account'}
          </a>
          <span className="saved">
            <Check size={15} />
            {busy ? 'Working…' : artist?.provider === 'local' ? 'Saved locally' : 'Saved workspace'}
          </span>
        </div>
      </header>
      {artist && artist.provider !== 'local' && (
        <OfflineStatus
          artistId={artist.id}
          busy={busy}
          onSynced={() => {
            reportCache.current.clear();
            void load(true);
          }}
        />
      )}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="navrow">
          <TabsList className="nav">
            <TabsTrigger value="catalog">
              <BookOpen />
              Catalog
            </TabsTrigger>
            <TabsTrigger value="checkout">
              <ShoppingBag />
              Checkout{units.length > 0 && <span className="count">{units.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="deals">
              <Tag />
              Deals
            </TabsTrigger>
            <TabsTrigger value="conventions">
              <CalendarDays />
              Conventions
            </TabsTrigger>
            <TabsTrigger value="finance">
              <Wallet />
              Earnings &amp; Expenses
            </TabsTrigger>
            <TabsTrigger value="art-schedule">
              <CalendarDays />
              Art Schedule
            </TabsTrigger>
          </TabsList>
          <span className="navnote">Your table, organized.</span>
        </div>
        {error && (
          <div className="alert" role="alert">
            {error}{' '}
            <a href="/account" target="_blank" rel="noopener noreferrer">
              Open Account
            </a>{' '}
            <Button variant="outline" onClick={() => load()}>
              Reload saved data
            </Button>
          </div>
        )}
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
        <TabsContent value="finance">
          <FinancePanel
            w={w}
            version={version}
            busy={busy}
            onVersion={setVersion}
            onRefresh={() => load(true)}
          />
        </TabsContent>
        <TabsContent value="art-schedule">
          <ArtSchedule workspace={w} busy={busy} onSave={persist} />
        </TabsContent>
        <TabsContent value="catalog">
          <div className="heading">
            <div>
              <p className="eyebrow">01 / YOUR COLLECTION</p>
              <h1>Catalog</h1>
              <p>One price per lowest-level category. Individual designs stay easy to find.</p>
            </div>
            <div className="metric">
              <b>{w.items.length}</b>
              <span>catalog items</span>
            </div>
          </div>
          <div className="catalog-layout">
            <section className="panel">
              <div className="panel-title">
                <h2>Categories</h2>
                <span>{w.categories.length}</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {catalogCategories.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div
                          style={{ paddingLeft: `${Math.max(0, path(w, c.id).length - 1) * 16}px` }}
                          className={c.parentId ? 'child' : 'parent'}
                        >
                          <Input
                            aria-label={`Rename category ${c.name}`}
                            defaultValue={c.name}
                            key={c.id + c.name}
                            disabled={busy}
                            onBlur={(e) => {
                              const name = e.target.value.trim();
                              if (name && name !== c.name)
                                patch({
                                  ...w,
                                  categories: w.categories.map((x) =>
                                    x.id === c.id ? { ...x, name } : x,
                                  ),
                                });
                              else e.target.value = c.name;
                            }}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        {leaves.some((l) => l.id === c.id) ? (
                          <Input
                            aria-label={`Price for ${c.name}`}
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={c.price === null ? '' : c.price / 100}
                            key={c.id + '-' + c.price}
                            onBlur={(e) => {
                              const p =
                                e.target.value === ''
                                  ? null
                                  : Math.round(Number(e.target.value) * 100);
                              if (p !== c.price)
                                patch({
                                  ...w,
                                  categories: w.categories.map((x) =>
                                    x.id === c.id ? { ...x, price: p } : x,
                                  ),
                                });
                            }}
                          />
                        ) : (
                          <span className="muted">Set by subcategory</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          disabled={busy}
                          aria-label={`Delete category ${c.name}`}
                          onClick={() => setDeletion({ kind: 'category', id: c.id, name: c.name })}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <form
                className="stack inset"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await persist({
                      ...w,
                      categories: [
                        ...w.categories,
                        {
                          id: uid(),
                          name: catName,
                          parentId: parent || null,
                          price: catPrice === '' ? null : Math.round(Number(catPrice) * 100),
                        },
                      ],
                    })
                  ) {
                    setCatName('');
                    setCatPrice('');
                    setParent('');
                  }
                }}
              >
                <h3>Add category or subcategory</h3>
                <Input
                  required
                  placeholder="e.g. Multi-layer standees"
                  aria-label="New category name"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                />
                <Pick
                  label="No parent (top-level)"
                  value={parent}
                  onChange={setParent}
                  options={categoryOptions.filter(
                    (c) =>
                      w.categories.find((x) => x.id === c.id)?.parentId === null &&
                      !w.items.some((i) => i.categoryId === c.id),
                  )}
                />
                <p className="muted">
                  Parent: {categoryOptions.find((c) => c.id === parent)?.name || 'None (top-level)'}
                </p>
                <div className="inline">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Price (optional)"
                    aria-label="New category price"
                    value={catPrice}
                    onChange={(e) => setCatPrice(e.target.value)}
                  />
                  <Button disabled={busy}>
                    <Plus size={16} />
                    Add
                  </Button>
                </div>
              </form>
            </section>
            <section className="panel">
              <div className="panel-title">
                <h2>Individual items</h2>
                <Input
                  aria-label="Find catalog items"
                  placeholder="Find a design, fandom, or category…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="catalog-group-tools">
                <span>Browse by category</span>
                <div className="catalog-view-toggle" role="group" aria-label="Catalog view">
                  <Button
                    variant={catalogView === 'grid' ? 'default' : 'ghost'}
                    aria-pressed={catalogView === 'grid'}
                    onClick={() => setCatalogView('grid')}
                  >
                    <LayoutGrid size={16} />
                    Grid
                  </Button>
                  <Button
                    variant={catalogView === 'table' ? 'default' : 'ghost'}
                    aria-pressed={catalogView === 'table'}
                    onClick={() => setCatalogView('table')}
                  >
                    <List size={16} />
                    Table
                  </Button>
                </div>
                <div>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setExpandedCategories(
                        Object.fromEntries(catalogGroups(w, visibleItems).map((g) => [g.id, true])),
                      )
                    }
                  >
                    Expand all
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setExpandedCategories(
                        Object.fromEntries(
                          catalogGroups(w, visibleItems).map((g) => [g.id, false]),
                        ),
                      )
                    }
                  >
                    Collapse all
                  </Button>
                </div>
              </div>
              {catalogView === 'grid' && (
                <p className="catalog-grid-sort">Fandom · A–Z, then item name · A–Z</p>
              )}
              {catalogGroups(w, visibleItems).map((group) => {
                const expanded =
                  expandedCategories[group.id] ?? (catalogView === 'grid' || !!query.trim());
                return (
                  <section className="catalog-item-group" key={group.id}>
                    <button
                      type="button"
                      className="catalog-group-toggle"
                      aria-expanded={expanded}
                      aria-controls={'catalog-group-' + group.id}
                      onClick={() =>
                        setExpandedCategories((old) => ({ ...old, [group.id]: !expanded }))
                      }
                    >
                      <ChevronDown size={18} className={expanded ? 'expanded' : ''} />
                      <strong>{group.name}</strong>
                      {catalogView === 'grid' && leaves.some((c) => c.id === group.id) && (
                        <small className="catalog-group-price">
                          {w.categories.find((c) => c.id === group.id)?.price == null
                            ? 'Set price'
                            : money(w.categories.find((c) => c.id === group.id)!.price!)}
                        </small>
                      )}
                      <span>
                        {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                      </span>
                    </button>
                    {expanded && (
                      <div id={'catalog-group-' + group.id}>
                        {catalogView === 'grid' ? (
                          <CategoryItemGrid
                            w={w}
                            rootId={group.id}
                            items={group.items}
                            colors={fandomColors}
                            disabled={() => busy}
                            ariaLabel={(item) => 'Edit ' + item.name}
                            onSelect={(item) => {
                              setError('');
                              setEditingItem({ ...item });
                            }}
                          />
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {(['name', 'fandom', 'category', 'price'] as const).map(
                                  (column) => (
                                    <TableHead
                                      key={column}
                                      aria-sort={
                                        sort.column === column
                                          ? sort.direction === 1
                                            ? 'ascending'
                                            : 'descending'
                                          : 'none'
                                      }
                                    >
                                      <Button
                                        variant="ghost"
                                        onClick={() =>
                                          setSort({
                                            column,
                                            direction: sort.column === column ? -sort.direction : 1,
                                          })
                                        }
                                      >
                                        {column === 'name'
                                          ? 'Design / item'
                                          : column === 'category'
                                            ? 'Category'
                                            : column === 'fandom'
                                              ? 'Fandom'
                                              : 'Price'}{' '}
                                        {sort.column === column
                                          ? sort.direction === 1
                                            ? '↑'
                                            : '↓'
                                          : '↕'}
                                      </Button>
                                    </TableHead>
                                  ),
                                )}
                                <TableHead>Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.items.map((i) => (
                                <TableRow key={i.id}>
                                  <TableCell>
                                    <Input
                                      aria-label={`Rename item ${i.name}`}
                                      defaultValue={i.name}
                                      key={i.id + i.name}
                                      disabled={busy}
                                      onBlur={(e) => {
                                        const name = e.target.value.trim();
                                        if (name && name !== i.name)
                                          patch({
                                            ...w,
                                            items: w.items.map((x) =>
                                              x.id === i.id ? { ...x, name } : x,
                                            ),
                                          });
                                        else e.target.value = i.name;
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <div className="fandom-editor">
                                      <FandomBadge name={i.fandom || ''} colors={fandomColors} />
                                      <Input
                                        aria-label={`Fandom for ${i.name}`}
                                        placeholder="N/A"
                                        defaultValue={i.fandom || ''}
                                        key={i.id + '-' + (i.fandom || '')}
                                        disabled={busy}
                                        onBlur={(e) => {
                                          const fandom = e.target.value.trim();
                                          if (fandom !== (i.fandom || ''))
                                            patch({
                                              ...w,
                                              items: w.items.map((x) =>
                                                x.id === i.id ? { ...x, fandom } : x,
                                              ),
                                            });
                                        }}
                                      />
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Pick
                                      label="N/A"
                                      value={i.categoryId || ''}
                                      onChange={(v) =>
                                        patch({
                                          ...w,
                                          items: w.items.map((x) =>
                                            x.id === i.id ? { ...x, categoryId: v || null } : x,
                                          ),
                                        })
                                      }
                                      options={categoryOptions.filter((c) =>
                                        leaves.some((l) => l.id === c.id),
                                      )}
                                    />
                                  </TableCell>
                                  <TableCell className="number">
                                    {!i.categoryId
                                      ? '—'
                                      : w.categories.find((c) => c.id === i.categoryId)?.price ===
                                          null
                                        ? 'Set price'
                                        : money(
                                            w.categories.find((c) => c.id === i.categoryId)
                                              ?.price || 0,
                                          )}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      disabled={busy}
                                      aria-label={`Delete item ${i.name}`}
                                      onClick={() =>
                                        setDeletion({ kind: 'item', id: i.id, name: i.name })
                                      }
                                    >
                                      <Trash2 size={16} />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    )}
                  </section>
                );
              })}
              {!visibleItems.length && (
                <p className="inset muted">No items yet. Add your first design below.</p>
              )}
              <form
                className="inset item-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await persist({
                    ...w,
                    items: [
                      ...w.items,
                      { id: uid(), name: itemName, categoryId: itemCat, fandom: itemFandom.trim() },
                    ],
                  });
                }}
              >
                <Input
                  required
                  aria-label="New item name"
                  placeholder="Design / item name"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                />
                <Input
                  aria-label="New item fandom"
                  placeholder="Fandom (optional)"
                  value={itemFandom}
                  onChange={(e) => setItemFandom(e.target.value)}
                />
                <Pick
                  label="Choose category"
                  value={itemCat}
                  onChange={setItemCat}
                  options={categoryOptions.filter((c) => leaves.some((l) => l.id === c.id))}
                />
                <Button disabled={busy || !itemCat}>
                  <Plus size={16} />
                  Add item
                </Button>
              </form>
            </section>
          </div>
        </TabsContent>
        <TabsContent value="checkout">
          <div className="heading">
            <div>
              <p className="eyebrow">02 / AT THE TABLE</p>
              <h1>Checkout</h1>
              <p>Build the basket, arrange deal pools, then log the paid sale.</p>
            </div>
            <div className="convention-controls">
              <Pick
                label="All years"
                value={year}
                options={years}
                onChange={(v) => {
                  setYear(v);
                  const matching = eventsForYear(w.events, v).filter((e) => e.status === 'accepted');
                  if (!matching.some((e) => e.id === eventId)) setEvent(matching[0]?.id || '');
                }}
              />
              <Pick
                label="Select accepted convention"
                value={eventId}
                onChange={setEvent}
                options={accepted}
              />
              {selected && (
                <label>
                  Sale day
                  <Pick
                    label="Choose sale day"
                    value={saleDate}
                    onChange={setSaleDate}
                    options={dayOptions}
                  />
                </label>
              )}
            </div>
          </div>
          <div className="checkout-layout">
            <section className="panel">
              <div className="panel-title">
                <h2>Add items</h2>
                <Input
                  placeholder="Find a design, fandom, or category…"
                  aria-label="Find checkout items"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="checkout-groups">
                {catalogGroups(w, visibleItems).map((group) => {
                  const root = w.categories.find((c) => c.id === group.id);
                  return (
                    <section key={group.id}>
                      <h3>
                        {group.name}
                        {root && leaves.some((c) => c.id === root.id) && (
                          <span className="category-price">
                            {root.price === null ? 'Set price' : money(root.price)}
                          </span>
                        )}
                      </h3>
                      <CategoryItemGrid
                        w={w}
                        rootId={group.id}
                        items={group.items}
                        colors={fandomColors}
                        disabled={(item) => {
                          const category = w.categories.find((c) => c.id === item.categoryId);
                          return !category || category.price === null;
                        }}
                        ariaLabel={(item) => 'Add ' + item.name + ' to basket'}
                        onSelect={(item) =>
                          setUnits((old) => [...old, { id: uid(), itemId: item.id, poolId: '' }])
                        }
                      />
                    </section>
                  );
                })}
                {!visibleItems.length && <p className="muted">No matching items.</p>}
              </div>
            </section>
            <section className="panel basket">
              <div className="panel-title">
                <h2>Basket</h2>
                <span>{units.length} physical items</span>
              </div>
              <div className="inset pool-tools">
                <h3>Add a deal box</h3>
                <div className="deal-buttons">
                  {w.deals
                    .filter((d) => d.categoryIds.length)
                    .map((d) => (
                      <Button
                        variant="outline"
                        key={d.id}
                        onClick={() => {
                          const pool = { id: uid(), dealId: d.id };
                          setPools((old) => [...old, pool]);
                        }}
                      >
                        <Plus size={14} />
                        {d.name}
                      </Button>
                    ))}
                </div>
                <p className="muted">
                  Drag a basket item into a deal box, or select an item and click Move here.
                </p>
              </div>
              <div className="deal-board">
                {[
                  { id: '', name: 'Full price · No deal' },
                  ...pools.map((p, n) => ({
                    id: p.id,
                    name: `Box ${n + 1} · ${w.deals.find((d) => d.id === p.dealId)?.name || 'Deal'}`,
                  })),
                ].map((group) => {
                  const candidate = units.find((u) => u.id === (draggedUnit || selectedUnit)),
                    item = w.items.find((i) => i.id === candidate?.itemId),
                    deal = w.deals.find(
                      (d) => d.id === pools.find((p) => p.id === group.id)?.dealId,
                    ),
                    allowed = !group.id || (!!item && !!deal && eligible(w, item, deal));
                  return (
                    <section
                      key={group.id}
                      className={`deal-box ${candidate ? (allowed ? 'drop-allowed' : 'drop-blocked') : ''}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        moveTo(
                          group.id,
                          e.dataTransfer.getData('text/boothbook-unit') ||
                            e.dataTransfer.getData('text/plain') ||
                            draggedUnit,
                        );
                        setDraggedUnit('');
                      }}
                    >
                      <div className="deal-box-heading">
                        <h3>
                          {group.name}
                          <small>
                            {units.filter((u) => u.poolId === group.id).length} items
                            {group.id &&
                              ` · ${money(calc.lines.filter((l) => l.poolId === group.id).reduce((sum, l) => sum + l.discount, 0))} saved`}
                          </small>
                        </h3>
                        {group.id && (
                          <Button
                            variant="ghost"
                            aria-label={`Remove ${group.name}`}
                            onClick={() => {
                              setPools((old) => old.filter((p) => p.id !== group.id));
                              setUnits((old) =>
                                old.map((u) => (u.poolId === group.id ? { ...u, poolId: '' } : u)),
                              );
                            }}
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                      {deal && (
                        <p className="muted">
                          {deal.categoryIds
                            .map((id) => categoryOptions.find((c) => c.id === id)?.name)
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      )}
                      {selectedUnit && (
                        <Button
                          variant="outline"
                          disabled={!allowed || candidate?.poolId === group.id}
                          onClick={() => moveTo(group.id)}
                        >
                          Move here
                        </Button>
                      )}
                      <div className="basket-chips">
                        {units
                          .filter((u) => u.poolId === group.id)
                          .map((u) => {
                            const i = w.items.find((i) => i.id === u.itemId)!,
                              line = calc.lines.find((l) => l.id === u.id);
                            return (
                              <div
                                key={u.id}
                                className={`basket-chip ${selectedUnit === u.id ? 'selected' : ''}`}
                              >
                                <button
                                  type="button"
                                  draggable
                                  onDragStart={(e) => {
                                    setDraggedUnit(u.id);
                                    e.dataTransfer.setData('text/boothbook-unit', u.id);
                                    e.dataTransfer.setData('text/plain', u.id);
                                    e.dataTransfer.effectAllowed = 'move';
                                  }}
                                  onDragEnd={() => setDraggedUnit('')}
                                  aria-pressed={selectedUnit === u.id}
                                  onClick={() => setSelectedUnit(selectedUnit === u.id ? '' : u.id)}
                                >
                                  <strong>{i.name}</strong>
                                  <small>
                                    {w.categories.find((c) => c.id === i.categoryId)?.name} ·{' '}
                                    {line
                                      ? line.discount === line.price
                                        ? 'FREE'
                                        : money(line.price - line.discount)
                                      : '—'}
                                  </small>
                                </button>
                                <div className="chip-moves">
                                  {pools
                                    .filter(
                                      (p) =>
                                        p.id !== u.poolId &&
                                        w.deals.some((d) => d.id === p.dealId && eligible(w, i, d)),
                                    )
                                    .map((p) => (
                                      <Button
                                        key={p.id}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => moveTo(p.id, u.id)}
                                      >
                                        Move to {w.deals.find((d) => d.id === p.dealId)?.name}
                                      </Button>
                                    ))}
                                  {u.poolId && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => moveTo('', u.id)}
                                    >
                                      No deal
                                    </Button>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  aria-label={`Remove ${i.name}`}
                                  onClick={() => {
                                    setUnits((old) => old.filter((x) => x.id !== u.id));
                                    if (selectedUnit === u.id) setSelectedUnit('');
                                  }}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            );
                          })}
                      </div>
                      {!units.some((u) => u.poolId === group.id) && (
                        <p className="drop-hint">
                          {group.id ? 'Drop eligible items here' : 'Add items from your catalog'}
                        </p>
                      )}
                    </section>
                  );
                })}
              </div>
              <div className="inset totals">
                {pools.map((p, n) => {
                  const qty = units.filter((u) => u.poolId === p.id).length;
                  return (
                    <p className="muted" key={p.id}>
                      Pool {n + 1}: {qty} items ·{' '}
                      {money(
                        calc.lines
                          .filter((l) => l.poolId === p.id)
                          .reduce((sum, l) => sum + l.discount, 0),
                      )}{' '}
                      saved
                    </p>
                  );
                })}
                <div>
                  <span>Before deals</span>
                  <b>{money(calc.gross)}</b>
                </div>
                <div>
                  <span>Deal savings</span>
                  <b className="green">−{money(calc.dealDiscount)}</b>
                </div>
                <div className="custom-discount">
                  <h3>Custom discount</h3>
                  <div className="deal-buttons">
                    <Button
                      variant={customKind === 'amount' ? 'default' : 'outline'}
                      onClick={() => setCustomKind('amount')}
                    >
                      $ off
                    </Button>
                    <Button
                      variant={customKind === 'percent' ? 'default' : 'outline'}
                      onClick={() => setCustomKind('percent')}
                    >
                      % off
                    </Button>
                    <Input
                      aria-label="Custom discount amount"
                      type="number"
                      min="0"
                      max={customKind === 'percent' ? 100 : 100000}
                      step="0.01"
                      placeholder="0"
                      value={customValue}
                      onChange={(e) => setCustomValue(e.target.value)}
                    />
                    <Button variant="ghost" onClick={() => setCustomValue('')}>
                      Clear
                    </Button>
                  </div>
                  <p className="muted">Applied after deals to the remaining basket subtotal.</p>
                </div>
                <div>
                  <span>Custom savings</span>
                  <b className="green">−{money(calc.manualDiscount)}</b>
                </div>
                <div className="grand">
                  <span>Subtotal</span>
                  <b>{money(calc.total)}</b>
                </div>
                <p className="muted">
                  Enter this subtotal in Square. Square calculates tax and processes payment. Record
                  here after payment succeeds.
                </p>
                <Input
                  placeholder="Square receipt reference (optional)"
                  aria-label="Square receipt reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
                {cartError && <p className="red">{cartError}</p>}
                <Button
                  className="record"
                  disabled={
                    busy ||
                    !units.length ||
                    !!cartError ||
                    !accepted.some((e) => e.id === eventId) ||
                    !dayOptions.some((d) => d.id === saleDate)
                  }
                  onClick={() => persist(undefined, true)}
                >
                  <Check size={17} />
                  Record paid sale
                </Button>
                {!accepted.length && (
                  <p className="red">Accept a convention before recording sales.</p>
                )}
              </div>
            </section>
          </div>
        </TabsContent>
        <TabsContent value="deals">
          <div className="heading">
            <div>
              <p className="eyebrow">03 / TABLE OFFERS</p>
              <h1>Deals</h1>
              <p>Choose eligible categories. Each basket item belongs to one pool.</p>
            </div>
          </div>
          <div className="deals-layout">
            <section className="panel">
              <div className="panel-title">
                <h2>Available deals</h2>
                <span>{w.deals.length}</span>
              </div>
              {w.deals.map((d) => (
                <div className="deal-card" key={d.id}>
                  <span className="deal-icon">
                    <Tag size={20} />
                  </span>
                  <div>
                    <Input
                      aria-label={`Rename deal ${d.name}`}
                      defaultValue={d.name}
                      key={d.id + d.name}
                      maxLength={160}
                      disabled={busy}
                      onBlur={(e) => {
                        const name = e.target.value.trim();
                        if (name && name !== d.name)
                          patch({
                            ...w,
                            deals: w.deals.map((x) => (x.id === d.id ? { ...x, name } : x)),
                          });
                        else e.target.value = d.name;
                      }}
                    />
                    <p>
                      {!d.kind || d.kind === 'free'
                        ? `Buy ${d.buy}, get ${d.free} free · Cheapest eligible items`
                        : `Buy ${d.buy}, get ${d.kind === 'amount' ? money(d.discountValue || 0) : `${d.discountValue}%`} off each group`}
                    </p>
                    <div className="chips">
                      {d.categoryIds.map((id) => (
                        <span key={id}>{categoryOptions.find((c) => c.id === id)?.name}</span>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    aria-label={`Delete deal ${d.name}`}
                    onClick={() => setDeletion({ kind: 'deal', id: d.id, name: d.name })}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </section>
            <form
              className="panel inset stack"
              onSubmit={async (e) => {
                e.preventDefault();
                const d: Deal = {
                  id: uid(),
                  name: dealName,
                  buy: Number(buy),
                  free: dealKind === 'free' ? Number(free) : 0,
                  kind: dealKind,
                  discountValue:
                    dealKind === 'amount'
                      ? Math.round(Number(discountValue) * 100)
                      : Number(discountValue),
                  categoryIds: targets.filter((t) => t.startsWith('c:')).map((t) => t.slice(2)),
                  itemIds: [],
                };
                if (await persist({ ...w, deals: [...w.deals, d] })) {
                  setDealName('');
                  setTargets([]);
                }
              }}
            >
              <h2>Create a deal</h2>
              <label>
                Deal name
                <Input
                  required
                  placeholder="e.g. Print bundle"
                  value={dealName}
                  onChange={(e) => setDealName(e.target.value)}
                />
              </label>
              <Pick
                label="Deal type"
                value={dealKind}
                onChange={(v) => {
                  if (v) setDealKind(v as typeof dealKind);
                }}
                options={[
                  { id: 'free', name: 'Buy X, get Y free' },
                  { id: 'amount', name: 'Buy X, get $ off' },
                  { id: 'percent', name: 'Buy X, get % off' },
                ]}
              />
              <div className="inline">
                <label>
                  Buy
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={buy}
                    onChange={(e) => setBuy(e.target.value)}
                  />
                </label>
                <label>
                  {dealKind === 'free'
                    ? 'Get free'
                    : dealKind === 'amount'
                      ? 'Discount ($)'
                      : 'Discount (%)'}
                  <Input
                    type="number"
                    min={dealKind === 'free' ? 1 : 0.01}
                    max={dealKind === 'amount' ? 100000 : 100}
                    step={dealKind === 'free' ? 1 : 0.01}
                    required
                    value={dealKind === 'free' ? free : discountValue}
                    onChange={(e) =>
                      dealKind === 'free'
                        ? setFree(e.target.value)
                        : setDiscountValue(e.target.value)
                    }
                  />
                </label>
              </div>
              <p className="muted">
                Discounts repeat for each complete group. In mixed-price pools, the cheapest items
                form groups first; leftovers stay full price.
              </p>
              <h3>Eligible categories</h3>
              <div className="target-list">
                {categoryOptions.map((c) => (
                  <label className="check-label" key={c.id}>
                    <Checkbox
                      checked={targets.includes('c:' + c.id)}
                      onCheckedChange={() => toggle('c:' + c.id)}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
              <Button disabled={busy || !targets.length}>
                <Plus size={16} />
                Create deal
              </Button>
            </form>
          </div>
        </TabsContent>
        <TabsContent value="conventions">
          <div className="heading">
            <div>
              <p className="eyebrow">04 / CONVENTION SEASON</p>
              <h1>Conventions</h1>
              <p>Track applications and open a sales sheet for each accepted event.</p>
            </div>
            <Pick
              label="All years"
              value={year}
              options={years}
              onChange={(v) => {
                setYear(v);
                const matching = eventsForYear(w.events, v).filter((e) => e.status === 'accepted');
                if (!matching.some((e) => e.id === eventId)) setEvent(matching[0]?.id || '');
              }}
            />
          </div>
          <section className="panel">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Convention</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Application</TableHead>
                  <TableHead>Sales sheet</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conventionEvents.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="strong">
                      <Input
                        className="convention-name-input"
                        aria-label={'Rename convention ' + e.name}
                        defaultValue={e.name}
                        key={e.id + e.name}
                        maxLength={160}
                        disabled={busy}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            event.currentTarget.blur();
                          }
                        }}
                        onBlur={async (event) => {
                          const input = event.currentTarget,
                            name = input.value.trim();
                          if (name && name !== e.name) {
                            if (
                              !(await persist({
                                ...w,
                                events: w.events.map((c) => (c.id === e.id ? { ...c, name } : c)),
                              }))
                            )
                              input.value = e.name;
                          } else input.value = e.name;
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {e.start} — {e.end}
                    </TableCell>
                    <TableCell>
                      <div className={`status-color status-${e.status}`}>
                        <Pick
                          label="Status"
                          value={e.status}
                          onChange={(v) => {
                            if (v)
                              patch({
                                ...w,
                                events: w.events.map((x) =>
                                  x.id === e.id ? { ...x, status: v as typeof e.status } : x,
                                ),
                              });
                          }}
                          options={['awaiting', 'rejected', 'waitlisted', 'accepted'].map((id) => ({
                            id,
                            name: id[0].toUpperCase() + id.slice(1),
                          }))}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      {e.status === 'accepted' ? (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEvent(e.id);
                            setDashboardOpen(true);
                            setTimeout(() => {
                              const report = document.getElementById('convention-dashboard');
                              report?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              report?.focus({ preventScroll: true });
                            }, 0);
                          }}
                        >
                          Open dashboard
                        </Button>
                      ) : (
                        <span className="muted">Available when accepted</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        disabled={busy}
                        aria-label={`Delete convention ${e.name}`}
                        onClick={() => setDeletion({ kind: 'convention', id: e.id, name: e.name })}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!conventionEvents.length && (
              <p className="inset muted">No conventions for this year.</p>
            )}
            <form
              className="inset event-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await persist({
                    ...w,
                    events: [
                      ...w.events,
                      { id: uid(), name: eventName, start, end, status: status as any },
                    ],
                  })
                )
                  setEventName('');
              }}
            >
              <label>
                Name
                <Input
                  required
                  placeholder="Convention name"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                />
              </label>
              <label>
                Start date
                <Input
                  type="date"
                  required
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label>
                End date
                <Input
                  type="date"
                  required
                  min={start}
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
              <label>
                Application
                <div className={`status-color status-${status}`}>
                  <Pick
                    label="Status"
                    value={status}
                    onChange={setStatus}
                    options={['awaiting', 'rejected', 'waitlisted', 'accepted'].map((id) => ({
                      id,
                      name: id[0].toUpperCase() + id.slice(1),
                    }))}
                  />
                </div>
              </label>
              <Button disabled={busy}>
                <Plus size={16} />
                Add event
              </Button>
            </form>
          </section>
          {dashboardOpen &&
            dashboardAccepted.some((e) => e.id === eventId) &&
            selected?.status === 'accepted' && (
              <section id="convention-dashboard" className="dashboard" tabIndex={-1}>
                <div className="heading">
                  <div>
                    <p className="eyebrow">CONVENTION SALES SHEET</p>
                    <h2>{selected.name}</h2>
                    <p>
                      {reportDay
                        ? reportDay === 'unassigned'
                          ? 'Outside dates / unassigned'
                          : 'Sales for ' + reportDay
                        : 'All days summary'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={busy || reportLoading || exporting || reportEvent !== eventId}
                    onClick={exportDashboard}
                  >
                    {exporting ? 'Exporting…' : 'Export Excel'}
                  </Button>
                  <Button variant="outline" onClick={() => setDashboardOpen(false)}>
                    Close dashboard
                  </Button>
                  <div className="convention-controls">
                    <Pick
                      label="Select accepted convention"
                      value={eventId}
                      onChange={setEvent}
                      options={dashboardAccepted}
                    />
                    <Pick
                      label="All days"
                      value={reportDay}
                      onChange={setReportDay}
                      options={reportDayOptions}
                    />
                  </div>
                </div>
                {(reportLoading || reportEvent !== eventId) && (
                  <p role="status">Loading convention sales…</p>
                )}
                {!reportLoading && reportEvent === eventId && (
                  <>
                    <div className="stats">
                      <div>
                        <span>Revenue before tax</span>
                        <b>{money(total)}</b>
                      </div>
                      <div>
                        <span>Physical items sold</span>
                        <b>{allLines.length}</b>
                      </div>
                      <div>
                        <span>Paid transactions</span>
                        <b>{sales.length}</b>
                      </div>
                      <div>
                        <span>Deal discounts</span>
                        <b>{money(allLines.reduce((a, l) => a + l.discount, 0))}</b>
                      </div>
                    </div>
                    {!reportDay && (
                      <section className="panel sales-category">
                        <div className="panel-title">
                          <h2>Daily summary</h2>
                          <span>Select a day to open its dashboard</span>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead scope="col">#</TableHead>
                              {(
                                [
                                  { column: 'day', label: 'Sale day' },
                                  { column: 'transactions', label: 'Transactions' },
                                  { column: 'units', label: 'Items sold' },
                                  { column: 'total', label: 'Revenue before tax' },
                                  { column: 'discount', label: 'Discounts' },
                                  { column: 'weighted', label: 'Weighted sales' },
                                ] as const
                              ).map(({ column, label }) => (
                                <TableHead
                                  key={column}
                                  aria-sort={
                                    dailySort.column === column
                                      ? dailySort.direction === 1
                                        ? 'ascending'
                                        : 'descending'
                                      : 'none'
                                  }
                                >
                                  <Button
                                    variant="ghost"
                                    onClick={() =>
                                      setDailySort({
                                        column,
                                        direction:
                                          dailySort.column === column ? -dailySort.direction : 1,
                                      })
                                    }
                                  >
                                    {label}{' '}
                                    {dailySort.column === column
                                      ? dailySort.direction === 1
                                        ? '↑'
                                        : '↓'
                                      : '↕'}
                                  </Button>
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {daily
                              .slice()
                              .sort(
                                (a, b) =>
                                  dailySort.direction *
                                    (dailySort.column === 'day'
                                      ? a.day.localeCompare(b.day)
                                      : Number(a[dailySort.column]) -
                                        Number(b[dailySort.column])) || a.day.localeCompare(b.day),
                              )
                              .map((day, index) => (
                                <TableRow key={day.day}>
                                  <TableCell className="number">{index + 1}</TableCell>
                                  <TableCell>
                                    <Button variant="ghost" onClick={() => setReportDay(day.day)}>
                                      {day.day === 'unassigned'
                                        ? 'Outside dates / unassigned'
                                        : dayOptions.find((d) => d.id === day.day)?.name || day.day}
                                    </Button>
                                  </TableCell>
                                  <TableCell className="number">{day.transactions}</TableCell>
                                  <TableCell className="number">{day.units}</TableCell>
                                  <TableCell className="number">{money(day.total)}</TableCell>
                                  <TableCell className="number">{money(day.discount)}</TableCell>
                                  <TableCell className="number">
                                    {day.weighted.toLocaleString(undefined, {
                                      maximumFractionDigits: 3,
                                    })}
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </section>
                    )}
                    {reportGroups.map((group) => (
                      <section className="panel sales-category" key={group.root}>
                        <div className="panel-title">
                          <h2>{group.root}</h2>
                          <span>$10 original value = 1 point · Free items included</span>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead scope="col">#</TableHead>
                              {reportHeader(group.root, 'name', 'Design / item')}
                              {reportHeader(group.root, 'fandom', 'Fandom')}
                              {group.columns.map((category) =>
                                reportHeader(
                                  group.root,
                                  category,
                                  category.split(' / ').slice(1).join(' / ') || 'Units',
                                ),
                              )}
                              {reportHeader(group.root, 'units', 'Total units')}
                              {reportHeader(group.root, 'weighted', 'Weighted sales')}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortSalesNames(
                              group,
                              reportSort[group.root]?.column || 'weighted',
                              reportSort[group.root]?.direction || -1,
                            ).map((name, index) => {
                              const lines = group.lines.filter((l) => l.name === name);
                              return (
                                <TableRow key={name}>
                                  <TableCell className="number">{index + 1}</TableCell>
                                  <TableCell>{name}</TableCell>
                                  <TableCell>
                                    <div className="fandom-badges">
                                      {Array.from(
                                        new Set(
                                          (lines.length
                                            ? lines.map(
                                                (l) =>
                                                  l.fandom ??
                                                  w.items.find((i) => i.id === l.itemId)?.fandom ??
                                                  '',
                                              )
                                            : w.items
                                                .filter(
                                                  (i) =>
                                                    i.name === name &&
                                                    path(w, i.categoryId)[0]?.name === group.root,
                                                )
                                                .map((i) => i.fandom || '')
                                          ).map((v) => v || 'N/A'),
                                        ),
                                      ).map((fandom) => (
                                        <FandomBadge
                                          key={fandom}
                                          name={fandom}
                                          colors={fandomColors}
                                        />
                                      ))}
                                    </div>
                                  </TableCell>
                                  {group.columns.map((category) => (
                                    <TableCell className="number" key={category}>
                                      {lines.filter((l) => l.category === category).length || '—'}
                                    </TableCell>
                                  ))}
                                  <TableCell className="number">{lines.length}</TableCell>
                                  <TableCell className="number">
                                    {weightedSales(lines).toLocaleString(undefined, {
                                      maximumFractionDigits: 3,
                                    })}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            <TableRow className="total-row">
                              <TableCell />
                              <TableCell>Total</TableCell>
                              <TableCell>—</TableCell>
                              {group.columns.map((category) => (
                                <TableCell className="number" key={category}>
                                  {group.lines.filter((l) => l.category === category).length}
                                </TableCell>
                              ))}
                              <TableCell className="number">{group.lines.length}</TableCell>
                              <TableCell className="number">
                                {weightedSales(group.lines).toLocaleString(undefined, {
                                  maximumFractionDigits: 3,
                                })}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </section>
                    ))}
                    <section className="panel transactions">
                      <div className="panel-title">
                        <h2>Transaction log</h2>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead scope="col">#</TableHead>
                            {[
                              { column: 'saleDate', label: 'Sale day' },
                              { column: 'date', label: 'Recorded' },
                              { column: 'items', label: 'Purchased items' },
                              { column: 'deals', label: 'Deals' },
                              { column: 'reference', label: 'Reference' },
                              { column: 'subtotal', label: 'Subtotal' },
                            ].map(({ column, label }) => (
                              <TableHead
                                key={column}
                                aria-sort={
                                  transactionSort.column === column
                                    ? transactionSort.direction === 1
                                      ? 'ascending'
                                      : 'descending'
                                    : 'none'
                                }
                              >
                                <Button
                                  variant="ghost"
                                  onClick={() =>
                                    setTransactionSort({
                                      column,
                                      direction:
                                        transactionSort.column === column
                                          ? -transactionSort.direction
                                          : 1,
                                    })
                                  }
                                >
                                  {label}{' '}
                                  {transactionSort.column === column
                                    ? transactionSort.direction === 1
                                      ? '↑'
                                      : '↓'
                                    : '↕'}
                                </Button>
                              </TableHead>
                            ))}
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedSales(
                            sales,
                            transactionSort.column,
                            transactionSort.direction,
                            w,
                          ).map((s) => (
                            <TableRow key={s.id}>
                              <TableCell className="number">{sales.findIndex((sale) => sale.id === s.id) + 1}</TableCell>
                              <TableCell>
                                {saleDay(s, selected) || 'Outside dates / unassigned'}
                              </TableCell>
                              <TableCell>{new Date(s.date).toLocaleString()}</TableCell>
                              <TableCell>
                                <ul className="purchased-items">
                                  {purchasedItems(s, w).map((item, n) => (
                                    <li key={n}>
                                      {item.quantity} × {item.name}
                                      <small>{item.category}</small>
                                    </li>
                                  ))}
                                </ul>
                              </TableCell>
                              <TableCell>
                                {Array.from(
                                  new Set(s.lines.map((l) => l.deal).filter(Boolean)),
                                ).join(', ') || '—'}
                              </TableCell>
                              <TableCell>{s.reference || '—'}</TableCell>
                              <TableCell className="number">
                                {money(s.lines.reduce((a, l) => a + l.price - l.discount, 0))}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  disabled={busy}
                                  aria-label={`Delete sale from ${new Date(s.date).toLocaleString()}`}
                                  onClick={() =>
                                    setDeletion({ kind: 'sale', id: s.id, name: 'this sale' })
                                  }
                                >
                                  <Trash2 size={16} />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {!sales.length && (
                        <p className="inset muted">
                          No sales for {reportDay ? 'this day' : 'this convention'} yet. Record a
                          paid basket in Checkout.
                        </p>
                      )}
                    </section>
                  </>
                )}
              </section>
            )}
        </TabsContent>
      </Tabs>
      <Dialog
        open={!!editingItem}
        onOpenChange={(open) => {
          if (!open && !busy) setEditingItem(null);
        }}
      >
        <DialogContent className="catalog-item-editor" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>Edit catalog item</DialogTitle>
            <DialogDescription>Update the design name, fandom, or category.</DialogDescription>
          </DialogHeader>
          {editingItem && (
            <form
              className="stack"
              onSubmit={async (event) => {
                event.preventDefault();
                const name = editingItem.name.trim();
                if (!name) {
                  setError('Enter an item name.');
                  return;
                }
                if (!w.items.some((item) => item.id === editingItem.id)) {
                  setError('This item was removed. Close the editor and reload.');
                  return;
                }
                if (
                  await persist({
                    ...w,
                    items: w.items.map((item) =>
                      item.id === editingItem.id
                        ? { ...editingItem, name, fandom: editingItem.fandom?.trim() || '' }
                        : item,
                    ),
                  })
                )
                  setEditingItem(null);
              }}
            >
              <label>
                Design / item name
                <Input
                  required
                  maxLength={160}
                  disabled={busy}
                  value={editingItem.name}
                  onChange={(event) => setEditingItem({ ...editingItem, name: event.target.value })}
                />
              </label>
              <label>
                Fandom
                <Input
                  maxLength={160}
                  disabled={busy}
                  value={editingItem.fandom || ''}
                  onChange={(event) =>
                    setEditingItem({ ...editingItem, fandom: event.target.value })
                  }
                />
              </label>
              <label>
                Category
                <Pick
                  label="N/A"
                  value={editingItem.categoryId || ''}
                  options={categoryOptions.filter((c) => leaves.some((l) => l.id === c.id))}
                  onChange={(id) => setEditingItem({ ...editingItem, categoryId: id || null })}
                />
              </label>
              {editingItem.categoryId && (
                <p className="muted">
                  Category price:{' '}
                  {w.categories.find((c) => c.id === editingItem.categoryId)?.price == null
                    ? 'Set price'
                    : money(w.categories.find((c) => c.id === editingItem.categoryId)!.price!)}
                </p>
              )}
              {error && (
                <p className="red" role="alert">
                  {error}
                </p>
              )}
              <div className="catalog-editor-actions">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setDeletion({ kind: 'item', id: editingItem.id, name: editingItem.name });
                    setEditingItem(null);
                  }}
                >
                  <Trash2 size={16} />
                  Delete item
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setEditingItem(null)}
                >
                  Cancel
                </Button>
                <Button disabled={busy}>Save changes</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!deletion}
        onOpenChange={(open) => {
          if (!open) setDeletion(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deletion?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletion?.kind === 'convention'
                ? 'This permanently deletes the convention and every recorded sale under it, including all daily dashboards and transaction history. Export Excel or back up your workspace first if you want to keep a copy. Expense and manual-earning entries are retained in your financial history.'
                : deletion?.kind === 'deal'
                  ? 'This removes the deal and its open basket boxes. Items in those boxes return to No deal.'
                  : deletion?.kind === 'sale'
                    ? 'This deletes the recorded sale and removes its item quantities, revenue, and discounts from the convention dashboard. It does not refund the payment in Square.'
                    : deletion?.kind === 'category'
                      ? 'This removes the category and its subcategories. Their items stay in your catalog with N/A as category until reassigned.'
                      : 'This removes the item from your catalog.'}
              {deletion?.kind !== 'sale' &&
                deletion?.kind !== 'convention' &&
                ' Recorded sales keep their original details.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async (e) => {
                e.preventDefault();
                if (!deletion) return;
                if (deletion.kind === 'convention') {
                  if (await persist(undefined, false, undefined, deletion.id)) setDeletion(null);
                  return;
                }
                if (deletion.kind === 'deal') {
                  const result = removeDeal(w, pools, units, deletion.id);
                  if (await persist(result.workspace)) {
                    setPools(result.pools);
                    setUnits(result.units);
                    setDeletion(null);
                  }
                  return;
                }
                if (deletion.kind === 'sale') {
                  if (await persist(undefined, false, deletion.id)) setDeletion(null);
                  return;
                }
                const next =
                  deletion.kind === 'category'
                    ? removeCategory(w, deletion.id)
                    : removeItem(w, deletion.id);
                if (await persist(next)) {
                  setUnits(
                    units.filter(
                      (u) =>
                        next.items.some((i) => i.id === u.itemId) &&
                        next.items.find((i) => i.id === u.itemId)?.categoryId,
                    ),
                  );
                  setDeletion(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <footer>
        BoothBook{' '}
        <span>
          {artist?.provider === 'local'
            ? 'Offline · Saved on this computer'
            : 'Your private artist workspace'}
        </span>
      </footer>
    </main>
  );
}
