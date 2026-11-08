import { remark } from 'remark'
import html from 'remark-html'
import { createHighlighter, type Highlighter } from 'shiki'
import { getLocalImageMeta } from './coverBlur'

// Languages the posts use in fenced code blocks. A fence with any other
// language, or none, stays plain text (logs, HTTP traces, step flows).
const CODE_LANGS = ['kotlin', 'typescript', 'javascript', 'sql', 'json', 'bash', 'yaml']
const CODE_THEME = 'github-light'

let highlighter: Promise<Highlighter> | null = null

function getHighlighter(): Promise<Highlighter> {
  highlighter ??= createHighlighter({ themes: [CODE_THEME], langs: CODE_LANGS })
  return highlighter
}

const CODE_BLOCK = /<pre><code class="language-([\w-]+)">([\s\S]*?)<\/code><\/pre>/g

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
}

// Colour fenced code blocks at build time, so readers get syntax highlighting
// without any client-side JavaScript.
async function highlightCodeBlocks(htmlString: string): Promise<string> {
  if (!htmlString.includes('<pre><code class="language-')) return htmlString
  const shiki = await getHighlighter()
  return htmlString.replace(CODE_BLOCK, (block, lang: string, code: string) => {
    const language = lang === 'ts' ? 'typescript' : lang === 'js' ? 'javascript' : lang === 'kt' ? 'kotlin' : lang
    if (!CODE_LANGS.includes(language)) return block
    return shiki.codeToHtml(decodeHtmlEntities(code).replace(/\n$/, ''), { lang: language, theme: CODE_THEME })
  })
}

const YOUTUBE_SHORTCODE = /@\[youtube\]\(([\w-]{6,})\)/g

function renderYouTubeFacade(videoId: string): string {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`
  const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  return [
    `<div class="youtube-embed" data-youtube-id="${videoId}">`,
    `<a class="youtube-embed-link" href="${watchUrl}" target="_blank" rel="noopener noreferrer" aria-label="Watch on YouTube">`,
    `<img class="youtube-embed-thumb" src="${thumbnail}" alt="" loading="lazy" />`,
    `<svg class="youtube-embed-play" viewBox="0 0 68 48" aria-hidden="true" focusable="false">`,
    `<path d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55C3.97 2.33 2.27 4.81 1.48 7.74 0 13.05 0 24 0 24s0 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C68 34.95 68 24 68 24s0-10.95-1.48-16.26z" fill="#f00"/>`,
    `<path d="M45 24L27 14v20z" fill="#fff"/>`,
    `</svg>`,
    `</a>`,
    `</div>`,
  ].join('')
}

function expandYouTubeShortcodes(markdown: string): string {
  return markdown.replace(YOUTUBE_SHORTCODE, (_, id) => `\n\n${renderYouTubeFacade(id)}\n\n`)
}

function openExternalLinksInNewTab(htmlString: string): string {
  return htmlString.replace(
    /<a href="(https?:\/\/[^"]+)">/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">'
  )
}

// Tag a paragraph that opens with a bold "TL;DR" so it can be styled as a lead.
function styleTldr(htmlString: string): string {
  return htmlString.replace(
    /<p>(<strong>TL;DR<\/strong>)/,
    '<p class="tldr">$1'
  )
}

// Give every h2/h3 a GitHub-style slug id so a link can point at a section
// ("Mint the ID, and Make It Travel" → #mint-the-id-and-make-it-travel).
function addHeadingIds(htmlString: string): string {
  const seen = new Map<string, number>()
  return htmlString.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_, level, inner) => {
    const base = inner
      .replace(/<[^>]+>/g, '')
      .replace(/&[a-z]+;|&#\d+;/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    const id = count === 0 ? base : `${base}-${count}`
    return `<h${level} id="${id}">${inner}</h${level}>`
  })
}

const IMG_TAG = /<img\s+([^>]*?)\s*\/?>/g

function getAttr(attrs: string, name: string): string | null {
  const m = new RegExp(`${name}="([^"]*)"`).exec(attrs)
  return m ? m[1] : null
}

function escapeHtmlAttr(value: string): string {
  return value.replace(/"/g, '&quot;')
}

async function enrichLocalImages(htmlString: string): Promise<string> {
  type Hit = { start: number; end: number; src: string; alt: string }
  const hits: Hit[] = []
  let m: RegExpExecArray | null
  IMG_TAG.lastIndex = 0
  while ((m = IMG_TAG.exec(htmlString)) !== null) {
    const attrs = m[1]
    const src = getAttr(attrs, 'src')
    if (!src || !src.startsWith('/')) continue
    if (/class="[^"]*youtube-embed-thumb/.test(attrs)) continue
    hits.push({
      start: m.index,
      end: m.index + m[0].length,
      src,
      alt: getAttr(attrs, 'alt') ?? '',
    })
  }

  if (hits.length === 0) return htmlString

  const replacements = await Promise.all(
    hits.map(async (hit) => {
      const meta = await getLocalImageMeta(hit.src)
      if (!meta) return null
      const alt = escapeHtmlAttr(hit.alt)
      const blur = escapeHtmlAttr(meta.blurDataURL)
      return [
        `<span class="blur-img" style="aspect-ratio:${meta.width}/${meta.height};background-image:url(&quot;${blur}&quot;)">`,
        `<img src="${hit.src}" alt="${alt}" width="${meta.width}" height="${meta.height}" loading="lazy" decoding="async" />`,
        `</span>`,
      ].join('')
    })
  )

  const out: string[] = []
  let cursor = 0
  hits.forEach((hit, i) => {
    const replacement = replacements[i]
    if (!replacement) return
    out.push(htmlString.slice(cursor, hit.start))
    out.push(replacement)
    cursor = hit.end
  })
  out.push(htmlString.slice(cursor))
  return out.join('')
}

type Options = {
  enrichImages?: boolean
}

export default async function markdownToHtml(markdown: string, options: Options = {}) {
  const result = await remark().use(html, { sanitize: false }).process(expandYouTubeShortcodes(markdown))
  let htmlString = addHeadingIds(styleTldr(openExternalLinksInNewTab(result.toString())))
  htmlString = await highlightCodeBlocks(htmlString)
  if (options.enrichImages) {
    htmlString = await enrichLocalImages(htmlString)
  }
  return htmlString
}
