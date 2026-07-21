import Link from 'next/link'
import DateFormatter from './date-formatter'
import type { SeriesShowcase as SeriesShowcaseData } from '../lib/api'

type Props = {
  series: SeriesShowcaseData
}

// A subtle, self-contained band that spotlights an ongoing series on the
// homepage: series title, a short blurb, and its parts laid out as a numbered
// row. Sits between the hero and the "More Stories" grid.
const SeriesShowcase = ({ series }: Props) => {
  const { name, slug, description, parts } = series
  if (parts.length === 0) return null

  return (
    <section className="mb-20 md:mb-28">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 md:p-12">
        <p className="uppercase tracking-widest font-semibold text-gray-500 text-sm mb-3">
          Series · {parts.length} {parts.length === 1 ? 'part' : 'parts'}
        </p>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tighter leading-tight mb-3">
          <Link href="/series/[slug]" as={`/series/${slug}`} className="hover:underline">
            {name}
          </Link>
        </h2>
        {description && (
          <p className="text-lg leading-relaxed text-gray-700 mb-8 max-w-3xl">{description}</p>
        )}
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {parts.map((part) => (
            <li key={part.slug}>
              <Link
                as={`/posts/${part.slug}`}
                href="/posts/[slug]"
                className="group flex gap-4 no-underline"
              >
                <span className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full border border-gray-300 bg-white text-sm font-semibold text-gray-600">
                  {part.part ?? '·'}
                </span>
                <span className="block">
                  <span className="block text-lg leading-snug group-hover:underline">
                    {part.title}
                  </span>
                  <span className="block text-sm text-gray-500 mt-1">
                    <DateFormatter dateString={part.date} />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export default SeriesShowcase