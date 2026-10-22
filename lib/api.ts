import fs from 'fs'
import {join} from 'path'
import matter from 'gray-matter'
import {seriesSlug} from './series'
import {stripInlineBold} from './inlineBold'

export {seriesSlug}

const postsDirectory = join(process.cwd(), '_posts')
const seriesDirectory = join(process.cwd(), '_series')

// A series can have a hand-written blurb at `_series/<slug>.md`. The Markdown
// body is the full description shown on the /series overview and homepage bands;
// an optional `ogDescription` in frontmatter is a shorter variant for the social
// meta tags. When present the body overrides the default (the first part's
// excerpt). Returns null if the file is absent or empty.
function getSeriesBlurb(slug: string): {description: string; ogDescription: string | null} | null {
    const data = readSeriesFile(slug)
    if (!data) return null
    const {content, frontmatter} = data
    const og = typeof frontmatter.ogDescription === 'string' ? frontmatter.ogDescription.trim() : ''
    // The file is hard-wrapped for readability; collapse it to a single line so
    // meta tags and cards get clean text rather than embedded newlines.
    const description = content.replace(/\s+/g, ' ').trim()
    if (description.length === 0) return null
    return {description, ogDescription: og.length > 0 ? og : null}
}

function readSeriesFile(slug: string): {content: string; frontmatter: Record<string, any>} | null {
    const fullPath = join(seriesDirectory, `${slug}.md`)
    if (!fs.existsSync(fullPath)) return null
    const {content, data} = matter(fs.readFileSync(fullPath, 'utf8'))
    return {content, frontmatter: data}
}

export type SeriesPlannedPart = {
    part: number
    title: string
    teaser: string | null
}

// Parts announced in the `planned:` frontmatter list of `_series/<slug>.md`.
// The /series page shows them as "Coming soon" rows anchored at `#part-N`.
// Entries whose number already has a published post are dropped, so publishing
// a part retires its placeholder without touching the series file.
function getSeriesPlanned(slug: string, publishedParts: Set<number>): SeriesPlannedPart[] {
    const planned = readSeriesFile(slug)?.frontmatter.planned
    if (!Array.isArray(planned)) return []
    return planned
        .map((p: any) => ({
            part: Number(p.part),
            title: String(p.title ?? ''),
            teaser: typeof p.teaser === 'string' && p.teaser.trim().length > 0 ? p.teaser.trim() : null,
        }))
        .filter((p) => Number.isFinite(p.part) && p.title.length > 0 && !publishedParts.has(p.part))
        .sort((a, b) => a.part - b.part)
}

export function getPostSlugs() {
    return fs.readdirSync(postsDirectory)
}

export function getPostBySlug(slug: string, fields: string[] = []) {
    const realSlug = slug.replace(/\.md$/, '')
    const fullPath = join(postsDirectory, `${realSlug}.md`)
    const fileContents = fs.readFileSync(fullPath, 'utf8')
    const {data, content} = matter(fileContents)

    type Items = {
        [key: string]: string
    }

    const items: Items = {}

    // Ensure only the minimal needed data is exposed
    fields.forEach((field) => {
        if (field === 'slug') {
            items[field] = realSlug
        }
        if (field === 'content') {
            items[field] = content
        }

        if (typeof data[field] !== 'undefined') {
            items[field] = data[field]
        }
    })

    if (fields.includes('readingTime') && !data.hideReadingTime) {
        const words = content.trim().split(/\s+/).length
        items['readingTime'] = `${Math.max(1, Math.round(words / 200))} min read`
    }

    return items
}

export type SeriesNavItem = {
  slug: string
  title: string
  part: number | null
}

// The next announced-but-unpublished part, shown in place of "Next" on the
// newest published part. Links to its "Coming soon" row on the series page.
export type SeriesUpcomingItem = {
  seriesSlug: string
  part: number
  title: string
}

// Given a post slug, find its neighbours within the same `series`, ordered by
// `seriesPart`. Returns nulls when the post isn't in a series or is at an end.
// On the newest part, `upcoming` is the first planned part, if any.
export function getSeriesNav(slug: string): {
  prev: SeriesNavItem | null
  next: SeriesNavItem | null
  upcoming: SeriesUpcomingItem | null
} {
  const realSlug = slug.replace(/\.md$/, '')
  const series = getPostBySlug(realSlug, ['series']).series
  if (!series) return { prev: null, next: null, upcoming: null }

  const inSeries = getAllPosts(['slug', 'title', 'series', 'seriesPart'])
    .filter((p) => p.series === series)
    .sort((a, b) => Number(a.seriesPart ?? 0) - Number(b.seriesPart ?? 0))

  const idx = inSeries.findIndex((p) => p.slug === realSlug)
  const toNav = (p: any): SeriesNavItem => ({
    slug: p.slug,
    title: p.title,
    part: p.seriesPart != null ? Number(p.seriesPart) : null,
  })

  const next = idx >= 0 && idx < inSeries.length - 1 ? toNav(inSeries[idx + 1]) : null
  let upcoming: SeriesUpcomingItem | null = null
  if (!next && idx >= 0) {
    const slugOfSeries = seriesSlug(series)
    const published = new Set(inSeries.map((p) => Number(p.seriesPart)))
    const first = getSeriesPlanned(slugOfSeries, published)[0]
    if (first) upcoming = { seriesSlug: slugOfSeries, part: first.part, title: first.title }
  }

  return {
    prev: idx > 0 ? toNav(inSeries[idx - 1]) : null,
    next,
    upcoming,
  }
}

