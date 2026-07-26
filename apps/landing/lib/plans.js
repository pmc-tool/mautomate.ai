// Single source of truth for plans + billing periods, shared by the home
// Pricing section and the Get Started page so they never drift apart.
//
// Trial model: signup starts a 14-day free trial (no card). Picking a plan
// during or after the trial starts the subscription. This copy must match the
// platform_package rows — the enforced entitlement matrix lives in the
// backend; this file only describes it.
export const TRIAL_DAYS = 14;

// Billing periods and the discount each applies to the monthly base price.
export const BILLING = [
  { id: "monthly", label: "Monthly", discount: 0 },
  { id: "6months", label: "6 Months", discount: 0.1, save: "Save 10%" },
  { id: "yearly", label: "Yearly", discount: 0.25, save: "Save 25%" },
];

export const fmt = (n) => `$${Math.round(n).toLocaleString("en-US")}`;

// `id` is a stable slug handed off to signup (?plan=<id>) so the checkout can
// pre-select the chosen pack.
export const PLANS = [
  {
    id: "starter",
    name: "Launch",
    badge: null,
    audience: "New stores getting off the ground",
    price: 29,
    credits: "500 AI credits / month",
    note: "For a first store finding its feet",
    features: [
      "1 store with 100 products and 5 GB media",
      "AI Storefront Studio — pages, copy, and SEO built for you",
      "Community support",
    ],
    cta: "Start 14-day free trial",
    highlighted: false,
  },
  {
    id: "growth",
    name: "Grow",
    badge: "Most popular",
    audience: "Growing brands that want full control and automation",
    price: 79,
    credits: "1,500 AI credits / month",
    note: "For brands ready to market like a team of ten",
    features: [
      "Everything in Launch, plus",
      "Custom domain included",
      "Full AI Marketing Suite — social, campaigns, ads, and SEO",
      "Jarvis voice — talk to your store, for real",
      "All messaging channels including WhatsApp",
      "1,000 products and 25 GB media",
      "Priority support",
    ],
    cta: "Start 14-day free trial",
    highlighted: true,
  },
  {
    id: "pro",
    name: "Pro",
    badge: null,
    audience: "Established brands scaling content and campaigns",
    price: 149,
    credits: "4,000 AI credits / month",
    note: "For brands scaling content and campaigns",
    features: [
      "Everything in Grow, plus",
      "AI Call Center answers on your website, live",
      "Ads autopilot",
      "10,000 products and 100 GB media",
      "3 custom domains",
      "Advanced analytics and reporting",
      "Priority chat support",
    ],
    cta: "Start 14-day free trial",
    highlighted: false,
  },
  {
    id: "scale",
    name: "Scale",
    badge: "Best value",
    audience: "High-volume brands that want the phones answered too",
    price: 349,
    credits: "10,000 AI credits / month",
    note: "For operators who want the phones answered too",
    features: [
      "Everything in Pro, plus",
      "AI Call Center with a real phone number",
      "Unlimited products, 500 GB media",
      "10 custom domains",
      "Dedicated onboarding",
    ],
    cta: "Start 14-day free trial",
    highlighted: false,
  },
];

// Price for a plan under a given billing period.
export function priceFor(plan, billingId) {
  const b = BILLING.find((x) => x.id === billingId) || BILLING[0];
  return Math.round(plan.price * (1 - b.discount));
}
