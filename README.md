# LOCKIN — local edition

LOCKIN is a personal consistency dashboard for check-ins, nutrition, water, tasks, study/focus, habits, career goals, calendar history, analytics and monthly recaps.

This edition is **local-only**:

- no Supabase
- no login or sign-up
- no cloud database
- no email or password
- data stays on the machine running the app

## Run it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

For a production-style local run:

```bash
npm run build
npm start
```

## Where the data lives

By default:

```text
.lockin-data/data.json
```

The file is created automatically the first time the app opens. It is readable only by your operating-system user and is ignored by git.

To store it somewhere else, set `LOCKIN_DATA_DIR` before starting:

```bash
LOCKIN_DATA_DIR=/path/to/private/folder npm start
```

Use **Settings → Export data** for a JSON/CSV backup. To wipe everything, use **Settings → Reset local data** and type `RESET LOCAL DATA`.

## Honest-data rules

- Missing data is shown as missing, never as zero.
- Partial check-ins stay partial until completed.
- Historical targets are versioned by effective date.
- Monthly recaps are generated deterministically from saved evidence.
- AI narration is optional and off by default.

## Verify

```bash
npm run typecheck
npm test
npm run build
```

## Hosting note

Because the data file is server-local, **do not deploy this edition to a serverless host** such as Netlify, Vercel or Cloudflare Pages. Those platforms use ephemeral or read-only filesystems. Use a local machine or a VPS with a persistent disk. See `DEPLOYMENT.md`.

No public deployment is included.
