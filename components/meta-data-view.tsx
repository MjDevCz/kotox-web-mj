type Props = {
    name: string,
    picture: string,
    tags: Array<string>,
}

const MetaDataView = ({name, picture, tags}: Props) => {
    return (
        <div className="flex flex-wrap items-center">
            {picture != '' ? <img src={picture} className="w-12 h-12 p2 mr-4" alt={name}/> : ""}
            <div className="flex flex-wrap text-xl font-semibold space-x-4">
                {tags.map(tag => {
                    return (
                        <span key={tag} className="rounded outline p-1 m-1">
                            {tag}
                        </span>
                    )
                })}
            </div>
        </div>
    )
}

export default MetaDataView
