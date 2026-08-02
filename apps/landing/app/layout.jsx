import "./globals.css";
import { Inter } from "next/font/google";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import { antdTheme } from "@/lib/antdTheme";
import JsonLd from "@/components/JsonLd";
import { organizationSchema, websiteSchema, OG_IMAGE_URL } from "@/lib/schema";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const TITLE = "mAutomate — Manage your entire ecommerce with AI Automation";
const DESCRIPTION =
  "From websites and marketing to customer support, inventory, sales and analytics — everything runs from one intelligent platform. Launch your AI-powered business in minutes.";

export const metadata = {
  title: {
    default: TITLE,
    // Per-page titles render as "Page — mAutomate" while the home page keeps
    // the full default. Individual pages can still set an absolute title.
    template: "%s | mAutomate",
  },
  description: DESCRIPTION,
  metadataBase: new URL("https://mautomate.ai"),
  applicationName: "mAutomate",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    title: "mAutomate — AI Automation for ecommerce",
    description:
      "One plan away from a store that runs itself. Website builder, marketing automation, AI customer support and business operations from a single dashboard.",
    url: "/",
    siteName: "mAutomate",
    type: "website",
    images: [{ url: OG_IMAGE_URL, width: 1200, height: 630, alt: "mAutomate — your store, run by AI" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "mAutomate — AI Automation for ecommerce",
    description:
      "One plan away from a store that runs itself. Website builder, marketing automation, AI customer support and business operations from a single dashboard.",
    images: [OG_IMAGE_URL],
  },
};

export const viewport = {
  themeColor: "#F15A29",
  width: "device-width",
  initialScale: 1,
};

// Referral/partner links (?ref=CODE) can land on any page; the signup form
// reads this stored code back so attribution survives navigation.
const refCatcher = `try{var r=new URLSearchParams(location.search).get("ref");if(r){r=r.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,10);if(r)localStorage.setItem("ma_ref",r)}}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <JsonLd data={[organizationSchema, websiteSchema]} />
        <script dangerouslySetInnerHTML={{ __html: refCatcher }} />
        <AntdRegistry>
          <ConfigProvider theme={antdTheme}>{children}</ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
