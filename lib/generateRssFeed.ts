import {getAllPosts} from './api'
import {CMS_DOMAIN, CMS_INTRO} from './constants'
import markdownToHtml from './markdownToHtml'

export async function generateRssFeed(): Promise<string> {
    const posts = getAllPosts(['title', 'date', 'slug', 'excerpt', 'content'])

    const items = await Promise.all(
        posts.map(async (post) => {
            const contentHtml = await markdownToHtml(post.content || '')
            return `    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${CMS_DOMAIN}/posts/${post.slug}</link>
      <guid>${CMS_DOMAIN}/posts/${post.slug}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <description><![CDATA[${post.excerpt}]]></description>
      <content:encoded><![CDATA[${contentHtml}]]></content:encoded>
    </item>`
        })
    )

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${CMS_INTRO}</title>
    <link>${CMS_DOMAIN}</link>
    <description>${CMS_INTRO}</description>
    <language>en</language>
    <atom:link href="${CMS_DOMAIN}/feed.xml" rel="self" type="application/rss+xml"/>
${items.join('\n')}
  </channel>
</rss>
`
}
