# Local setup, transfers and updates

## Requirements and first install

Use Node.js 24 (minimum 22.18). Node supplies SQLite; do not install a separate database. Installing packages/downloading updates needs internet. Ordinary local use needs no ChatGPT, Cloudflare, Google login, subscription or API key.

From a Git clone or extracted source ZIP:

```sh
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm local:build
pnpm local:start
```

Open http://127.0.0.1:4173. The app binds to loopback only and rejects foreign Host/Origin requests. Keep it on a trusted single-user computer; do not expose it through tunnels or public servers.

## Choose a data path or port

Default database: `~/.boothbook/boothbook.sqlite`. One database file is one local workspace; all its browser tabs share it. The current unpaid basket is temporary and is not included in backups.

macOS/Linux:

```sh
BOOTHBOOK_DB_PATH=/absolute/path/my-art.sqlite BOOTHBOOK_PORT=4174 pnpm local:start
```

Windows PowerShell:

```powershell
$env:BOOTHBOOK_DB_PATH = 'C:\Users\YourName\BoothBookData\my-art.sqlite'
$env:BOOTHBOOK_PORT = '4174'
pnpm local:start
```

Use the same path variables when backing up or updating. The port must be 1024–65535. Keep the live database on a local disk, not a network share or actively synced cloud folder. Backups can be copied to cloud storage.

## Bring hosted data to a local copy

1. Sync pending hosted sales first; they are not yet in a full backup.
2. In the hosted app, click **Back up workspace**.
3. Start the local app, click **Restore backup**, select the JSON and confirm replacement.

Restore replaces, rather than merges, the entire local workspace and clears the basket. It creates an automatic SQLite snapshot first. Local changes do not automatically sync to the hosted app; hosted restore is disabled. Choose which copy you will use as your source of truth.

To move between computers, use the same JSON export/restore workflow. To move a raw SQLite database, stop the app on the old computer first, then copy the database to the destination's configured path. If shutdown was interrupted, keep the matching `-wal` and `-shm` files with it. Never copy just the active `.sqlite` file while the app is running; use `pnpm local:backup` instead, which includes committed WAL data.

## Update a Git clone

Clone from the repository you want updates from, so `origin` and the branch upstream are configured correctly:

```sh
git clone https://github.com/YOUR-ACCOUNT/BoothBook.git
cd BoothBook
```

Stop BoothBook with Ctrl+C, then:

```sh
pnpm local:update
pnpm local:start
```

Update refuses uncommitted source changes, snapshots the database, runs `git pull --ff-only`, installs frozen-lockfile dependencies and rebuilds. It never force-resets your code. If Git says branches diverged, resolve the source changes before retrying. A failed pull/install/build does not delete the external database; keep the last working release until the new one runs.

If you began from a source ZIP, use a fresh Git clone for future updates. Start it with the same database path; the code folder is independent of your data. Do not initialize a second competing Git history in an already populated remote repository.

## Update a ZIP installation

1. Stop the old app and back up its workspace.
2. Extract the new release to a **new folder**.
3. For a source ZIP, run the install/build steps above. For a prebuilt ZIP, no dependency install/build is needed.
4. Start the new copy with the same `BOOTHBOOK_DB_PATH`, if customized.
5. Keep the old folder and backup until the update is verified.

## Migrations and rollback

Startup tracks migration names/checksums, snapshots before new migrations, and applies them transactionally. A failure rolls back; repeated starts do not reapply them. **Keep published `drizzle/` migrations unchanged**, even when consolidating release notes. Code releases and database schema versions are different things.

For rollback, stop the app, preserve the current database separately, restore the pre-update snapshot and use its matching old code. Do not run old code against a newer schema or leave old WAL/SHM files beside a different restored database. JSON restore is usually easier when transferring records between computers.

## Troubleshooting

- **Port already in use:** stop the other BoothBook process or choose another port.
- **Build first:** run `pnpm local:build` from the source root.
- **SQLite unavailable:** check `node --version`; upgrade to Node.js 24.
- **Not a Git checkout:** follow ZIP updates or switch to a fresh clone.
- **Dirty checkout:** commit/stash your own changes before updating.
- **Private repository:** authenticate Git with an account allowed to access it.