export type SeriesShowcasePart = {
  slug: string
  title: string
  part: number | null
  date: string
  coverImage: string | null
  // Set via `seriesHighlight: true` in frontmatter: a landmark part (the
  // opener, a talk companion) that series lists render with emphasis.
  highlight: boolean
}

export type SeriesShowcase = {
  name: string
  slug: string
  description: string
  ogDescription: string
  cover: string | null
  social: string | null
  parts: SeriesShowcasePart[]
  planned: SeriesPlannedPart[]
}

// Returns the public path for a series asset if the file exists, else null.
function getSeriesAsset(slug: string, file: string): string | null {
  const publicPath = `/assets/blog/series/${slug}/${file}`
  const filePath = join(process.cwd(), 'public', publicPath)
  return fs.existsSync(filePath) ? publicPath : null
}

// A series can have its own banner image at
// `public/assets/blog/series/<slug>/cover.jpg`, shown on the overview page.
function getSeriesCover(slug: string): string | null {
  return getSeriesAsset(slug, 'cover.jpg')
}

// A dedicated 1200x630 social-share image at `.../og.jpg` (LinkedIn/OG's
// canonical size and 1.91:1 ratio). Falls back to the banner cover so sharing
// still works before an og.jpg is added.
function getSeriesSocial(slug: string): string | null {
  return getSeriesAsset(slug, 'og.jpg') ?? getSeriesCover(slug)
}

// How many series bands the homepage will show at once, newest-active first.
export const MAX_FEATURED_SERIES = 3

// All series that have at least one post, ordered by recency (the series whose
// newest part is most recent comes first). Each series' parts are ordered by
// `seriesPart`. The description is the hand-written `_series/<slug>.md` blurb
// when present, otherwise the first part's excerpt; `ogDescription` is that
// file's optional short variant for meta tags, falling back to the description.
// This is the shared source for both the homepage bands and the /series pages.
export function getAllSeries(): SeriesShowcase[] {
  const posts = getAllPosts(['slug', 'title', 'series', 'seriesPart', 'seriesHighlight', 'date', 'excerpt', 'coverImage'])

  // `posts` is date-descending, so first sighting of a series name = its newest
  // part. Collecting names in encounter order gives us newest-active first.
  const order: string[] = []
  const groups: Record<string, typeof posts> = {}
  for (const p of posts) {
    const name = p.series as string | undefined
    if (!name) continue
    if (!groups[name]) {
      groups[name] = []
      order.push(name)
    }
    groups[name].push(p)
  }

  return order.map((name) => {
    const parts = groups[name]
      .slice()
      .sort((a, b) => Number(a.seriesPart ?? 0) - Number(b.seriesPart ?? 0))
    const slug = seriesSlug(name)
    const blurb = getSeriesBlurb(slug)
    const description = blurb?.description ?? stripInlineBold((parts[0]?.excerpt as string) ?? '')
    return {
      name,
      slug,
      description,
      // Fall back to the full description when no short OG variant is given.
      ogDescription: blurb?.ogDescription ?? description,
      cover: getSeriesCover(slug),
      social: getSeriesSocial(slug),
      parts: parts.map((p) => ({
        slug: p.slug as string,
        title: p.title as string,
        part: p.seriesPart != null ? Number(p.seriesPart) : null,
        date: p.date as string,
        coverImage: (p.coverImage as string) || null,
        highlight: String(p.seriesHighlight) === 'true',
      })),
      planned: getSeriesPlanned(slug, new Set(parts.map((p) => Number(p.seriesPart)))),
    }
  })
}

// Look up a single series by its slug for the /series/[slug] page.
export function getSeriesBySlug(slug: string): SeriesShowcase | null {
  return getAllSeries().find((s) => s.slug === slug) ?? null
}

// Links of the form `/series/<slug>#part-N` stand in for a mention of a part
// that isn't published yet. Once part N ships, such a link should point at the
// post itself; this lists the ones that still don't, for a build-time warning.
export function getStaleSeriesAnchors(): string[] {
  const published = new Map<string, Set<number>>()
  for (const s of getAllSeries()) {
    published.set(s.slug, new Set(s.parts.map((p) => p.part).filter((n): n is number => n != null)))
  }
  const stale: string[] = []
  for (const post of getAllPosts(['slug', 'content'])) {
    for (const m of (post.content ?? '').matchAll(/\/series\/([a-z0-9-]+)#part-(\d+)/g)) {
      if (published.get(m[1])?.has(Number(m[2]))) stale.push(`_posts/${post.slug}.md → ${m[0]}`)
    }
  }
  return stale
}

// Series to feature on the homepage, ordered by recency, capped at
// MAX_FEATURED_SERIES. Only series with at least two published parts are
// featured; a lone Part 1 stays an ordinary card in the grid until Part 2 ships.
export function getFeaturedSeries(): SeriesShowcase[] {
  return getAllSeries()
    .filter((s) => s.parts.length >= 2)
    .slice(0, MAX_FEATURED_SERIES)
}

export function getAllPosts(fields: string[] = []) {
    const slugs = getPostSlugs()
    const posts = slugs
        .map((slug) => getPostBySlug(slug, fields))
        .filter(value => value.date != '')//Avoid posts without date (e.g. aboutme.md)
        // sort posts by date in descending order
        .sort((post1, post2) => (post1.date > post2.date ? -1 : 1))
    return posts
}
