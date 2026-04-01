import sharp from 'sharp'
import { mkdirSync } from 'fs'

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#16a34a" rx="80"/>
  <ellipse cx="256" cy="270" rx="130" ry="155" fill="white" opacity="0.92"/>
  <line x1="256" y1="440" x2="256" y2="180" stroke="#16a34a" stroke-width="22" stroke-linecap="round"/>
  <path d="M256 300 C210 268 168 278 148 316" stroke="#16a34a" stroke-width="18" stroke-linecap="round" fill="none"/>
  <path d="M256 348 C302 316 344 326 364 360" stroke="#16a34a" stroke-width="18" stroke-linecap="round" fill="none"/>
  <circle cx="256" cy="148" r="28" fill="white" opacity="0.92"/>
</svg>`

mkdirSync('public/icons', { recursive: true })

await sharp(Buffer.from(SVG)).resize(192, 192).png().toFile('public/icons/icon-192.png')
await sharp(Buffer.from(SVG)).resize(512, 512).png().toFile('public/icons/icon-512.png')

console.log('Íconos generados: public/icons/icon-192.png, public/icons/icon-512.png')
