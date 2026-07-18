type Props = {
  series?: string
  part?: number
  className?: string
}

// Small uppercase "eyebrow" shown above a post title to mark it as part of a
// series, e.g. "Offline-First KMP · Part 2".
const SeriesLabel = ({ series, part, className = '' }: Props) => {
  if (!series) return null
  return (
    <p className={`uppercase tracking-widest font-semibold text-gray-500 ${className}`}>
      {series}
      {part ? ` · Part ${part}` : ''}
    </p>
  )
}

export default SeriesLabel