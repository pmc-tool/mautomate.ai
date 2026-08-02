// In-app robots — the repo becomes the source of truth. Next emits a static
// /robots.txt at build time (output:"export").
//
// IMPORTANT: this EXPLICITLY WELCOMES AI answer-engine crawlers. The live site
// previously blocked GPTBot/ClaudeBot/PerplexityBot/Google-Extended at the
// Cloudflare edge, which made mAutomate impossible to cite in ChatGPT, Claude,
// Perplexity, or Google AI Overviews. Being cited by those engines is a core
// AEO goal, so we allow them here.
//
// NOTE: because /robots.txt is currently served/overridden at the Cloudflare
// edge, this file alone does not unblock the AI crawlers in production — the
// Cloudflare-managed robots rules must ALSO be updated to remove the AI-bot
// Disallows and the `Content-Signal: ai-train=no`. This file keeps the intended
// policy versioned and correct going forward.

// Required so Next pre-renders /robots.txt at build time under output:"export".
export const dynamic = "force-static";

const SITE = "https://mautomate.ai";

// AI answer-engine + training crawlers we want to allow full access.
const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Bytespider",
  "Amazonbot",
  "meta-externalagent",
];

export default function robots() {
  return {
    rules: [
      // Everyone (incl. Googlebot/Bingbot) may crawl the public marketing site;
      // keep API and Next internals out of the index.
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/_next/"],
      },
      // Explicitly welcome AI answer-engine crawlers.
      {
        userAgent: AI_BOTS,
        allow: "/",
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
