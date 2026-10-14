'use client';
import { useEffect, useState, useRef } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './ui/table';
import { workspaceResponse } from '../lib/api-response';
import { money, eventsForYear, type Workspace } from '../lib/model';
import {
  chronologicalEntries,
  type FinanceEntry,
  type financeSummary,
  type expenseConventionOptions,
  type earningsConventionOptions,
} from '../lib/finance';
type FinanceData = {
  version: number;
  entries: FinanceEntry[];
  expenseConventions: ReturnType<typeof expenseConventionOptions>;
  earningsConventions: ReturnType<typeof earningsConventionOptions>;
  years: string[];
  summary: ReturnType<typeof financeSummary>;
};
const labels: Record<string, string> = {
  convention: 'Con-specific',
  inventory: 'Inventory',
  setup: 'Table setup',
  commission: 'Commissions',
  creator: 'Creator programs',
};
const today = () => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
};
export function FinancePanel({
  w,
  version,
  busy,
  onVersion,
  onRefresh,
}: {
  w: Workspace;
  version: number;
  busy: boolean;
  onVersion: (v: number) => void;
  onRefresh: () => Promise<void>;
}) {
  const [year, setYear] = useState(''),
    [data, setData] = useState<FinanceData | null>(null),
    [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [form, setForm] = useState<{
    id: string;
    type: 'expense' | 'earning';
    category: FinanceEntry['category'];
    date: string;
    name: string;
    amount: string;
    eventId: string;
    conventionName: string;
    conventionStart: string;
    mode: 'total' | 'extra';
  }>({
    id: '',
    type: 'expense',
    category: 'convention',
    date: today(),
    name: '',
    amount: '',
    eventId: '',
    conventionName: '',
    conventionStart: today(),
    mode: 'total',
  });
  const requestId = useRef(0);
  const expenseConventions =
      data?.expenseConventions ||
      eventsForYear(w.events, '').filter((e) => e.status === 'accepted'),
    earningsConventions =
      data?.earningsConventions ||
      eventsForYear(w.events, '').filter((e) => e.status === 'accepted');
  const manualConvention =
    form.type === 'earning' &&
    form.category === 'convention' &&
    (form.eventId === '__manual' || form.eventId.startsWith('historical:'));
  async function load() {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const response = await fetch('/api/finance?year=' + year, { cache: 'no-store' });
      const result = (await workspaceResponse(response)) as FinanceData;
      if (id !== requestId.current) return;
      setData(result);
      setError('');
      if (result.version !== version) await onRefresh();
    } catch (e) {
      if (id === requestId.current) setError((e as Error).message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      requestId.current++;
    };
  }, [year, version]);
  const disabled = busy || saving || loading;
  async function save(entry?: FinanceEntry, remove = false) {
    if (!data) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const cents = Math.round(Number(form.amount) * 100);
      if (!remove && (!Number.isFinite(cents) || cents < 1))
        throw Error('Enter an amount greater than zero.');
      const value = entry || {
        id: form.id || crypto.randomUUID(),
        type: form.type,
        category: form.category,
        date: form.date,
        conventionEnd: manualConvention ? form.date : undefined,
        name:
          form.type === 'earning' && form.category === 'convention'
            ? form.mode === 'total'
              ? 'Convention total'
              : 'Additional earnings'
            : form.name,
        amount: cents,
        eventId:
          form.category === 'convention'
            ? form.eventId === '__manual'
              ? 'historical:' + crypto.randomUUID()
              : form.eventId
            : null,
        conventionName:
          form.category === 'convention' && form.type === 'earning'
            ? form.conventionName || undefined
            : undefined,
        conventionStart:
          form.category === 'convention' && form.type === 'earning'
            ? form.conventionStart
            : undefined,
        mode: form.type === 'earning' && form.category === 'convention' ? form.mode : undefined,
      };
      const response = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: data.version,
          action: remove ? 'delete' : 'save',
          ...(remove ? { id: value.id } : { entry: value }),
        }),
      });
      const result = (await workspaceResponse(response)) as {
        version: number;
      };
      onVersion(result.version);
      setNotice(remove ? 'Entry deleted. Totals updated.' : 'Entry saved. Totals updated.');
      if (!remove)
        setForm((old) => ({
          ...old,
          id: '',
          name: '',
          amount: '',
          eventId: value.category === 'convention' ? value.eventId || '' : old.eventId,
        }));
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function edit(entry: FinanceEntry) {
    setForm({
      id: entry.id,
      type: entry.type,
      category: entry.category,
      date:
        entry.type === 'earning' && entry.eventId?.startsWith('historical:')
          ? entry.conventionEnd || entry.date
          : entry.date,
      name: entry.name,
      amount: String(entry.amount / 100),
      eventId: entry.eventId || '',
      conventionName: entry.conventionName || '',
      conventionStart:
        w.events.find((c) => c.id === entry.eventId)?.start || entry.conventionStart || entry.date,
      mode: entry.mode || 'total',
    });
    document
      .getElementById('finance-entry-form')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function entriesTable(entries: FinanceEntry[], showCategory = false, compact = false) {
    return (
      <>
        <Table className={compact ? 'finance-compact-table' : undefined}>
          {compact && (
            <colgroup>
              <col className="expense-date-column" />
              <col />
              <col className="expense-amount-column" />
              <col className="expense-actions-column" />
            </colgroup>
          )}
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Name</TableHead>
              {showCategory && <TableHead>Category / convention</TableHead>}
              <TableHead>Amount</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chronologicalEntries(entries).map((e) => (
              <TableRow key={e.id}>
                <TableCell>{e.date}</TableCell>
                <TableCell>
                  {e.name}
                  {e.type === 'earning' && e.category === 'convention' && (
                    <small className="finance-note">
                      {e.mode === 'total'
                        ? 'Replaces recorded convention sales'
                        : 'Additional convention earnings'}
                    </small>
                  )}
                </TableCell>
                {showCategory && (
                  <TableCell>
                    {labels[e.category]}
                    {e.category === 'convention' &&
                      ' · ' +
                        (w.events.find((c) => c.id === e.eventId)?.name ||
                          e.conventionName ||
                          'Removed convention')}
                  </TableCell>
                )}
                <TableCell className="number">{money(e.amount)}</TableCell>
                <TableCell>
                  <div className="finance-actions">
                    <Button
                      variant="ghost"
                      size={compact ? 'icon-sm' : 'default'}
                      disabled={disabled}
                      aria-label={'Edit ' + e.name}
                      title={'Edit ' + e.name}
                      onClick={() => edit(e)}
                    >
                      {compact ? <Pencil /> : 'Edit'}
                    </Button>
                    <Button
                      variant="ghost"
                      size={compact ? 'icon-sm' : 'default'}
                      disabled={disabled}
                      aria-label={'Delete ' + e.name}
                      title={'Delete ' + e.name}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Delete ' + e.name + '? This removes it from financial totals.',
                          )
                        )
                          void save(e, true);
                      }}
                    >
                      {compact ? <Trash2 /> : 'Delete'}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="total-row">
              <TableCell colSpan={showCategory ? 3 : 2}>Total</TableCell>
              <TableCell className="number">
                {money(entries.reduce((n, e) => n + e.amount, 0))}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
        {!entries.length && <p className="inset muted">No entries for this period.</p>}
      </>
    );
  }
  const summary = data?.summary,
    expenseEntries = data?.entries.filter((e) => e.type === 'expense') || [];
  return (
    <div className="finance dashboard">
      <div className="heading">
        <div>
          <p className="eyebrow">BUSINESS OVERVIEW</p>
          <h1>Earnings &amp; Expenses</h1>
          <p>Convention earnings, other income, and business expenses in one place.</p>
        </div>
        <label>
          Year
          <select className="finance-select" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">All years</option>
            {[
              ...new Set([
                String(new Date().getFullYear()),
                year,
                ...(data?.years || []),
                ...w.events.map((e) => e.start.slice(0, 4)),
              ]),
            ]
              .filter(Boolean)
              .sort()
              .reverse()
              .map((y) => (
                <option key={y}>{y}</option>
              ))}
          </select>
        </label>
      </div>
      {error && (
        <div className="alert" role="alert">
          {error}
          <Button variant="outline" onClick={load}>
            Reload finances
          </Button>
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      {loading && <p role="status">Refreshing financial totals…</p>}
      {summary && (
        <div className="stats">
          <div>
            <span>Total earnings</span>
            <b>{money(summary.earningsTotal)}</b>
          </div>
          <div>
            <span>Total expenses</span>
            <b>{money(summary.expenseTotal)}</b>
          </div>
          <div>
            <span>Earnings minus expenses</span>
            <b className={summary.net < 0 ? 'red' : 'green'}>{money(summary.net)}</b>
          </div>
          <div>
            <span>Convention earnings</span>
            <b>{money(summary.conventionTotal)}</b>
          </div>
        </div>
      )}
      <form
        id="finance-entry-form"
        className="panel inset finance-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <h2>{form.id ? 'Edit entry' : 'Add expense or earnings'}</h2>
        <label>
          Entry type
          <select
            className="finance-select"
            value={form.type}
            onChange={(e) =>
              setForm((old) => ({
                ...old,
                type: e.target.value as 'expense' | 'earning',
                category: 'convention',
              }))
            }
          >
            <option value="expense">Expense</option>
            <option value="earning">Earnings</option>
          </select>
        </label>
        <label>
          Category
          <select
            className="finance-select"
            value={form.category}
            onChange={(e) =>
              setForm((old) => ({ ...old, category: e.target.value as FinanceEntry['category'] }))
            }
          >
            {(form.type === 'expense'
              ? ['convention', 'inventory', 'setup']
              : ['convention', 'commission', 'creator']
            ).map((c) => (
              <option value={c} key={c}>
                {labels[c]}
              </option>
            ))}
          </select>
        </label>
        {form.category === 'convention' && (
          <>
            <label>
              Convention
              <select
                className="finance-select"
                required
                value={form.eventId}
                onChange={(e) => {
                  const id = e.target.value,
                    event = w.events.find((c) => c.id === id),
                    historical = (
                      form.type === 'earning' ? earningsConventions : expenseConventions
                    ).find((c) => c.id === id);
                  setForm((old) => ({
                    ...old,
                    eventId: id,
                    conventionName: event?.name || historical?.name || '',
                    conventionStart: event?.start || historical?.start || old.date,
                    date:
                      form.type === 'earning' && id.startsWith('historical:') && historical?.end
                        ? historical.end
                        : old.date,
                  }));
                }}
              >
                <option value="">Select convention</option>
                {form.type === 'earning' && (
                  <option value="__manual">Enter a past convention…</option>
                )}
                {(form.type === 'earning' ? earningsConventions : expenseConventions).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
                {form.eventId &&
                  form.eventId !== '__manual' &&
                  !w.events.some((e) => e.id === form.eventId) &&
                  !expenseConventions.some((c) => c.id === form.eventId) && (
                    <option value={form.eventId}>
                      {form.conventionName || 'Previously linked convention'}
                    </option>
                  )}
              </select>
            </label>
            {form.type === 'earning' &&
              (form.eventId === '__manual' || form.eventId.startsWith('historical:')) && (
                <>
                  <label>
                    Convention name
                    <Input
                      required
                      maxLength={160}
                      value={form.conventionName}
                      onChange={(e) =>
                        setForm((old) => ({ ...old, conventionName: e.target.value }))
                      }
                      placeholder="e.g. Anime NYC 2025"
                    />
                  </label>
                  <label>
                    Convention start date
                    <Input
                      type="date"
                      required
                      value={form.conventionStart}
                      onChange={(e) =>
                        setForm((old) => ({ ...old, conventionStart: e.target.value }))
                      }
                    />
                  </label>
                </>
              )}
          </>
        )}
        <label>
          {manualConvention ? 'End date' : 'Date'}
          <Input
            type="date"
            required
            min={manualConvention ? form.conventionStart : undefined}
            value={form.date}
            onChange={(e) => setForm((old) => ({ ...old, date: e.target.value }))}
          />
        </label>
        {!(form.type === 'earning' && form.category === 'convention') && (
          <label>
            Name
            <Input
              required
              maxLength={160}
              value={form.name}
              placeholder={
                form.type === 'expense'
                  ? 'Hotel, table fee, print order…'
                  : 'Convention total, commission, creator payout…'
              }
              onChange={(e) => setForm((old) => ({ ...old, name: e.target.value }))}
            />
          </label>
        )}
        <label>
          Amount ($)
          <Input
            required
            type="number"
            min="0.01"
            max="1000000"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm((old) => ({ ...old, amount: e.target.value }))}
          />
        </label>
        {form.type === 'earning' && form.category === 'convention' && (
          <label>
            How to count earnings
            <select
              className="finance-select"
              value={form.mode}
              onChange={(e) =>
                setForm((old) => ({ ...old, mode: e.target.value as 'total' | 'extra' }))
              }
            >
              <option value="total">Use this convention total instead of recorded sales</option>
              <option value="extra">Add to recorded sales / manual total</option>
            </select>
            <small>
              Use one total for past conventions. Recorded sales remain in their dashboards but are
              not counted again.
            </small>
          </label>
        )}
        <div className="finance-actions">
          <Button disabled={disabled}>{form.id ? 'Save entry' : 'Add entry'}</Button>
          {form.id && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setForm((old) => ({ ...old, id: '', name: '', amount: '' }))}
            >
              Cancel edit
            </Button>
          )}
        </div>
      </form>
      {summary && (
        <>
          <section className="panel sales-category convention-earnings">
            <div className="panel-title">
              <h2>Convention earnings</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Convention</TableHead>
                  <TableHead>Sales</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.conventions.map((c) => (
                  <TableRow key={c.eventId}>
                    <TableCell>
                      <strong>{c.name}</strong>
                      <small className="finance-note convention-date-range">
                        <time dateTime={c.start}>{c.start}</time>
                        {c.end && (
                          <>
                            {' '}
                            — <time dateTime={c.end}>{c.end}</time>
                          </>
                        )}
                      </small>
                    </TableCell>
                    <TableCell className="number">{money(c.total)}</TableCell>
                    <TableCell>
                      {c.entries.map((entry) => (
                        <div className="finance-actions" key={entry.id}>
                          <Button
                            variant="ghost"
                            disabled={disabled}
                            aria-label={'Edit earnings for ' + c.name + ' on ' + entry.date}
                            title={'Edit ' + money(entry.amount) + ' on ' + entry.date}
                            onClick={() => edit(entry)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            disabled={disabled}
                            aria-label={'Delete earnings for ' + c.name + ' on ' + entry.date}
                            title={'Delete ' + money(entry.amount) + ' on ' + entry.date}
                            onClick={() => {
                              if (
                                window.confirm(
                                  'Delete ' +
                                    entry.name +
                                    '? This removes it from financial totals.',
                                )
                              )
                                void save(entry, true);
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="total-row">
                  <TableCell>Convention total</TableCell>
                  <TableCell className="number">{money(summary.conventionTotal)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
            {!summary.conventions.length && (
              <p className="inset muted">
                No convention earnings for this period. Add a past convention total above.
              </p>
            )}
          </section>
          <div className="finance-other-income-grid">
            <section className="panel sales-category">
              <div className="panel-title">
                <h2>Commissions</h2>
              </div>
              {entriesTable(summary.commissions)}
            </section>
            <section className="panel sales-category">
              <div className="panel-title">
                <h2>Creator programs</h2>
              </div>
              {entriesTable(summary.creatorPrograms)}
            </section>
          </div>
        </>
      )}
      {summary && (
        <>
          <section className="panel sales-category">
            <div className="panel-title">
              <h2>Expenses by category</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.expenseCategories.map((c) => (
                  <TableRow key={c.category}>
                    <TableCell>{labels[c.category]}</TableCell>
                    <TableCell className="number">{money(c.total)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="total-row">
                  <TableCell>All expenses</TableCell>
                  <TableCell className="number">{money(summary.expenseTotal)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </section>
          <section className="con-expenses-section">
            <div className="panel-title">
              <h2>Con-specific expenses</h2>
            </div>
            <div className="finance-expense-grid">
              {expenseConventions
                .filter(
                  (c) =>
                    !year ||
                    c.start.slice(0, 4) === year ||
                    expenseEntries.some((e) => e.eventId === c.id),
                )
                .map((c) => (
                  <section className="panel finance-expense-card" key={c.id}>
                    <div className="finance-subheading">
                      <h3>{c.name}</h3>
                      <span>
                        {c.start}
                        {c.end && ' — ' + c.end}
                      </span>
                    </div>
                    {entriesTable(
                      expenseEntries.filter(
                        (e) => e.category === 'convention' && e.eventId === c.id,
                      ),
                      false,
                      true,
                    )}
                  </section>
                ))}
            </div>
            {!expenseConventions.length && (
              <p className="inset muted">
                Accept a convention or enter a past convention’s earnings to add its expenses.
              </p>
            )}
          </section>
          {(['inventory', 'setup'] as const).map((category) => (
            <section className="panel sales-category" key={category}>
              <div className="panel-title">
                <h2>{labels[category]} expenses</h2>
              </div>
              {entriesTable(expenseEntries.filter((e) => e.category === category))}
            </section>
          ))}
        </>
      )}
      <p className="muted inset">
        Year filters use entry dates and recorded sale days. Manual totals replace the entire
        convention's recorded revenue. Earnings are before tax and payment-processing fees; enter
        fees as expenses if you want them included. Pending offline sales enter these totals after
        syncing. Previously linked manual entries remain included after a convention is removed or
        no longer accepted.
      </p>
    </div>
  );
}
