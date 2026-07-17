import MetaDataView from './meta-data-view'
import DateFormatter from './date-formatter'
import CoverImage from './cover-image'
import SeriesLabel from './series-label'
import Link from 'next/link'
import type MetaDataType from '../interfaces/meta-data-type'

type Props = {
  title: string
  series?: string
  seriesPart?: number
  coverImage: string
  coverBlurDataURL?: string | null
  date: string
  excerpt: string
  metaData: MetaDataType
  slug: string
}

const HeroPost = ({
  title,
  series,
  seriesPart,
  coverImage,
  coverBlurDataURL,
  date,
  excerpt,
  metaData,
  slug,
}: Props) => {
  return (
    <section>
      <div className="mb-8 md:mb-16">
        <CoverImage title={title} src={coverImage} slug={slug} blurDataURL={coverBlurDataURL} priority />
      </div>
      <div className="md:grid md:grid-cols-2 md:gap-x-16 lg:gap-x-8 mb-20 md:mb-28">
        <div>
          <SeriesLabel series={series} part={seriesPart} className="text-sm mb-3" />
          <h3 className="mb-4 text-4xl lg:text-5xl leading-tight">
            <Link
              as={`/posts/${slug}`}
              href="/posts/[slug]"
              className="hover:underline"
            >
              {title}
            </Link>
          </h3>
          <div className="mb-4 md:mb-0 text-lg">
            <DateFormatter dateString={date} />
          </div>
        </div>
        <div>
          <p className="text-lg leading-relaxed mb-4">{excerpt}</p>
          <MetaDataView name={metaData.name} picture={metaData.picture} tags={metaData.tags} />
        </div>
      </div>
    </section>
  )
}

export default HeroPost
