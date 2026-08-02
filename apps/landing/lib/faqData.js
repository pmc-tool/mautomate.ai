// Shared FAQ question/answer set. Imported by the client accordion
// (components/Faq.jsx) AND by the /faq page's FAQPage JSON-LD, so the visible
// answers and the structured data can never drift apart (Google penalises
// schema/content mismatch). Answer-first phrasing helps AI-engine extraction.
export const FAQ_ITEMS = [
  {
    q: "What is mAutomate?",
    a: "mAutomate is an all-in-one AI business automation platform that helps you build websites, create AI content, automate marketing, support customers, and manage your business from a single dashboard.",
  },
  {
    q: "Can I automate my social media?",
    a: "Yes. Plan, generate, schedule, and publish content across every connected platform, then track performance—all from one place.",
  },
  {
    q: "Do I need any coding skills?",
    a: "None at all. The drag-and-drop website builder and AI assistants handle the technical work so you can focus on your business.",
  },
  {
    q: "How quickly can I launch my business?",
    a: "Most brands go live the same day. Tell the AI about your brand and it builds your storefront, domain, email, and first campaigns for you.",
  },
  {
    q: "Can I use my own custom domain?",
    a: "Absolutely. Connect an existing domain or register a new one, plus a matching business email, in just a few clicks.",
  },
  {
    q: "What can the AI create for me?",
    a: "Websites, product pages, marketing copy, social posts, ad campaigns, email flows, and customer-support replies—reviewed and approved by you.",
  },
];
