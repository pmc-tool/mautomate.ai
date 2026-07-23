import "./globals.css";
import { Inter } from "next/font/google";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import { antdTheme } from "@/lib/antdTheme";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata = {
  title: "mAutomate — Manage your entire ecommerce with AI Automation",
  description:
    "From websites and marketing to customer support, inventory, sales and analytics — everything runs from one intelligent platform. Launch your AI-powered business in minutes.",
  metadataBase: new URL("https://mautomate.ai"),
  openGraph: {
    title: "mAutomate — AI Automation for ecommerce",
    description:
      "One plan away from a store that runs itself. Website builder, marketing automation, AI customer support and business operations from a single dashboard.",
    type: "website",
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
        <script dangerouslySetInnerHTML={{ __html: refCatcher }} />
        <AntdRegistry>
          <ConfigProvider theme={antdTheme}>{children}</ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
