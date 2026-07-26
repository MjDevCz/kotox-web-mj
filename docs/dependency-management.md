# Dependency Management

This project uses **yarn** (classic, v1) as its only package manager, and locks
dependencies to known-safe versions. This doc explains how that stays enforced —
so a stray `npm install` or an out-of-sync lockfile can't quietly ship
vulnerable code to production.

## Why yarn-only

Committing both `yarn.lock` and `package-lock.json` was doubling Dependabot's
alert count (each vulnerability reported once per lockfile) and let the two
lockfiles drift apart. More importantly, `npm install` ignores `yarn.lock` **and**
the `resolutions` field — so an npm-based build could pull the vulnerable
transitive versions right back in. We standardized on yarn to close that gap.

## The safe set: how versions get pinned

- **`yarn.lock`** — pins the exact resolved version and integrity hash of every
  package, direct and transitive. This is the base guarantee: a fresh install
  reproduces byte-identical dependencies.
- **`resolutions` in `package.json`** — forces *transitive* dependencies up to
  safe versions even when a parent pins something older. This is doing real work
  here: Next.js pins an exact `postcss` and an optional `sharp`, and
  `gray-matter` pulls `js-yaml` — the resolutions override all of them:

  ```json
  "resolutions": {
    "js-yaml": "^3.15.0",
    "postcss": "^8.5.18",
    "sharp": "^0.35.0"
  }
  ```

  Without these, `yarn install` would happily restore the vulnerable transitive
  copies.

## The enforcers: how the safe set stays locked

| Mechanism | File | What it prevents |
|---|---|---|
| `packageManager` + Corepack | `package.json` | Different yarn versions resolving the tree differently across machines/CI |
| `.gitignore` entry | `.gitignore` | An `npm install` accidentally committing `package-lock.json` |
| **Lockfile guard workflow** | `.github/workflows/lockfile-guard.yml` | The actual gate — fails any PR that commits `package-lock.json` or lets `yarn.lock` drift from `package.json` |
| `--frozen-lockfile` on deploy | `.github/workflows/rosti_deploy.yml` | A production build silently regenerating the lockfile and drifting off the pinned versions |

The **lockfile guard** is the "who": it runs on every PR and on pushes to `main`,
and a human cannot merge past a failing check. It does two things:

1. Fails if `package-lock.json` exists in the repo.
2. Runs `yarn install --frozen-lockfile`, which errors if `package.json` and
   `yarn.lock` disagree — catching dependency edits that skipped `yarn install`.

The **deploy** (`rosti_deploy.yml`) uses `yarn install --frozen-lockfile` and
`yarn build`, so what ships to production is built from exactly the pinned
versions — not whatever a loose install happens to resolve.

## Staying current: Dependabot

The locking above prevents *regression* — it does not move you forward. When a
new advisory lands, or deps simply go stale, **Dependabot version updates**
(`.github/dependabot.yml`) opens PRs on a weekly schedule to bump them. Those
PRs run through the same lockfile guard, so upgrades can't bypass the policy.
Dependabot *security* alerts are separate and open immediately regardless of the
schedule.

## Everyday workflow

- Install / add deps: `yarn install`, `yarn add <pkg>`. Never `npm install`.
- Changed `package.json` by hand? Run `yarn install` to update `yarn.lock`, then
  commit both — otherwise the guard fails.
- Reviewing a Dependabot PR: check the diff builds green (the guard + deploy
  build run automatically), then merge as usual.