// Central schema.org / JSON-LD source of truth. Feeding AI answer engines and
// Google rich results a clean, consistent entity graph is the single highest-
// impact on-page SEO/AEO win — the site previously shipped zero structured data.
//
// Rendered via <JsonLd> (components/JsonLd.jsx). Keep every field here in sync
// with what is visibly on the page: Google penalises schema/content mismatch.

export const SITE_URL = "https://mautomate.ai";
export const SITE_NAME = "mAutomate";
export const LOGO_URL = `${SITE_URL}/assets/logo.png`;
export const OG_IMAGE_URL = `${SITE_URL}/og.png`;

const SAME_AS = [
  // Fill in as official profiles go live — these strengthen entity resolution
  // across Google's Knowledge Graph and the corpora AI engines retrieve from.
  "https://www.linkedin.com/company/mautomate",
  "https://x.com/mautomate",
];

// Organization — the brand entity. Site-wide.
export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: SITE_NAME,
  legalName: "mAutomate",
  url: SITE_URL,
  logo: {
    "@type": "ImageObject",
    url: LOGO_URL,
  },
  description:
    "mAutomate is an all-in-one AI commerce platform that builds, runs, markets, and supports your online store from a single dashboard.",
  sameAs: SAME_AS,
};

// WebSite — enables the sitelinks search box and names the publisher entity.
export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: SITE_NAME,
  url: SITE_URL,
  publisher: { "@id": `${SITE_URL}/#organization` },
  inLanguage: "en",
};

// SoftwareApplication — the product entity, with the real plan price range as
// offers. This is what an AI engine reads to answer "how much does it cost".
export function softwareApplicationSchema(plans) {
  const prices = (plans || []).map((p) => p.price).filter((n) => typeof n === "number");
  const low = prices.length ? Math.min(...prices) : 29;
  const high = prices.length ? Math.max(...prices) : 349;
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#software`,
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "E-commerce Platform",
    operatingSystem: "Web",
    url: SITE_URL,
    description:
      "AI commerce platform: an AI builds your online store, then markets it, supports customers, and runs operations from one dashboard.",
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: String(low),
      highPrice: String(high),
      offerCount: String((plans || []).length || 4),
      availability: "https://schema.org/InStock",
    },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

// FAQPage — the question/answer set on a page, formatted for AI extraction and
// Google's FAQ rich result. Pass an array of { q, a }.
export function faqSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: (items || []).map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

// BreadcrumbList — helps engines understand site hierarchy on inner pages.
// Pass an array of { name, path } from home down to the current page.
export function breadcrumbSchema(trail) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: (trail || []).map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: `${SITE_URL}${crumb.path}`,
    })),
  };
}
