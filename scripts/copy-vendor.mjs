// Copies the libraries that are preloaded (but hidden) in every student page
// into public/vendor so they are served from our own Hosting, not a CDN.
import { copyFileSync, mkdirSync, rmSync } from 'node:fs'

const files = [
  // Tailwind v3 Play CDN build (see vendor/README.md for why v3).
  ['vendor/tailwindcss-play-3.4.17.js', 'public/vendor/tailwind.js'],
  ['node_modules/gsap/dist/gsap.min.js', 'public/vendor/gsap.min.js'],
  ['node_modules/gsap/dist/ScrollTrigger.min.js', 'public/vendor/ScrollTrigger.min.js'],
]

rmSync('public/vendor', { recursive: true, force: true })
mkdirSync('public/vendor', { recursive: true })
for (const [from, to] of files) copyFileSync(from, to)
console.log(`vendor: copied ${files.length} files to public/vendor`)
