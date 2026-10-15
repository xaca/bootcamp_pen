# Vendored libraries

`tailwindcss-play-3.4.17.js` is Tailwind CSS's v3 Play CDN build, downloaded from
https://cdn.tailwindcss.com/3.4.17 (MIT license). It isn't published on npm, so it lives here.

We use v3 (not v4) because Gemini and ChatGPT write pages for the v3 CDN, including
`tailwind.config = { ... }` for custom colors and fonts, which v4 doesn't support.

`scripts/copy-vendor.mjs` copies it to `public/vendor/tailwind.js`.
