import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '..', 'public', 'icons')

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0e1624"/>
  <rect x="56" y="56" width="400" height="400" rx="72" fill="#152033"/>
  <text x="256" y="292" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="168" font-weight="700" fill="#b08d57">VT</text>
  <circle cx="400" cy="120" r="28" fill="#b08d57"/>
</svg>`

await mkdir(outDir, { recursive: true })

const sizes = [180, 192, 512]
for (const size of sizes) {
  const file = path.join(outDir, `pwa-${size}.png`)
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(file)
  console.log('wrote', file)
}

const maskable = path.join(outDir, 'pwa-512-maskable.png')
const maskableSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0e1624"/>
  <text x="256" y="292" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="140" font-weight="700" fill="#b08d57">VT</text>
</svg>`
await sharp(Buffer.from(maskableSvg)).resize(512, 512).png().toFile(maskable)
console.log('wrote', maskable)
