import { mkdir, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, '..', 'public')
const outDir = path.join(publicDir, 'icons')
const candidates = [
  path.join(outDir, 'pwa-180.png'),
  path.join(publicDir, 'logo-1.png'),
]

async function resolveSource() {
  for (const file of candidates) {
    try {
      await access(file)
      return file
    } catch {
      /* try next */
    }
  }
  throw new Error(
    'Nenhuma arte-fonte encontrada. Coloque logo-1.png em public/ ou o exemplo em public/icons/pwa-180.png',
  )
}

async function squareIcon(source, size, { padRatio = 0.12, bg = '#0e1624' } = {}) {
  const inner = Math.round(size * (1 - padRatio * 2))
  const logo = await sharp(source)
    .resize({
      width: inner,
      height: inner,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: bg,
    },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toBuffer()
}

await mkdir(outDir, { recursive: true })
const source = await resolveSource()
console.log('source', source)

const targets = [
  { name: 'pwa-180.png', size: 180, padRatio: 0.1 },
  { name: 'pwa-192.png', size: 192, padRatio: 0.1 },
  { name: 'pwa-512.png', size: 512, padRatio: 0.1 },
  { name: 'pwa-512-maskable.png', size: 512, padRatio: 0.2 },
]

for (const t of targets) {
  const buf = await squareIcon(source, t.size, { padRatio: t.padRatio })
  const file = path.join(outDir, t.name)
  await sharp(buf).toFile(file)
  const meta = await sharp(file).metadata()
  console.log('wrote', file, `${meta.width}x${meta.height}`)
}
