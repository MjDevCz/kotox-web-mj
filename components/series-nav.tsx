import Link from 'next/link'
import type { SeriesNavItem } from '../lib/api'

type Props = {
  prev?: SeriesNavItem | null
  next?: SeriesNavItem | null
}

const SeriesNav = ({ prev, next }: Props) => {
  if (!prev && !next) return null
  return (
    <nav className="max-w-2xl mx-auto mb-24 border-t border-gray-200 pt-8 grid grid-cols-2 gap-6">
      <div>
        {prev && (
          <Link
            as={`/posts/${prev.slug}`}
            href="/posts/[slug]"
            className="group block no-underline"
          >
            <span className="block text-xs uppercase tracking-widest text-gray-500 mb-1">
              ← Previous{prev.part ? ` · Part ${prev.part}` : ''}
            </span>
            <span className="text-lg leading-snug group-hover:underline">{prev.title}</span>
          </Link>
        )}
      </div>
      <div className="text-right">
        {next && (
          <Link
            as={`/posts/${next.slug}`}
            href="/posts/[slug]"
            className="group block no-underline"
          >
            <span className="block text-xs uppercase tracking-widest text-gray-500 mb-1">
              Next{next.part ? ` · Part ${next.part}` : ''} →
            </span>
            <span className="text-lg leading-snug group-hover:underline">{next.title}</span>
          </Link>
        )}
      </div>
    </nav>
  )
}

export default SeriesNav
