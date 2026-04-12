import { remark } from 'remark'
import html from 'remark-html'

function openExternalLinksInNewTab(htmlString: string): string {
  return htmlString.replace(
    /<a href="(https?:\/\/[^"]+)">/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">'
  )
}

export default async function markdownToHtml(markdown: string) {
  const result = await remark().use(html).process(markdown)
  return openExternalLinksInNewTab(result.toString())
}
