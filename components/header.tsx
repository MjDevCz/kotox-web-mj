import Link from 'next/link'

const Header = () => {
  return (
    <div className="mb-20 mt-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-4 py-2 text-lg font-semibold text-neutral-800 transition-colors hover:bg-neutral-100 hover:border-neutral-400"
      >
        <span aria-hidden="true">←</span>
        MJ Stories
      </Link>
    </div>
  )
}

export default Header