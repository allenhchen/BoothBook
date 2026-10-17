'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { ArtTask, Workspace } from '@/lib/model';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';

const statuses = { planned: 'Planned', 'in-progress': 'In progress', completed: 'Completed' };
const months = Array.from({ length: 12 }, (_, index) => new Date(2026, index, 1).toLocaleString('en-US', { month: 'long' }));
const formatDate = (day: string) => new Date(day + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export function ArtSchedule({ workspace, busy, onSave }: {
  workspace: Workspace;
  busy: boolean;
  onSave: (workspace: Workspace) => Promise<boolean>;
}) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [draft, setDraft] = useState<ArtTask | null>(null);
  const [deleting, setDeleting] = useState<ArtTask | null>(null);
  const [formError, setFormError] = useState('');
  const tasks = workspace.artTasks || [];
  const first = `${year}-01-01`, last = `${year}-12-31`;
  const visible = tasks.filter((task) => task.start <= last && task.deadline >= first)
    .sort((a, b) => a.deadline.localeCompare(b.deadline) || a.name.localeCompare(b.name));
  const years = [...new Set([year, new Date().getFullYear(), ...tasks.flatMap((task) => [Number(task.start.slice(0, 4)), Number(task.deadline.slice(0, 4))])])].sort((a, b) => a - b);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  function addTask() {
    const start = year === now.getFullYear() ? today : first;
    setFormError('');
    setDraft({ id: crypto.randomUUID(), name: '', start, deadline: start, status: 'planned', notes: '' });
  }

  return (
    <section className="art-schedule dashboard">
      <div className="heading">
        <div><h1>Art Schedule</h1><p className="muted">Plan your art projects, from the first sketch to the final deadline.</p></div>
        <div className="schedule-tools">
          <Button variant="outline" aria-label="Previous year" disabled={year <= 1} onClick={() => setYear(year - 1)}>←</Button>
          <label>Year<select className="finance-select" value={year} onChange={(event) => setYear(Number(event.target.value))}>{years.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <Button variant="outline" aria-label="Next year" disabled={year >= 9999} onClick={() => setYear(year + 1)}>→</Button>
          <Button disabled={busy} onClick={addTask}><Plus size={16} /> Add art task</Button>
        </div>
      </div>
      <p className="muted schedule-summary">{visible.length} tasks in {year} · {visible.filter((task) => task.status === 'completed').length} completed · {visible.filter((task) => task.status !== 'completed' && task.deadline < today).length} overdue</p>
      {!visible.length && <div className="panel inset"><h2>Your {year} planner is ready</h2><p className="muted">Add an art task with a start date and deadline to begin planning.</p></div>}
      <div className="schedule-months">
        {months.map((month, index) => {
          const monthStart = `${year}-${String(index + 1).padStart(2, '0')}-01`;
          const monthEnd = `${year}-${String(index + 1).padStart(2, '0')}-${new Date(year, index + 1, 0).getDate()}`;
          const monthly = visible.filter((task) => task.start <= monthEnd && task.deadline >= monthStart);
          return <section className="panel schedule-month" key={month} aria-label={`${month} ${year}`}>
            <div className="panel-title"><h2>{month}</h2><span className="muted">{monthly.length} {monthly.length === 1 ? 'task' : 'tasks'}</span></div>
            <div className="schedule-month-body">
              {!monthly.length && <p className="muted">No art tasks planned.</p>}
              {monthly.map((task) => <article key={task.id} className={`schedule-task schedule-task-${task.status}`}>
                <div className="schedule-task-heading"><h3>{task.name}</h3><div className="finance-actions">
                  <Button variant="ghost" size="icon" disabled={busy} aria-label={`Edit ${task.name}`} onClick={() => { setFormError(''); setDraft({ ...task }); }}><Pencil size={15} /></Button>
                  <Button variant="ghost" size="icon" disabled={busy} aria-label={`Delete ${task.name}`} onClick={() => setDeleting(task)}><Trash2 size={15} /></Button>
                </div></div>
                <span className="schedule-status">{statuses[task.status]}</span>
                <p className="schedule-dates">Start: {formatDate(task.start)}<br />Due: {formatDate(task.deadline)}</p>
                {task.status !== 'completed' && task.deadline < today && <p className="red">Overdue</p>}
                {task.notes && <p className="schedule-notes">{task.notes}</p>}
              </article>)}
            </div>
          </section>;
        })}
      </div>
      <Dialog open={!!draft} onOpenChange={(open) => { if (!open && !busy) setDraft(null); }}>
        <DialogContent className="schedule-editor" showCloseButton={!busy}>
          <DialogHeader><DialogTitle>{tasks.some((task) => task.id === draft?.id) ? 'Edit art task' : 'Add art task'}</DialogTitle><DialogDescription>Set dates, track progress, and keep project notes.</DialogDescription></DialogHeader>
          {draft && <form className="stack" onSubmit={async (event) => {
            event.preventDefault();
            if (draft.deadline < draft.start) { setFormError('Deadline must be on or after the start date.'); return; }
            if (!draft.name.trim()) { setFormError('Enter a task name.'); return; }
            const task = { ...draft, name: draft.name.trim(), notes: draft.notes.trim() };
            const next = tasks.some((item) => item.id === task.id) ? tasks.map((item) => item.id === task.id ? task : item) : [...tasks, task];
            if (await onSave({ ...workspace, artTasks: next })) { setYear(Number(task.start.slice(0, 4))); setDraft(null); }
            else setFormError('Unable to save this task. Check the workspace message and try again.');
          }}>
            <label>Task name<Input required maxLength={160} disabled={busy} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
            <label>Start date<Input type="date" required min="0001-01-01" max="9999-12-31" disabled={busy} value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} /></label>
            <label>Deadline<Input type="date" required min={draft.start || '0001-01-01'} max="9999-12-31" disabled={busy} value={draft.deadline} onChange={(event) => setDraft({ ...draft, deadline: event.target.value })} /></label>
            <label>Status<select className="finance-select" disabled={busy} value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ArtTask['status'] })}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Notes<textarea className="finance-select" rows={4} maxLength={2000} disabled={busy} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
            {formError && <p className="red" role="alert">{formError}</p>}
            <div className="catalog-editor-actions"><Button type="button" variant="outline" disabled={busy} onClick={() => setDraft(null)}>Cancel</Button><Button disabled={busy}>{busy ? 'Saving…' : 'Save task'}</Button></div>
          </form>}
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleting} onOpenChange={(open) => { if (!open && !busy) setDeleting(null); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle><AlertDialogDescription>This removes the task from your art schedule for every year.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={async (event) => { event.preventDefault(); if (await onSave({ ...workspace, artTasks: tasks.filter((task) => task.id !== deleting?.id) })) setDeleting(null); }}>Delete task</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
