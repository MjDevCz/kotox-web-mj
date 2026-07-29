"""# Writing Articles

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
- **series** *(optional)*: marks the article as part of a series. The value is shown as a small uppercase "eyebrow" label above the title — on the post page, the hero card, and the preview cards. Use the same string on every post in the series (e.g. `series: 'Offline-First KMP'`).
- **seriesPart** *(optional)*: the installment number within the series. Appended to the eyebrow as `· Part N` (e.g. `seriesPart: 2` → "Offline-First KMP · Part 2"). Ignored unless `series` is also set.

## Reading time

A reading time estimate (e.g. "4 min read") is displayed next to the date on every post automatically. To hide it on non-article pages (like `aboutme.md` or `cv.md`), add to the frontmatter:

```yaml
hideReadingTime: true
```

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

## House style

This is the house style for the series — apply it to every part while iterating. It tightens *surface and
structure* but never the payoff line (keep the closing thesis intact):
**the idea and the punchline are the author's; the packaging gets standardized.**

- **Open with a one-line `TL;DR` deck** stating the thesis, then start the body. (Our per-part
  "The idea" callout is the raw material for this.)
- **Expand acronyms on first use** — "Kotlin Multiplatform (KMP)".
- **Spell out small numbers** in prose — "four months, two engineers", not "4 months, 2 engineers".
- **"and", not "&".**
- **Calm the punctuation.** Prefer commas/colons over piled-up em-dashes. (Our current drafts are
  em-dash-heavy — this is the single biggest surface fix to make on each.)
- **Headings: Title Case, descriptive, keyword-rich, concrete.** "The 7 … Tools We Evaluated" beats
  "The landscape". Favor scannable, numbered, SEO-friendly headings.
- **SEO/GEO titling** *(derived from STRV's edits to Part 2 before publishing — apply to every part):*
  - **Keep the local `title`/`ogTitle` short and punchy — do NOT hand-write the keyword-stuffed
    version.** Two reasons: the series **eyebrow already shows the context** ("Offline-First KMP · Part
    3" renders above every title, so restating "offline-first" or "…before the server" in the title is
    redundant), and **STRV applies the SEO/GEO title rewrite at publish time** (the local Part 2 file
    still reads "Two writes for every tap"; STRV published it as "Optimistic UI in Offline-First Apps:
    Two Writes Per Tap"). The slug, tags, and excerpt already carry the keywords. So match the punchy
    house voice locally — "Two writes for every tap", "Minting IDs Before the Server" — and let the
    eyebrow + STRV do the keyword work. Under ~40 chars is a good target; keep a small memorable hook
    rather than a bare label.
  - **The `[Searchable keyword concept]: [Memorable phrase]` pattern is what the *published* title
    should become — not what you write locally.** It's STRV's transform (lead with the domain keyword a
    person or LLM would search, keep the clever phrase as the tail: "Optimistic UI in Offline-First
    Apps: Two Writes Per Tap"). Documented here so we recognize/anticipate it, not so we pre-apply it.
  - **Name the concept in the heading — never tease it.** Cute/vague headings become explicit statements
    or questions that match search intent: "The Problem With 'Just Sync It'" → "Why 'Just Sync It' Fails
    In Offline-First Apps"; "The Part That Feels Wrong" → "Why The Optimistic Projection Is Never
    Uploaded"; "Why Split It This Way" → "Event Sourcing vs. CRUD: Why Split The Write In Two".
  - **Surface named terminology in headings** — the technical terms a reader/LLM would search go into the
    heading text: "The Event" → "The **Immutable** Event"; "The Projection" → "The **Optimistic**
    Projection". This is the GEO win: an LLM can extract the heading as a self-contained answer.
  - **The signature closer stays.** "The Shape to Take Away" is left unchanged — series-consistent
    closers are exempt from keyword rewriting.
- **Add connective context / an outbound resource** where it genuinely helps the reader.
- **Keep the strong closing line intact** — polish around a good payoff, don't rewrite it.
- **Never reference the eventual talks in the blog.** No "saving this for the stage / a talk / to tell
  live." To withhold, either (a) point to a specific later part when it *is* genuinely covered later
  (e.g. "Part 5 gets into where that breaks down"), or (b) just set the topic aside without promising
  anything ("a whole topic of its own, set aside here"). Talk-reserved material (Witness/Judge,
  KMP-on-backend, conflict-resolution-as-UX) gets option (b) — it isn't covered later in the series.
  *(This file and the `*-notes-*.md` files may reference the talks freely — the rule is about the
  reader-facing blog text only.)*
- **Don't imply a fixed part count.** The series is open-ended (6 drafted for now, can grow). Blog text
  should say "next up" / "later in the series", never "the final part" or "the last of six".
