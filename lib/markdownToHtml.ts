import { remark } from 'remark'
import html from 'remark-html'

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

export default async function markdownToHtml(markdown: string) {
  const result = await remark().use(html, { sanitize: false }).process(expandYouTubeShortcodes(markdown))
  return openExternalLinksInNewTab(result.toString())
}