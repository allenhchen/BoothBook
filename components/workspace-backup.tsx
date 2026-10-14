'use client';
import { useRef } from 'react';
import { Button } from './ui/button';
import { workspaceResponse } from '../lib/api-response';
export function WorkspaceBackup({ local, version, busy, onBusy, onError, onRestored }: {
  local: boolean;
  version: number;
  busy: boolean;
  onBusy: (value: boolean) => void;
  onError: (message: string) => void;
  onRestored: () => Promise<void>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  async function download() {
    onBusy(true);
    onError('');
    try {
      const response = await fetch('/api/backup', { cache: 'no-store' });
      const backup = await workspaceResponse(response);
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'BoothBook-workspace-' + new Date().toISOString().slice(0, 10) + '.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    catch (e) {
      onError((e as Error).message);
    }
    finally {
      onBusy(false);
    }
  }
  async function restore(file: File) {
    onError('');
    if (file.size > 32 * 1024 * 1024) {
      onError('Backup is too large (maximum 32 MB).');
      return;
    }
    if (!window.confirm('Replace this offline workspace with the backup? Current offline data will be saved to an automatic SQLite backup first. This does not change your hosted workspace.'))
      return;
    onBusy(true);
    try {
      const backup = JSON.parse(await file.text());
      const response = await fetch('/api/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version, confirm: 'replace', backup }) });
      await workspaceResponse(response);
      await onRestored();
    }
    catch (e) {
      onError((e as Error).message);
    }
    finally {
      onBusy(false);
    }
  }
  return <div className="backup-actions">
    <Button variant="outline" disabled={busy} onClick={download}>Back up workspace</Button>{local && <>
      <Button variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}>Restore backup</Button>
      <input ref={fileInput} hidden type="file" accept=".json,application/json" aria-label="Restore BoothBook workspace backup" onChange={e => {
        const file = e.target.files?.[0]; e.target.value = ''; if (file)
          void restore(file);
      }} /></>}</div>;
}
