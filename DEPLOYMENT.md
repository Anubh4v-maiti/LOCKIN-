# LOCKIN local edition — deployment notes

## Recommended: run locally

```bash
npm install
npm run build
npm start
```

The app is available at <http://localhost:3000>.

Data is stored in `.lockin-data/data.json` beside the project unless `LOCKIN_DATA_DIR` is set. Back it up before moving machines.

## VPS with persistent storage

Use any Node 22 host that provides a persistent disk:

1. Copy or clone the project.
2. Run `npm ci` and `npm run build`.
3. Set `LOCKIN_DATA_DIR` to a private directory on the persistent volume.
4. Run `npm start` behind a reverse proxy such as Caddy or nginx.
5. Restrict access with the proxy or a private network if the VPS is public.

Example:

```bash
LOCKIN_DATA_DIR=/var/lib/lockin PORT=3000 npm start
```

## Do not use serverless hosting

Netlify, Vercel, Cloudflare Pages and similar platforms do not provide a durable writable filesystem for this architecture. Saving to their temporary filesystem would lose data on redeploy or instance restart.

## Backups

- Use **Settings → Export data** to download JSON/CSV.
- Copy `.lockin-data/data.json` while the app is stopped.
- Keep the data directory private; it contains personal daily records.

## AI narration

Disabled by default. Enabling `ENABLE_AI_INSIGHTS=true` with a provider key sends recap statistics and notes to the configured external provider. Leave it off for a fully local workspace.
