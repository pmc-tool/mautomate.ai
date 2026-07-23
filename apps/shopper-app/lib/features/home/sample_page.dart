/// A local sample home page in the CMS-snapshot shape, used as a fallback when
/// the live store/app-render endpoint is unavailable (offline dev, or before a
/// publishable key is stamped into the build). It exercises the pipeline end to
/// end: known blocks render natively; the deliberate `unknown_future_block`
/// proves the graceful fallback.
///
/// Shape mirrors `/store/cms/pages/:slug` -> `{ page: { sections: [...] } }`.
const Map<String, dynamic> kSampleHomePage = {
  "page": {
    "slug": "home",
    "locale": "en",
    "meta": {"title": "Home", "is_home": true},
    "sections": [
      {
        "block_type": "hero_slider",
        "schema_version": 1,
        "autoplay_ms": 5000,
        "slides": [
          {
            "image":
                "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1200&q=80",
            "subtitle": "Handicraft shop",
            "title": "Inspired by Your\\nSweetest Dreams",
            "cta": {"label": "Shop now", "href": "/store"}
          }
        ]
      },
      {
        "block_type": "rich_text",
        "schema_version": 1,
        "width": "normal",
        "html":
            "<h2>Our Story</h2><p>Forever Finds is an online shop for handicrafts and arts' works. We craft beautiful pieces by hand, pairing useful tools with creativity.</p>"
      },
      {
        "block_type": "product_tabs",
        "schema_version": 1,
        "tabs": [
          {"label": "New arrivals", "source": "all", "limit": 4},
          {"label": "Best sellers", "source": "all", "limit": 4}
        ]
      },
      {
        "block_type": "image_with_text",
        "schema_version": 1,
        "image":
            "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=1200&q=80",
        "image_side": "left",
        "eyebrow": "Limited edition",
        "title": "Decorative Box for New Aspiration",
        "body": "Hand-finished pieces, made to last a lifetime.",
        "cta": {"label": "Explore", "href": "/store"}
      },
      {
        // Deliberately unregistered: proves the graceful fallback path.
        "block_type": "unknown_future_block",
        "schema_version": 0,
        "foo": "bar"
      }
    ]
  }
};
