// Single source of truth for plans + billing periods, shared by the home
// Pricing section and the Get Started page so they never drift apart.
//
// Trial model: every plan starts with a 7-day free trial. There is no separate
// "free trial" pack to pick — the trial is baked into each plan. When the 7
// days end, the plan begins automatically; cancelling before then avoids any
// charge.
export const TRIAL_DAYS = 7;

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
    audience: "New gyms or small fitness studios testing the system",
    price: 29,
    credits: "500 AI credits / month",
    note: "For a first store finding its feet",
    features: [
      "1 store",
      "AI Storefront Studio — pages, copy, and SEO built for you",
      "Community support",
    ],
    cta: "Start 7-day free trial",
    highlighted: false,
  },
  {
    id: "growth",
    name: "Grow",
    badge: "Most popular",
    audience: "Growing gyms that want full control and automation",
    price: 79,
    credits: "1,500 AI credits / month",
    note: "For brands ready to market like a team of ten",
    features: [
      "Everything in Launch, plus",
      "Full AI Marketing Suite — social, campaigns, ads, and SEO",
      "Custom domain and business email included",
      "Priority support",
    ],
    cta: "Start 7-day free trial",
    highlighted: true,
  },
  {
    id: "pro",
    name: "Pro",
    badge: null,
    audience: "Established gyms or multi-branch fitness businesses",
    price: 149,
    credits: "4,000 AI credits / month",
    note: "For brands scaling content and campaigns",
    features: [
      "Everything in Grow, plus",
      "Higher limits across the whole suite",
      "Advanced analytics and reporting",
      "Priority support",
    ],
    cta: "Start 7-day free trial",
    highlighted: false,
  },
  {
    id: "scale",
    name: "Scale",
    badge: "Best value",
    audience: "Multi-branch operators who want the phones answered too",
    price: 349,
    credits: "10,000 AI credits / month",
    note: "For operators who want the phones answered too",
    features: [
      "Everything in Pro, plus",
      "AI Call Center answers customers around the clock",
      "Multi-store",
      "Dedicated onboarding",
    ],
    cta: "Start 7-day free trial",
    highlighted: false,
  },
];

// Price for a plan under a given billing period.
export function priceFor(plan, billingId) {
  const b = BILLING.find((x) => x.id === billingId) || BILLING[0];
  return Math.round(plan.price * (1 - b.discount));
}
