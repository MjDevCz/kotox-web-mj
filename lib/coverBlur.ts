import sharp from 'sharp'
import { join } from 'path'

export async function getCoverBlurDataURL(coverPath: string): Promise<string | null> {
  if (!coverPath) return null
  const abs = join(process.cwd(), 'public', coverPath.replace(/^\//, ''))
  const buf = await sharp(abs)
    .resize(16, undefined, { fit: 'inside' })
    .jpeg({ quality: 50 })
    .toBuffer()
  return `data:image/jpeg;base64,${buf.toString('base64')}`
}
