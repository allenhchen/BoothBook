# GitHub source and release workflow

## Upload the initial source

The source ZIP contains application code, migrations, tests, dependency lockfile and documentation. It excludes Git history, installed packages, build outputs, credentials, runtime files, databases and business-data exports. Its hosting manifest contains no existing Site ID. Third-party license notices are retained.

1. Create an empty repository, for example `BoothBook`. Choose its visibility intentionally; uploading code does not expose your database.
2. Extract the ZIP. Upload the **contents** of the `BoothBook/` folder to the repository root, not the ZIP itself or an extra nested folder.
3. Commit as the initial baseline. A Git client is preferable for keeping all files, including `.github/`, `.gitignore` and `.openai/hosting.json`.

For an empty remote only:

```sh
git init -b main
git add .
git commit -m "Initial BoothBook prototype"
git remote add origin https://github.com/YOUR-ACCOUNT/BoothBook.git
git push -u origin main
```

If the remote already contains commits, clone it first and copy the source into that clone. Do not force-push over existing history. Never commit workspace JSON, SQLite, `.env` credentials or your real hosted Site configuration.

## Future updates with Codex

Connect GitHub and provide the exact repository URL. For each requested update:

1. Read the current repository and work on a separate branch.
2. Make focused changes and run `pnpm check`.
3. Open a pull request with a short description and validation results.
4. Review/merge it; local clones then use `pnpm local:update`.

A GitHub connection must have write access to the selected repository for pushing branches. Do not paste access tokens into chat. A connection does not automatically synchronize this hosted ChatGPT Site with GitHub; hosted deployment and GitHub changes are separate actions. Declare which repository is the source of truth after the first import.

## Release cadence

Keep routine edits under **Unreleased** in `CHANGELOG.md`. Create a version only for a meaningful tested milestone, rather than for each conversation. The cleaned prototype baseline is **0.18.0**; the earlier prototype notes were consolidated without changing existing database migrations or hosted Git history.

For a milestone:

1. Run `pnpm check` and test the UI/offline workflow on the target devices.
2. Set `package.json` to the new version and move Unreleased notes into its release section.
3. Commit and tag, e.g. `git tag v0.18.0`, then `git push origin main --tags`.
4. Create a GitHub release. GitHub's source ZIP is enough for developers; a prebuilt offline bundle must additionally contain `dist-local/`, `drizzle/`, Node launchers, `scripts/local.mjs`, `standalone/sqlite.mjs`, `package.json` and docs.

Hosted offline caches use a hash of built assets, so cache updates do not require bumping the package version. Database migrations remain append-only and independently tracked.

## CI

`.github/workflows/checks.yml` runs the verification command for main-branch pushes and pull requests. It builds and tests the local/offline app; it does not deploy a Site or access production data. Hosting-specific framework code is retained for supported Sites deployments, but normal GitHub/local use needs only the standalone commands.
