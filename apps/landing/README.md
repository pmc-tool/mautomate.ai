# mAutomate — Landing Page

A responsive landing page for **mAutomate**, an all-in-one AI ecommerce automation
platform. Built from the Figma design frame with **Next.js (App Router)**,
**Tailwind CSS**, and **Ant Design**.

## Tech stack

- **Next.js 14** (App Router, JSX)
- **Tailwind CSS 3** — design tokens live in [`tailwind.config.js`](tailwind.config.js)
- **Ant Design 5** — used for the FAQ accordion, themed via [`lib/antdTheme.js`](lib/antdTheme.js)
- **Gilroy** typography (Regular / SemiBold / Bold) with a system fallback stack

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

Build for production:

```bash
npm run build
npm start
```

## Project structure

```
app/
  layout.jsx        Root layout, AntD registry + theme, metadata
  page.jsx          Landing page composition
  globals.css       Tailwind layers, @font-face, reveal animation
components/
  Header.jsx        Sticky nav + responsive mobile drawer
  Hero.jsx          Headline + animated dashboard mockup
  WhyAutomate.jsx   Four feature cards
  PlatformFeatures.jsx  Interactive features accordion + social visual
  HowItWorks.jsx    Three-step launch flow
  Pricing.jsx       Four pricing plans
  Faq.jsx           Ant Design Collapse accordion
  Footer.jsx        Promo card, link columns, newsletter
  AnimatedSection.jsx  IntersectionObserver reveal wrapper (0.3 threshold)
  Logo.jsx / icons.jsx  Inline SVG brand assets
lib/
  antdTheme.js      Shared Ant Design token overrides
```

## Design notes

- **Responsive** from mobile up to a `max-width: 1440px` desktop frame (the Figma
  canvas width), centered via the Tailwind `container`/`shell` helpers.
- **Entrance animations** use a single `IntersectionObserver` per section at a
  `0.3` threshold, reduced-motion aware.
- **Hover states** (scale / opacity / translate / shadow) on every interactive
  element — nav links, buttons, cards, and social icons.
- **Assets**: the Figma frame's illustrations (glowing orb, analytics cards,
  social bubbles) are reconstructed with CSS + inline SVG. Swap in exported
  Figma images under `public/` if pixel-exact raster assets are required.
- **Fonts**: add the licensed Gilroy `.woff2` files to `public/fonts/`
  (see the README there). The layout falls back to the system sans stack until then.
