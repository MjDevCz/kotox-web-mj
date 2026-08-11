# CLAUDE.md

Guidance for Claude Code when working in this repo.

## What this is

MJ's personal website and blog (jenicek.dev) — Mobile craftsmanship stories. Next.js + Markdown +
React/TypeScript, based on the Vercel blog-starter template. Simple, content-first codebase.

## Commands

Use **yarn** — this repo is yarn-only (do not use npm).

- `yarn dev` — run the dev server
- `yarn build` — production build
- `yarn start` — serve the production build on port 8080
- `yarn typecheck` — `tsc` type check

## Layout

- `_posts/` — published articles as Markdown. **Filename = URL slug** (`offline-first-kmp.md` → `/posts/offline-first-kmp`).
- `_posts_wip/` — drafts. Not built or deployed; move to `_posts/` when ready.
- `public/assets/blog/post/<folder>/` — per-post images (e.g. `cover.jpg`).
- `pages/` — Next.js routes (`index.tsx`, `posts/`, `series/`).
- `lib/` — content pipeline: `api.ts` (reads `_posts/`), `markdownToHtml.ts`, `series.ts`, `generateRssFeed.ts`.
- `components/`, `styles/`, `interfaces/` — UI, CSS, TS types.
- `docs/` — project documentation (see below).

## Docs — read these before the matching task

- **[Writing articles & house style](docs/writing-articles.md)** — the source of truth for authoring
  posts: frontmatter schema, series fields, links, drafts, content guidelines, and the full **house
  style** (TL;DR deck, Title Case headings, SEO/GEO titling, etc.). **Apply this to every blog edit.**
- [Dependency management](docs/dependency-management.md)
- [RSS feed](docs/rss-feed.md)
- [Story ideas](docs/story-ideas.md)

## Working on blog posts

When creating or editing anything in `_posts/`, follow `docs/writing-articles.md` end to end — especially
the house style and SEO/GEO titling rules. The Offline-First KMP series (`offline-first-*.md`) is the
reference for tone, structure, and frontmatter.

## Skills

- **optimize-cover** (`/optimize-cover`) — convert a post cover (PNG/large JPG) into an optimized
  `cover.jpg` matching the other covers (~1920px wide, ~200–290KB). Use whenever asked to optimize,
  compress, or convert a cover image under `public/assets/blog/post/`.