import { useEffect, useRef } from 'react'
import markdownStyles from './markdown-styles.module.css'

type Props = {
  content: string
}

const PostBody = ({ content }: Props) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const embed = target?.closest<HTMLElement>('.youtube-embed')
      if (!embed || embed.dataset.activated === 'true') return

      const videoId = embed.dataset.youtubeId
      if (!videoId) return

      event.preventDefault()
      embed.dataset.activated = 'true'

      const iframe = document.createElement('iframe')
      iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`
      iframe.title = 'YouTube video player'
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
      iframe.allowFullscreen = true

      embed.replaceChildren(iframe)
    }

    root.addEventListener('click', handleClick)
    return () => root.removeEventListener('click', handleClick)
  }, [content])

  return (
    <div className="max-w-2xl mx-auto">
      <div
        ref={ref}
        className={markdownStyles['markdown']}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  )
}

export default PostBody