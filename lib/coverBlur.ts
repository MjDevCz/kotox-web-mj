import sharp from 'sharp'
import { join } from 'path'

function resolvePublic(path: string): string {
  return join(process.cwd(), 'public', path.replace(/^\//, ''))
}

export async function getCoverBlurDataURL(coverPath: string): Promise<string | null> {
  if (!coverPath) return null
  const buf = await sharp(resolvePublic(coverPath))
    .resize(16, undefined, { fit: 'inside' })
    .jpeg({ quality: 50 })
    .toBuffer()
  return `data:image/jpeg;base64,${buf.toString('base64')}`
}

export type LocalImageMeta = {
  width: number
  height: number
  blurDataURL: string
}

export async function getLocalImageMeta(imagePath: string): Promise<LocalImageMeta | null> {
  if (!imagePath.startsWith('/')) return null
  try {
    const image = sharp(resolvePublic(imagePath))
    const [metadata, blurBuf] = await Promise.all([
      image.metadata(),
      image.clone().resize(16, undefined, { fit: 'inside' }).jpeg({ quality: 50 }).toBuffer(),
    ])
    if (!metadata.width || !metadata.height) return null
    return {
      width: metadata.width,
      height: metadata.height,
      blurDataURL: `data:image/jpeg;base64,${blurBuf.toString('base64')}`,
    }
  } catch {
    return null
  }
}
