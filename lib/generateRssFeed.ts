import {getAllPosts} from './api'
import {CMS_DOMAIN, CMS_INTRO} from './constants'

export function generateRssFeed(): string {
    const posts = getAllPosts(['title', 'date', 'slug', 'excerpt'])

    const items = posts
        .map(
            (post) => `    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${CMS_DOMAIN}/posts/${post.slug}</link>
      <guid>${CMS_DOMAIN}/posts/${post.slug}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <description><![CDATA[${post.excerpt}]]></description>
    </item>`
        )
        .join('\n')

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${CMS_INTRO}</title>
    <link>${CMS_DOMAIN}</link>
    <description>${CMS_INTRO}</description>
    <language>en</language>
    <atom:link href="${CMS_DOMAIN}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`
}