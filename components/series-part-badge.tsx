type Props = {
  part: number | null
  highlight?: boolean
  className?: string
}

// The numbered circle in front of each part in a series list. Highlighted
// (landmark) parts invert it: black disc, white number.
const SeriesPartBadge = ({ part, highlight = false, className = '' }: Props) => {
  const look = highlight
    ? 'border border-black bg-black text-white font-bold'
    : 'border border-gray-300 bg-white text-gray-600 font-semibold'
  return (
    <span
      className={`flex-shrink-0 flex items-center justify-center rounded-full ${look} ${className}`}
    >
      {part ?? '·'}
    </span>
  )
}

export default SeriesPartBadge
