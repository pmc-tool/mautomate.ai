// Shared site configuration: external app URLs + navigation, so every page and
// the header/footer stay in sync. The current landing sends "Log in" and
// "Get Started" to the merchant dashboard, which redirects to auth when needed.
export const APP_URL = "https://merchant.mautomate.ai/dashboard/overview";
export const LOGIN_URL = APP_URL;
export const SIGNUP_URL = APP_URL;
export const CONTACT_EMAIL = "hello@mautomate.com";

// The Get Started page collects the plan choice, then hands off to our own
// /signup page (the real account-creation flow, restored from the old landing).
export const GET_STARTED_URL = "/get-started";
export const SIGNUP_PAGE = "/signup";

// Signup goes SAME-ORIGIN through the landing server, which proxies to the
// backend's /platform/signup + /platform/signup/status. This avoids CORS and
// survives api.mautomate.ai edge blips (the old landing hit that host directly).
export const SIGNUP_PATH = "/api/signup";
export const SIGNUP_STATUS_PATH = "/api/signup/status";

// Stores are provisioned as <slug>.mautomate.ai.
export const STORE_DOMAIN = "mautomate.ai";

// Build the /signup URL for a chosen plan + billing period. The 7-day trial is
// baked into every plan; there is no separate free-trial pack.
export function trialSignupUrl(planId, billingId) {
  const params = new URLSearchParams();
  if (planId) params.set("plan", planId);
  if (billingId) params.set("billing", billingId);
  const qs = params.toString();
  return qs ? `${SIGNUP_PAGE}?${qs}` : SIGNUP_PAGE;
}

// Slugify a store name into a subdomain-safe slug — matches the old landing's
// rule so the same names produce the same slugs.
export function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-/, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

// Primary nav. Home sections are absolute (`/#id`) so they work from any page;
// dedicated pages link to their route.
export const NAV = [
  { label: "Use cases", href: "/#use-cases" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "Blog", href: "/blog" },
  { label: "About", href: "/about" },
  { label: "FAQ", href: "/faq" },
];

export const FOOTER_COLUMNS = [
  {
    title: "Platform",
    links: [
      { label: "Use cases", href: "/#use-cases" },
      { label: "How it works", href: "/#how-it-works" },
      { label: "Reviews", href: "/#reviews" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "FAQ", href: "/faq" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Log in", href: APP_URL },
      { label: "Get started", href: GET_STARTED_URL },
    ],
  },
];
