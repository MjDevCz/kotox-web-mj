# Writing Articles

## File location

All articles live in `_posts/` as Markdown files. The filename becomes the URL slug (e.g. `offline-first-kmp.md` → `/posts/offline-first-kmp`).

## Frontmatter

Every article needs YAML frontmatter at the top:

```yaml
---
title: 'Article title'
excerpt: "Short description shown on the homepage card."
coverImage: '/assets/blog/post/<folder>/cover.jpg'
date: '2026-04-22T00:00:00.000Z'
metaData:
    name: Android
    picture: '/assets/blog/meta/android_logo_128.png'
    tags: ['android','kmp','offline-first']
ogImage:
    url: '/assets/blog/post/<folder>/cover.jpg'
ogTitle: "Title for social sharing"
---
```

- **date**: articles without a date (empty string `''`) are excluded from the homepage feed (used for static pages like `aboutme.md`).
- **coverImage**: place images in `public/assets/blog/post/<folder>/`.

## Links

- **Internal link** (same tab): use a relative path
  ```markdown
  [About me](/posts/aboutme)
  ```
- **External link** (opens new tab automatically): use a full URL
  ```markdown
  [PowerSync](https://www.powersync.com)
  ```

This is handled by `lib/markdownToHtml.ts` — any `href` starting with `http://` or `https://` gets `target="_blank" rel="noopener noreferrer"` automatically.

## Drafts

Unfinished articles live in `_posts_wip/`. This folder is not read by the site — articles there won't be built or deployed. When a draft is ready, move it to `_posts/`.


## Content guidelines

- Keep articles short and focused — a clear idea without boring the audience.
- Think "stories from the trenches" — real-world moments from professional experience.
- Structure: set the scene, explain the problem, share the decision/solution, end with a takeaway.
- The shared-string-resource and offline-first-kmp articles are good references for tone and length.
