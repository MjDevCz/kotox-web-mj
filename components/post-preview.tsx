import MetaDataView from './meta-data-view'
import DateFormatter from './date-formatter'
import CoverImage from './cover-image'
import Link from 'next/link'
import type MetaDataType from '../interfaces/meta-data-type'

type Props = {
  title: string
  coverImage: string
  coverBlurDataURL?: string | null
  date: string
  excerpt: string
  metaData: MetaDataType
  slug: string
}

const PostPreview = ({
  title,
  coverImage,
  coverBlurDataURL,
  date,
  excerpt,
  metaData,
  slug,
}: Props) => {
  return (
    <div>
      <div className="mb-5">
        <CoverImage slug={slug} title={title} src={coverImage} blurDataURL={coverBlurDataURL} />
      </div>
      <h3 className="text-3xl mb-3 leading-snug">
        <Link
          as={`/posts/${slug}`}
          href="/posts/[slug]"
          className="hover:underline"
        >
          {title}
        </Link>
      </h3>
      <div className="text-lg mb-4">
        <DateFormatter dateString={date} />
      </div>
      <p className="text-lg leading-relaxed mb-4">{excerpt}</p>
      <MetaDataView name={metaData.name} picture={metaData.picture} tags={metaData.tags} />
    </div>
  )
}

export default PostPreview
