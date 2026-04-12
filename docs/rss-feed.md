# RSS Feed

## How it works

The site generates an RSS feed at `/feed.xml` during every build. The feed includes all published posts (those with a non-empty `date` in frontmatter), sorted newest first. Static pages like `aboutme.md` and `cv.md` are excluded automatically.

## Implementation

- **`lib/generateRssFeed.ts`** — reads all posts via `getAllPosts()` and produces RSS 2.0 XML with title, link, date, and excerpt for each post.
- **`pages/index.tsx`** — calls `generateRssFeed()` inside `getStaticProps` and writes the result to `public/feed.xml` at build time.
- **`components/meta.tsx`** — includes `<link rel="alternate" type="application/rss+xml" href="/feed.xml"/>` in the site `<head>`, so RSS readers auto-discover the feed.
- **`.gitignore`** — `public/feed.xml` is excluded from version control since it's a build artifact. This is safe because the CI workflow (`npm run build`) regenerates it before rsyncing to the server.

## Adding a new article

No extra steps needed. Any post in `_posts/` with a `date` field is automatically included in the feed on the next build.
