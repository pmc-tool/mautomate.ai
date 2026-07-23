# Brand assets

The footer loads two raster assets from this folder via `next/image`
(in `components/Footer.jsx`). **Save the attached PNGs here with these exact
names:**

| File (place in `public/assets/`) | Used for                     | Rendered at |
| -------------------------------- | ---------------------------- | ----------- |
| `logo.png`                       | mAutomate wordmark (footer)  | 170×40      |
| `3D-app-icon.png`                | 3D bag app icon (top-right)  | 112×112     |

Paths are referenced as `/assets/logo.png` and `/assets/3D-app-icon.png`.
The build succeeds even if the files are missing — they simply 404 at runtime
until added, so drop them in and refresh.

## Rendered in code (no file needed)

- **Green + orange gradient** on the promo card — reproduced with CSS
  `radial-gradient` + an SVG grain overlay (resolution-independent).
- `components/Logo.jsx` (SVG wordmark) is still used in the **header**.
- `components/AppIcon.jsx` (SVG 3D icon) remains as an optional vector fallback
  but is no longer referenced by the footer.
