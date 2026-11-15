'use client';

import { useState } from 'react';
import type { Deal, Event } from '@/lib/model';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export function ConventionDateEditor({ event, busy, onSave, onClose }: {
  event: Event;
  busy: boolean;
  onSave: (event: Event) => Promise<boolean>;
  onClose: () => void;
}) {
  const [start, setStart] = useState(event.start);
  const [end, setEnd] = useState(event.end);
  const [failed, setFailed] = useState(false);
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit convention dates</DialogTitle>
          <DialogDescription>{event.name}</DialogDescription>
        </DialogHeader>
        <form className="stack" onSubmit={async (e) => {
          e.preventDefault();
          if (await onSave({ ...event, start, end })) onClose();
          else setFailed(true);
        }}>
          <label>Start date<Input type="date" required value={start} disabled={busy} onChange={(e) => setStart(e.target.value)} /></label>
          <label>End date<Input type="date" required min={start} value={end} disabled={busy} onChange={(e) => setEnd(e.target.value)} /></label>
          <p className="muted">Recorded sales keep their original sale dates.</p>
          {failed && <p role="alert" className="red">Dates could not be saved. Close this editor to review the error, then try again.</p>}
          <Button disabled={busy}>Save dates</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DealEditor({ deal, categories, busy, onSave, onClose }: {
  deal: Deal;
  categories: { id: string; name: string }[];
  busy: boolean;
  onSave: (deal: Deal) => Promise<boolean>;
  onClose: () => void;
}) {
  const [kind, setKind] = useState(deal.kind || 'free');
  const [targets, setTargets] = useState(deal.categoryIds);
  const [failed, setFailed] = useState(false);
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit deal bundle</DialogTitle>
          <DialogDescription>{deal.name}. Changes apply to checkout; recorded sales keep their discounts.</DialogDescription>
        </DialogHeader>
        <form className="stack" onSubmit={async (e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const value = Number(data.get('value'));
          if (await onSave({ ...deal, kind, buy: Number(data.get('buy')), free: kind === 'free' ? value : 0,
            discountValue: kind === 'amount' ? Math.round(value * 100) : kind === 'percent' ? value : undefined,
            categoryIds: targets })) onClose();
          else setFailed(true);
        }}>
          <label>Deal type
            <select value={kind} disabled={busy} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="free">Buy X, get Y free</option>
              <option value="amount">Buy X, get $ off</option>
              <option value="percent">Buy X, get % off</option>
            </select>
          </label>
          <label>Buy<Input name="buy" type="number" min="1" max="100" required defaultValue={deal.buy} disabled={busy} /></label>
          <label>{kind === 'free' ? 'Get free' : kind === 'amount' ? 'Discount ($)' : 'Discount (%)'}
            <Input key={kind} name="value" type="number" required disabled={busy}
              min={kind === 'free' ? 1 : 0.01} max={kind === 'amount' ? 100000 : 100} step={kind === 'free' ? 1 : 0.01}
              defaultValue={kind === 'free' ? deal.free || 1 : kind === 'amount' ? (deal.kind === 'amount' ? (deal.discountValue || 1000) / 100 : 10) : deal.kind === 'percent' ? deal.discountValue || 10 : 10} />
          </label>
          <h3>Eligible categories</h3>
          <div className="target-list">
            {categories.map((c) => <label className="check-label" key={c.id}>
              <Checkbox disabled={busy} checked={targets.includes(c.id)} onCheckedChange={(checked) => setTargets((current) => checked ? [...current, c.id] : current.filter((id) => id !== c.id))} />
              {c.name}
            </label>)}
          </div>
          {failed && <p role="alert" className="red">Bundle could not be saved. Close this editor to review the error, then try again.</p>}
          <Button disabled={busy || !targets.length}>Save bundle</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
