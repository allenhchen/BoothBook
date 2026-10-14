# BoothBook

BoothBook tracks an artist-alley catalog, visual deal-box checkout, convention sales, and business earnings/expenses. Square handles payment and tax separately.

| Mode | Data | Connection |
| --- | --- | --- |
| Hosted ChatGPT Site | Private, artist-isolated cloud database | Online for editing; offline checkout can queue sales |
| Standalone | SQLite file on your computer | Fully offline after installation; no account or subscription |

## Start locally from this source

Install Node.js 24 (minimum 22.18) and the pinned package manager:

```sh
npm install --global pnpm@11.25.0
```

Extract the source ZIP, or clone your repository. Open a terminal **inside the project folder**, then run:

```sh
pnpm install --frozen-lockfile
pnpm local:build
pnpm local:start
```

Open **http://127.0.0.1:4173**. Keep the terminal open; stop with **Ctrl+C**. The new local workspace starts empty. To bring existing hosted data over, use **Back up workspace** online and **Restore backup** locally.

A prebuilt offline ZIP needs only Node.js: extract it and double-click `Start-BoothBook.cmd` on Windows, or run `sh Start-BoothBook.sh` on macOS/Linux. You can also run `node dist-local/server.mjs`. A prebuilt ZIP is an app bundle; this source ZIP needs the build steps above.

## Data, backups and moving computers

The database defaults to **`~/.boothbook/boothbook.sqlite`** (Windows: `C:\Users\YourName\.boothbook\boothbook.sqlite`). It lives outside the app folder, so updating or replacing code preserves it.

- **Back up workspace** exports catalog, deals, conventions, sales, fandom colors and financial entries as JSON.
- **Restore backup** is available only in the standalone app. It replaces the local workspace, makes a pre-restore snapshot, and rejects invalid/stale imports. Older backups without financial entries restore an empty finance ledger.
- `pnpm local:backup` creates a consistent SQLite snapshot in the database's adjacent `backups` folder.
- **Export Excel** produces a convention report, not a restorable database backup.

To move to another computer: back up JSON on the old computer, install/build BoothBook on the new one, then restore the JSON. Hosted and standalone copies are independent: local changes do not sync back to the hosted site. See [Local setup and updates](docs/LOCAL.md) for custom paths, raw SQLite transfers, updates and rollback.

Never commit your business-data backups or database to GitHub.

## What the app does

- **Catalog:** prices come from the lowest category; one subcategory level is supported. Grid buttons group by category, subcategory and fandom, all alphabetically. Click an item to edit it. Table view supports column sorting and inline edits. Category deletion keeps its items as N/A. New-item fields stay filled for entering multiple print sizes.
- **Checkout:** add physical units, move them into category-eligible deal boxes, optionally apply a custom $/% discount, and record after payment. Buy/get-free and repeating $/% deals work on complete groups; free units stay in the reports. Prices appear at category headings. Weighted sales = original item value / $10, regardless of discount.
- **Conventions:** sorted by start date, with year filters and colored application statuses. Rename in the row and press Enter or leave the field to save. Accepted conventions have daily/all-days dashboards and Excel exports. Deleting a sale reverses its tallies; refunds remain in Square. Deleting a convention removes its saved sales/dashboard, retaining expense and manual-earning history.
- **Earnings & Expenses:** convention sales, commissions, creator programs, con-specific/inventory/setup expenses, year filters and totals. Enter past conventions by name/start/end dates. Convention selectors include accepted or manually entered events in start-date order. Manual totals replace recorded sales for that convention across all years; extra income is additive. Historical earnings are booked on their end date. Fees can be entered as expenses.
- **Appearance:** dark/light themes, remembered per browser. Search, collapse controls and colored fandom headings help with large catalogs.

Sales preserve original names, fandoms, categories, prices and discounts. Editing the current catalog does not rewrite recorded history. Money is stored in integer cents.

## Hosted offline checkout

While online, sign in and click **Enable offline**; wait for **Offline page ready**. Open dashboards you want cached before disconnecting. Use the same browser/profile; another device has its own pending queue.

**Record paid sale** saves the basket to IndexedDB before clearing it. Sync retries on reconnect/focus, after recording and periodically while open. Stable sale IDs prevent duplicate retries. Pending sales enter dashboard/earnings totals only after server acknowledgement. On iPad, return to the app after reconnecting; syncing while the page is closed is not guaranteed.

Catalog, deal, convention and finance editing still need the hosted backend. Cached dashboards show their last saved totals. Expired sign-in needs the original account online. If prices, deal rules or the convention changed, a paid sale stays pending for review; it is never silently repriced. Export pending sales before correcting/re-entering a conflicted sale, and remove its queued entry only after accounting for the payment.

Do not clear browser storage while sales are pending. Browser storage can be evicted; sync and export recovery files. Pending-sale exports are separate from full JSON backups and cannot be restored by the workspace-restore button. Test offline recording, reload and reconnect on your actual device before a convention.

## Development

```sh
pnpm check
```

This runs strict type checks, builds standalone/offline-browser assets, then runs all regression suites. `pnpm test` runs the same builds/tests without type checking. GitHub pull requests run `pnpm check` too. Browser/iPad visual and interaction testing is still a manual check.

| Area | Location |
| --- | --- |
| Main UI | `app/page.tsx`, `components/` |
| Pricing/catalog/report rules | `lib/model.ts`, `lib/convention-days.ts`, `lib/item-groups.ts` |
| Shared workspace/finance/backup API | `lib/workspace-api.ts`, `lib/finance-api.ts`, `lib/workspace-backup.ts` |
| Artist-scoped storage | `lib/artist-store.ts`, `lib/finance-store.ts`, `db/`, `drizzle/` |
| Standalone Node/SQLite | `standalone/server.ts`, `standalone/sqlite.mjs`, `scripts/local.mjs` |
| Hosted offline queue/cache | `lib/offline-store.ts`, `components/offline-status.tsx`, `standalone/offline-worker.js` |
| Tests and shared fixtures | `tests/`, `tests/helpers/` |

`pnpm dev` and `pnpm build` are for the hosted Sites environment; use `local:*` for ordinary local use. The GitHub ZIP has a generic hosting manifest and no existing Site ID. Deploying a new Site requires its own identity and configuration; uploading to GitHub alone does not deploy the app.

See [Local setup and updates](docs/LOCAL.md), [GitHub workflow and releases](docs/GITHUB.md), [Storage](DATABASE.md), [Authentication](docs/AUTHENTICATION.md) and [Changelog](CHANGELOG.md).
