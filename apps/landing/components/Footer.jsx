import Image from "next/image";
import { FacebookMono, LinkedinMono, InstagramMono } from "./icons";
import { FOOTER_COLUMNS as COLUMNS } from "@/lib/site";
import NewsletterForm from "./NewsletterForm";

const SOCIAL = [
  { Icon: LinkedinMono, label: "LinkedIn" },
  { Icon: InstagramMono, label: "Instagram" },
  { Icon: FacebookMono, label: "Facebook" },
];

export default function Footer() {
  return (
    <footer id="about" className="scroll-mt-24 bg-[#171717] text-white">
      <div className="shell py-14 lg:py-16">
        {/* ---- Newsletter row ---- */}
        <div className="flex flex-col gap-8 pb-10 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">
              Product news and updates
            </h2>
            <p className="mt-2 text-sm text-white/60">
              Join our community of founders building on mAutomate.
            </p>
          </div>

          <NewsletterForm />
        </div>

        {/* ---- Main content ---- */}
        <div className="border-t border-white/10 pt-10">
          <div className="flex flex-col justify-between gap-10 lg:flex-row">
            {/* brand + tagline */}
            <div>
              {/* Same logo asset as the header, rendered white so it reads on
                  the dark footer. */}
              <Image
                src="/assets/logo.svg"
                alt="mAutomate"
                width={200}
                height={44}
                className="h-10 w-auto [filter:brightness(0)_invert(1)]"
              />
              <p className="mt-6 text-lg font-bold text-white">
                Smart automation for modern commerce.
              </p>
            </div>

            {/* link columns */}
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:gap-16">
              {COLUMNS.map((col) => (
                <div key={col.title}>
                  <p className="text-sm font-semibold text-white/50">
                    {col.title}
                  </p>
                  <ul className="mt-4 space-y-3">
                    {col.links.map((link) => (
                      <li key={link.label}>
                        <a
                          href={link.href}
                          className="text-sm text-white/70 transition-colors duration-300 hover:text-brand"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* bottom row */}
          <div className="mt-12 flex flex-col gap-6 border-t border-white/10 pt-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <a
                href="mailto:hello@mautomate.com"
                className="text-sm font-medium text-white/80 transition-colors hover:text-brand"
              >
                hello@mautomate.com
              </a>
              <div className="mt-4 flex items-center gap-2.5">
                {SOCIAL.map(({ Icon, label }) => (
                  <a
                    key={label}
                    href="#social"
                    aria-label={label}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/80 transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:border-brand/40 hover:text-brand"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>

            <div className="text-left sm:text-right">
              <p className="text-sm text-white/50">
                Built for founders, by mAutomate
              </p>
              <p className="mt-1 text-sm text-white/50">
                © 2025 mAutomate. All Rights Reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
