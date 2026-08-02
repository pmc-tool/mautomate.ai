import Faq from "@/components/Faq";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Infrastructure from "@/components/Infrastructure";
import Pricing from "@/components/Pricing";
import ProductShowcase from "@/components/ProductShowcase";
import Testimonials from "@/components/Testimonials";
import JsonLd from "@/components/JsonLd";
import { softwareApplicationSchema, faqSchema } from "@/lib/schema";
import { PLANS } from "@/lib/plans";
import { FAQ_ITEMS } from "@/lib/faqData";

// Home keeps the layout's default canonical ("/") and full default title.
export default function Home() {
  return (
    <>
      <JsonLd data={[softwareApplicationSchema(PLANS), faqSchema(FAQ_ITEMS)]} />
      <Header />
      <main>
        <Hero />
        <ProductShowcase />
        <Testimonials />
        <HowItWorks />
        <Infrastructure />
        <Pricing />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
