import PageShell, { PageHero } from "@/components/PageShell";
import ContactForm from "@/components/ContactForm";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";

// Server component so we can export real per-page metadata. The interactive
// form lives in components/ContactForm.jsx ("use client").
export const metadata = {
  title: "Contact mAutomate — talk to a founder",
  description:
    "Questions about building an AI-run store? Tell us about your brand — a founder reads every note and replies within a working day.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <PageShell>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Contact", path: "/contact" },
        ])}
      />
      <PageHero
        eyebrow="Contact"
        title="Tell us about your brand"
        subtitle="Three questions, two minutes — a founder reads every note and replies within a working day."
      />
      <ContactForm />
    </PageShell>
  );
}
