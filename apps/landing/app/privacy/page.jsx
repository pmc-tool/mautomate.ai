import LegalDoc from "@/components/LegalDoc";

export const metadata = {
  title: "Privacy Policy — mAutomate",
  description:
    "How mAutomate handles personal data: what we collect from the contact form and newsletter, how merchant store data is treated, and your rights.",
};

const sections = [
  {
    heading: "1. Introduction",
    body: [
      "mAutomate is an AI commerce platform that helps merchants build, market, and run their online stores. This Privacy Policy explains what personal information we collect through our marketing website and product, how we use it, and the choices you have. It applies to visitors to mautomate.com and to merchants who use the mAutomate application.",
      "We designed mAutomate to keep merchant store data isolated per tenant, and we treat the personal data we collect the way we would want ours to be treated: minimally, transparently, and securely.",
    ],
  },
  {
    heading: "2. Information we collect",
    body: [
      "We only collect what we need to answer you, run your store, and improve the product. The main categories are:",
      "- Contact form: when you reach out to us we collect the name, email address, and the message you send, along with an optional brand or store name.\n- Newsletter: if you subscribe to product updates we collect your email address.\n- Account information: when you sign up for mAutomate we collect your name, email, password (stored hashed), and billing details, which are processed by our payment provider.\n- Merchant store data: content and records you create or import to run your store, such as products, orders, customers, and marketing campaigns.\n- Usage and analytics: aggregate information about how the site and app are used, such as pages viewed, features used, device and browser type, and approximate location derived from IP.",
    ],
  },
  {
    heading: "3. How we use your information",
    body: [
      "We use the information above to provide and improve the service, including to:",
      "- Respond to your enquiries submitted through the contact form.\n- Send product updates and announcements you have subscribed to, which you can unsubscribe from at any time.\n- Create and secure your account, process payments, and manage AI credit usage.\n- Operate the AI features that build, market, and run your store on your instruction.\n- Provide support, prevent fraud and abuse, and meet our legal obligations.\n- Understand and improve how the platform performs through aggregate analytics.",
      "We do not use merchant store data to train shared or third-party AI models, and we do not sell personal information.",
    ],
  },
  {
    heading: "4. Merchant store data",
    body: [
      "When you use mAutomate to run a store, the data flowing through that store — your products, your customers, your orders, and your marketing content — is processed by us on your behalf and under your control. For that data you are the controller and mAutomate acts as a processor.",
      "AI actions in mAutomate operate on your store data to draft content, build pages, and prepare campaigns, but changes await your approval before they ship. You decide what is published and sold. You can access, edit, and export this data at any time, and you can ask us to delete a store and its associated data.",
    ],
  },
  {
    heading: "5. How we share information",
    body: [
      "We share personal information only with service providers that help us run mAutomate, and only to the extent they need it to perform their function. These include:",
      "- Cloud hosting and database infrastructure that stores the platform's data.\n- Payment processors that handle subscription billing.\n- AI and model providers that power generation and automation features, which receive only the data needed to complete a requested task.\n- Email and analytics providers used to communicate with you and understand product usage.",
      "We may also disclose information if required by law, to protect our rights or users, or in connection with a merger or acquisition, in which case we will notify affected users. We never sell your personal data or share it with advertisers for their own purposes.",
    ],
  },
  {
    heading: "6. Data retention",
    body: [
      "We keep personal information for as long as it is needed to provide the service and for legitimate business or legal purposes. Contact form messages are retained while we handle your request and for a reasonable period afterwards. Account and merchant store data is retained while your account is active. When you close your account we delete or anonymize your data within a reasonable period, except where we must keep records to comply with law, resolve disputes, or enforce our agreements.",
    ],
  },
  {
    heading: "7. Your rights",
    body: [
      "Depending on where you live, you have rights over your personal data. mAutomate honors these regardless of location:",
      "- Access: request a copy of the personal data we hold about you.\n- Correction: ask us to fix inaccurate or incomplete information.\n- Deletion: ask us to delete your personal data, subject to legal retention obligations.\n- Export: obtain your account and store data in a portable, machine-readable format.\n- Objection and restriction: object to or restrict certain processing, and unsubscribe from marketing at any time.",
      "To exercise any of these rights, contact us at hello@mautomate.com and we will respond within the timeframes required by applicable law.",
    ],
  },
  {
    heading: "8. Security",
    body: [
      "We protect your data with encryption in transit, hashed credentials, tenant isolation so one merchant's store data is never exposed to another, scoped access controls, and monitoring. No system is perfectly secure, but we work continuously to safeguard your information and will notify you of a breach affecting your personal data as required by law.",
    ],
  },
  {
    heading: "9. Cookies",
    body: [
      "Our website uses a small number of cookies and similar technologies. Essential cookies keep you signed in and keep the site working. Analytics cookies help us understand aggregate usage so we can improve the product. You can control cookies through your browser settings; disabling non-essential cookies will not prevent you from using the core site.",
    ],
  },
  {
    heading: "10. Changes to this policy",
    body: [
      "We may update this Privacy Policy as the product evolves or as the law changes. When we make material changes we will update the date at the top of this page and, where appropriate, notify you by email or in the app. Continued use of mAutomate after an update means you accept the revised policy.",
    ],
  },
  {
    heading: "11. Contact us",
    body: [
      "If you have any questions about this Privacy Policy or how we handle your data, email us at hello@mautomate.com. We read every message and aim to reply quickly.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalDoc
      eyebrow="Legal"
      title="Privacy Policy"
      updated="July 2026"
      sections={sections}
    />
  );
}
