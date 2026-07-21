import Link from 'next/link'
import {seriesSlug} from '../lib/series'

type Props = {
  series?: string
  part?: number
  className?: string
}

// Small uppercase "eyebrow" shown above a post title to mark it as part of a
// series, e.g. "Offline-First KMP · Part 2". The series name links to the
// series overview page so readers can reach the full list from any part.
const SeriesLabel = ({ series, part, className = '' }: Props) => {
  if (!series) return null
  return (
    <p className={`uppercase tracking-widest font-semibold text-gray-500 ${className}`}>
      <Link href="/series/[slug]" as={`/series/${seriesSlug(series)}`} className="hover:underline">
        {series}
      </Link>
      {part ? ` · Part ${part}` : ''}
    </p>
  )
}

export default SeriesLabel
