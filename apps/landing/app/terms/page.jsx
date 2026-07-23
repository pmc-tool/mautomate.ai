import LegalDoc from "@/components/LegalDoc";

export const metadata = {
  title: "Terms of Service — mAutomate",
  description:
    "The terms for using mAutomate: trials and billing, AI actions, your responsibility for what ships, data ownership and export, and liability.",
};

const sections = [
  {
    heading: "1. Agreement to these terms",
    body: [
      "These Terms of Service govern your access to and use of mAutomate, the AI commerce platform provided by mAutomate. By creating an account, starting a trial, or using the service, you agree to these terms. If you are using mAutomate on behalf of a business, you confirm you have authority to bind that business to these terms.",
      "If you do not agree with these terms, do not use the service.",
    ],
  },
  {
    heading: "2. The service",
    body: [
      "mAutomate provides tools and AI agents that help you build, market, and run an online store — including designing storefronts, generating content, creating campaigns, and automating routine commerce operations. The AI can draft and prepare work on your behalf, but actions that publish, sell, spend, or change your live store await your approval before they take effect. You remain in control of your store at all times.",
      "We may add, change, or remove features to improve the product. We aim for high availability but do not guarantee the service will be uninterrupted or error-free.",
    ],
  },
  {
    heading: "3. Accounts",
    body: [
      "You must provide accurate information when creating an account and keep it up to date. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. Notify us promptly at hello@mautomate.com if you suspect unauthorized access. You must be at least 18 years old, or the age of majority where you live, to use mAutomate.",
    ],
  },
  {
    heading: "4. Trials and billing",
    body: [
      "New accounts start with a 7-day free trial. When the trial ends, your selected plan begins automatically and your payment method is charged, unless you cancel before the trial ends. The specifics of your plan, price, and included AI credits are shown at checkout and in your billing settings.",
      "- Subscriptions are billed in advance on a recurring basis, monthly or annually, depending on the plan you choose.\n- AI features consume AI credits. Your plan includes a monthly credit allowance, and you can purchase additional credit packs as needed.\n- Subscriptions renew automatically at the end of each billing period unless you cancel before the renewal date.\n- You can cancel at any time from your billing settings; cancellation takes effect at the end of the current billing period, and you keep access until then.\n- Except where required by law, fees already paid are non-refundable, and unused AI credits do not carry over beyond their stated validity.",
      "We may change prices or plan features, and will give reasonable advance notice before a change affects your next renewal.",
    ],
  },
  {
    heading: "5. Acceptable use",
    body: [
      "You agree not to misuse mAutomate. In particular, you may not:",
      "- Use the service to sell illegal goods or services, or to violate any applicable law or regulation.\n- Infringe the intellectual property, privacy, or other rights of any third party.\n- Upload malware, attempt to breach security, or disrupt the platform or other tenants.\n- Use the AI features to generate deceptive, fraudulent, harmful, or infringing content.\n- Resell, reverse engineer, or circumvent usage limits of the service without our written permission.",
      "We may suspend or terminate accounts that violate this section.",
    ],
  },
  {
    heading: "6. AI actions and your responsibility",
    body: [
      "mAutomate's AI generates content and prepares actions, but it is a tool that assists you — not a substitute for your own judgment. AI output can be inaccurate or unsuitable, so you must review it before it goes live.",
      "You are solely responsible for what you ship, publish, and sell through your store, including product listings, prices, marketing claims, tax and shipping settings, and any content the AI helped create. Approving an AI action means you have reviewed and accepted it. mAutomate is not responsible for the commercial outcomes of your store or for content you choose to publish.",
    ],
  },
  {
    heading: "7. Your content and data ownership",
    body: [
      "You own your store data. The products, customers, orders, content, and other records you create or import remain yours. We process this data only to provide the service to you and according to our Privacy Policy.",
      "You can export your store data at any time in a portable format, and you can delete it by removing content or closing your store. You grant us the limited license needed to host, process, and display your content so that we can operate the service on your behalf.",
    ],
  },
  {
    heading: "8. Intellectual property",
    body: [
      "The mAutomate platform, including its software, design, branding, and documentation, is owned by mAutomate and protected by intellectual property laws. These terms do not transfer any ownership of the platform to you. Subject to your compliance with these terms, we grant you a limited, non-exclusive, non-transferable right to use the service for your business. Content that the AI generates specifically for your store, based on your inputs, is yours to use for your store.",
    ],
  },
  {
    heading: "9. Third-party services",
    body: [
      "mAutomate integrates with third-party services such as payment processors, advertising and marketing platforms, shipping providers, and AI model providers. Your use of those services is governed by their own terms and privacy policies. We are not responsible for third-party services, and their availability or behavior is outside our control.",
    ],
  },
  {
    heading: "10. Disclaimers and limitation of liability",
    body: [
      'The service is provided "as is" and "as available" without warranties of any kind, whether express or implied, including fitness for a particular purpose and non-infringement. We do not warrant that the service or its AI output will be accurate, error-free, or meet your specific requirements.',
      "To the maximum extent permitted by law, mAutomate will not be liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, revenue, data, or goodwill. Our total liability for any claim arising out of or relating to the service is limited to the amount you paid us for the service in the twelve months before the claim.",
    ],
  },
  {
    heading: "11. Termination",
    body: [
      "You may stop using mAutomate and close your account at any time. We may suspend or terminate your access if you breach these terms, fail to pay, or use the service in a way that risks harm to us or others. On termination, your right to use the service ends. We will make your store data available for export for a reasonable period before deletion, except where law requires otherwise.",
    ],
  },
  {
    heading: "12. Changes to these terms",
    body: [
      "We may update these terms as the product and applicable law evolve. When we make material changes we will update the date at the top of this page and, where appropriate, notify you by email or in the app. Continued use of mAutomate after an update means you accept the revised terms.",
    ],
  },
  {
    heading: "13. Governing law",
    body: [
      "These terms are governed by the laws of the jurisdiction in which mAutomate is established, without regard to conflict-of-law principles. Any disputes arising from these terms or the service will be subject to the exclusive jurisdiction of the courts located there, unless applicable law grants you the right to bring proceedings elsewhere.",
    ],
  },
  {
    heading: "14. Contact us",
    body: [
      "If you have any questions about these Terms of Service, email us at hello@mautomate.com and we will be happy to help.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalDoc
      eyebrow="Legal"
      title="Terms of Service"
      updated="July 2026"
      sections={sections}
    />
  );
}
