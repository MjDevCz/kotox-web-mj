import MetaDataView from './meta-data-view'
import DateFormatter from './date-formatter'
import CoverImage from './cover-image'
import PostTitle from './post-title'
import type MetaDataType from '../interfaces/meta-data-type'

type Props = {
  title: string
  coverImage: string
  date: string
  metaData: MetaDataType
}

const PostHeader = ({ title, coverImage, date, metaData }: Props) => {
  return (
    <>
      <PostTitle>{title}</PostTitle>
      <div className="hidden md:block md:mb-12">
        <MetaDataView name={metaData.name} picture={metaData.picture} tags={metaData.tags} />
      </div>
        {coverImage.length>0 &&
          <div className="mb-8 md:mb-16 sm:mx-0">
            <CoverImage title={title} src={coverImage} />
          </div>
        }
      <div className="max-w-2xl mx-auto">
        <div className="block md:hidden mb-6">
          <MetaDataView name={metaData.name} picture={metaData.picture} tags={metaData.tags} />
        </div>
        <div className="mb-6 text-lg">
          <DateFormatter dateString={date} />
        </div>
      </div>
    </>
  )
}

export default PostHeader
