import fs from 'fs'
import {join} from 'path'
import matter from 'gray-matter'

const postsDirectory = join(process.cwd(), '_posts')

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

// Given a post slug, find its neighbours within the same `series`, ordered by
// `seriesPart`. Returns nulls when the post isn't in a series or is at an end.
export function getSeriesNav(slug: string): {
  prev: SeriesNavItem | null
  next: SeriesNavItem | null
} {
  const realSlug = slug.replace(/\.md$/, '')
  const series = getPostBySlug(realSlug, ['series']).series
  if (!series) return { prev: null, next: null }

  const inSeries = getAllPosts(['slug', 'title', 'series', 'seriesPart'])
    .filter((p) => p.series === series)
    .sort((a, b) => Number(a.seriesPart ?? 0) - Number(b.seriesPart ?? 0))

  const idx = inSeries.findIndex((p) => p.slug === realSlug)
  const toNav = (p: any): SeriesNavItem => ({
    slug: p.slug,
    title: p.title,
    part: p.seriesPart != null ? Number(p.seriesPart) : null,
  })

  return {
    prev: idx > 0 ? toNav(inSeries[idx - 1]) : null,
    next: idx >= 0 && idx < inSeries.length - 1 ? toNav(inSeries[idx + 1]) : null,
  }
}

export type SeriesShowcasePart = {
  slug: string
  title: string
  part: number | null
  date: string
}

export type SeriesShowcase = {
  name: string
  description: string
  parts: SeriesShowcasePart[]
}

// How many series bands the homepage will show at once, newest-active first.
export const MAX_FEATURED_SERIES = 3

// Series to feature on the homepage, ordered by recency (the series whose newest
// part is most recent comes first), capped at MAX_FEATURED_SERIES. Each series'
// parts are ordered by `seriesPart`, with a short description from the first
// part's excerpt. Empty when no post has a series.
export function getFeaturedSeries(): SeriesShowcase[] {
  const posts = getAllPosts(['slug', 'title', 'series', 'seriesPart', 'date', 'excerpt'])

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

  return order
    // Only feature a series once it has at least two published parts; a lone
    // Part 1 stays an ordinary card in the grid until Part 2 ships.
    .filter((name) => groups[name].length >= 2)
    .slice(0, MAX_FEATURED_SERIES)
    .map((name) => {
      const parts = groups[name]
        .slice()
        .sort((a, b) => Number(a.seriesPart ?? 0) - Number(b.seriesPart ?? 0))
      return {
        name,
        description: (parts[0]?.excerpt as string) ?? '',
        parts: parts.map((p) => ({
          slug: p.slug as string,
          title: p.title as string,
          part: p.seriesPart != null ? Number(p.seriesPart) : null,
          date: p.date as string,
        })),
      }
    })
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
