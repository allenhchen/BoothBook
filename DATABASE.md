# BoothBook storage and exports

The catalog, deals and convention settings remain a bounded per-artist JSON record. Transactions live in `artist_sales`, keyed by artist and sale ID and indexed by artist, convention and date. Each transaction retains original item names, fandom, category, prices and discounts. Existing workspace sales are imported once, atomically, on the artist's next authenticated load; the legacy owner claim is unchanged.

Startup loads settings without sales. Checkout reads settings and inserts only the new sale, without fetching or rewriting history. Convention dashboards query only their convention. A session-memory dashboard cache is validated with authenticated ETag requests before use. Responses remain private and bypass shared caches. Catalog changes, sales and deletions use a single D1 batch with a version gate; a stale write cannot partially commit.

Export Excel is available in an opened convention dashboard. It downloads an actual XLSX with a Summary sheet, a sheet per parent category, Transactions, Sale details and Catalog. Sale details are one physical unit per row, including free items. Dollar amounts are numeric dollars (stored prices remain integer cents). Weighted sales use original cents divided by 1000. Times are ISO 8601 UTC. Historical sales retain snapshots after catalog edits. Exports are local snapshots, not an import/restore format.

Validation: `node tests/accounts.mjs`, `node tests/database-growth.mjs`, `node tests/checkout-route.mjs`, `node tests/export.mjs`, pricing/catalog/report suites, and `npx tsc --noEmit`. Export fixtures can be independently opened with an XLSX reader; the generation code does not require a spreadsheet service or runtime dependency.

Standalone mode uses the same schema and handlers with Node's built-in SQLite. Startup checks migration checksums, saves a snapshot before pending migrations, and applies migrations transactionally. SQLite runs in WAL mode with foreign keys and full synchronous durability. By default its file is outside the source folder at `~/.boothbook/boothbook.sqlite`; code updates do not overwrite it. Only the loopback-only server enables JSON restore, after validation and a consistent SQLite snapshot. Hosted backup reads remain artist-scoped and hosted restore is disabled. See README.md for installation, backups, update commands, and recovery.

## Financial entries

`artist_finance` stores one JSON financial entry per `(artist_id, id)` with date, type and optional convention columns indexed by artist/date and artist/convention/type. Entry writes and deletes use the workspace's version/mutation guard in the same transaction. Normal catalog writes do not replace these records. A full offline restore replaces finance records in its guarded workspace transaction.

The finance API calculates paid sales from transaction-line price minus discount using SQLite JSON aggregation rather than transferring all sales to the browser. Manual convention replacement totals suppress automatically recorded earnings for that convention; additional entries are additive. Financial entries retain convention-name snapshots after convention removal.
