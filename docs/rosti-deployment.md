# Deployment on Roští.cz

jenicek.dev runs on [Roští.cz](https://rosti.cz) as a Node.js app container, deployed by GitHub
Actions on every push to `main` (`.github/workflows/rosti_deploy.yml`). This doc records how the
server is set up and the traps we have already hit, so the next deployment refactor starts with
the full picture. **Read it before changing the deploy workflow, the start command, or the package.**

## Where to read Roští's docs

docs.rosti.cz answers automated fetches with HTTP 403. The same docs are public on GitHub in
[`rosti-cz/docs`](https://github.com/rosti-cz/docs):

- `ai/runtime.txt` — the most compact description of the container: supervisord, nginx, paths, logs
- `docs/cs/supervisor.md` — process config and `supervisorctl`
- `docs/cs/cicd.md` — the generated GitHub Actions workflow
- `docs/cs/plans.md` — package specs

The container image itself is [`rosti-cz/runtime`](https://github.com/rosti-cz/runtime)
(`etc/supervisord.conf`, `start.sh`).

## Package

Since 2026-11-12 the app runs on the **Small** package: 0.25 CPU, 1024 MB RAM, **1 GB disk**,
**128 PID limit**, 1024 connections. It was on Standard (0.5 CPU, 2 GB RAM, 25 GB disk, 256 PIDs).

Measured on Standard (Roští admin → monitoring): CPU ~0.02 %, RAM ~450 MB. Both fit Small easily.
Disk was the problem: the old deploy uploaded the whole repo with `node_modules` (~1.65 GB,
~35k files), and disk above the package quota is billed extra. That is why we deploy a
standalone build (below).

The PID limit counts threads, not just processes. Node, nginx, supervisord and sharp's image
threads all count toward it.

## How the app runs

Inside the container (all under `/srv`):

| Path | What |
|---|---|
| `/srv/app/` | The deployed app. rsync replaces it on every deploy and **deletes everything else in it**. |
| `/srv/conf/supervisor.d/` | supervisord program configs. **Every file here is loaded** (`files = /srv/conf/supervisor.d/*`). |
| `/srv/conf/supervisor.d/node.conf` | The app's `[program:app]`: the command that starts the site. |
| `/srv/conf/supervisor.d/nginx.conf` | Runs nginx. |
| `/srv/conf/nginx.d/app.conf` | nginx site: listens on 8000, proxies to the app on `127.0.0.1:8080`. |
| `/srv/bin/primary_tech/` | The Node.js toolchain (`node`, `npm`, `npx`, `corepack`), set by `rosti node <version>`. |
| `/srv/.npm-packages/` | Global npm packages, on the app's `PATH`: only `npm` and `yarn` (~17 MB). An old global Next.js (243 MB) was removed on 2026-11-12. |
| `/srv/log/node.log` | App stdout/stderr (rotated by supervisord, 2 MB × 5). |
| `/srv/.yarn/`, `/srv/.npm/` | Package-manager download caches from installs on the server. Unused since we build in CI; they held 504 MB + 295 MB until removed on 2026-11-12. Delete them if they reappear. |

After the 2026-11-12 cleanup all of `/srv` is ~122 MB. Measure the whole thing with
`du -sh /srv /srv/* /srv/.[!.]*`. Summing a few known directories missed ~800 MB of caches once.

The app is a Next.js **standalone** build (`output: 'standalone'` in `next.config.js`).
CI builds it, copies `.next/static` and `public/` into `.next/standalone/`, and rsyncs only
that directory to `/srv/app/` (~86 MB, ~2.1k files). supervisord starts it with:

```ini
command=/srv/bin/primary_tech/node server.js
environment=PATH="...",NODE_ENV="production",PORT="8080",HOSTNAME="127.0.0.1"
```

There is no `node_modules/.bin/next` on the server, so `npm start` / `next start` cannot work
there. If anything falls back to them, it now fails with `next: not found` and crash-loops.
Before 2026-11-12 an old global Next.js in `/srv/.npm-packages` started instead and crashed on
the Next 16 build (`Cannot find module .../font-manifest.json`), which hid the real cause. Don't
install `next` globally on the server again.

`next.config.js` also forces sharp's native `@img/sharp-libvips-*` package into the bundle:
Next's file tracing copies `sharp` but misses libvips, and without it every page returns 500.

## Pitfall: the start command lives in `node.conf`

Roští's docs: *"V souboru /srv/conf/supervisor.d/JAZYK.conf je pak konfigurace k vybrané primární
technologii"* — the primary technology's config is `node.conf` for Node.js.

The workflow Roští generated for us wrote a **second** file, `app.conf`, with the same
`[program:app]`. supervisord loads both, `node.conf` sorts later and silently wins. While both
said `npm start` nobody noticed. When PR #62 changed the command in `app.conf` only,
`supervisorctl reread` reported `No config updates to processes`, the old `npm start` kept
running against the new bundle, and **the site was down (502)** until we fixed `node.conf` by hand
on the server.

The workflow's "Setup Supervisord" step now writes `node.conf` directly.

Rules:

- Change the start command **only in `node.conf`**. Keep exactly one file with `[program:app]`.
- Never leave backups inside `supervisor.d/` — they are loaded too. Use `/srv/` instead.
- Apply supervisord changes with `supervisorctl reread` then `supervisorctl update`
  (per Roští's `supervisor.md`). `restart` alone keeps the old command. A real change prints
  `app: changed` / `app: updated process group`; silence means nothing was applied.

## Checking the server

SSH (password login; the deploy key lives only in the `ROSTI_DEPLOY_SSH_KEY` secret):

```bash
ssh -p 26052 app@ssh.rosti.cz
```

```bash
supervisorctl status app                 # RUNNING with a growing uptime; a resetting uptime = crash loop
tail -50 /srv/log/node.log               # a healthy start shows "▲ Next.js 16…"
ls /srv/conf/supervisor.d                # should be node.conf + nginx.conf only
cat /sys/fs/cgroup/pids.events           # "max N": times the PID limit was hit
cat /sys/fs/cgroup/memory.events         # "oom_kill N": times something ran out of RAM
du -sh /srv /srv/* /srv/.[!.]* | sort -h  # disk vs the 1 GB quota (df shows the shared host disk)
```

The Roští admin's monitoring page shows CPU, memory, network, disk I/O, disk space and file
count over 30 min to 7 days.

## Before merging a deploy change

Merging to `main` deploys immediately, so check these first:

1. Build the standalone bundle locally and run it the way the server does
   (`cd .next/standalone && PORT=8091 HOSTNAME=127.0.0.1 node server.js`); smoke-test pages,
   `/feed.xml` and a `/_next/image` URL.
2. If the start command changes, confirm which supervisor file the server actually uses
   (`ls /srv/conf/supervisor.d`) and that the workflow writes **that** file.
3. After the deploy, check the live site and `supervisorctl status app`, not just a green
   Actions run — the run succeeds even when the app crash-loops.
