# Gilroy font files

Drop the licensed Gilroy web fonts here so the design-system typography renders
exactly as in Figma. The stylesheet (`app/globals.css`) already references:

- `Gilroy-Regular.woff2` (400)
- `Gilroy-SemiBold.woff2` (600)
- `Gilroy-Bold.woff2` (700)

Gilroy is a commercial typeface, so the files are not bundled with this repo.
Until they are added, the layout gracefully falls back to the system sans-serif
stack declared in `tailwind.config.js` — no build errors, just a substitute font.
