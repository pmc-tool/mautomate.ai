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

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AntdRegistry>
          <ConfigProvider theme={antdTheme}>{children}</ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
