import PageShell, { PageHero } from "@/components/PageShell";
import SignupFlow from "@/components/SignupFlow";

export const metadata = {
  title: "Create your store — mAutomate",
  description:
    "Create your AI-run store in minutes. Start a 7-day free trial — your plan begins when the trial ends, cancel any time before then.",
};

export default function SignupPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Get started"
        title="Launch your store"
        subtitle="A few details and your storefront, marketing, and AI operator are live. Free for 7 days — no card needed to start."
      />
      <section className="shell pb-20 lg:pb-28">
        <SignupFlow />
      </section>
    </PageShell>
  );
}
