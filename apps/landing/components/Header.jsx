"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { NAV, LOGIN_URL, GET_STARTED_URL } from "@/lib/site";

export default function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50">
      <div
        className={`border-b border-line transition-all duration-300 ease-smooth ${
          scrolled
            ? "bg-[#fdf9f8]/85 shadow-[0_8px_30px_-18px_rgba(20,20,20,0.35)] backdrop-blur-md"
            : "bg-[#fdf9f8]"
        }`}
      >
        <nav className="shell relative flex items-center justify-between py-4">
          <a
            href="#top"
            className="transition-opacity duration-300 hover:opacity-80"
            aria-label="mAutomate home"
          >
            <Image
              src="/assets/logo.svg"
              alt="mAutomate"
              width={200}
              height={44}
              priority
              className="h-11 w-auto"
            />
          </a>

          {/* Desktop nav — centered */}
          <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 lg:flex">
            {NAV.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  className="flex items-center gap-1 text-sm font-medium text-ink transition-colors duration-300 hover:text-brand"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-4 lg:flex">
            <a
              href={LOGIN_URL}
              className="text-sm font-semibold text-ink transition-opacity duration-300 hover:opacity-70"
            >
              Login
            </a>
            <a
              href={GET_STARTED_URL}
              className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink transition-all duration-300 ease-smooth hover:border-brand/40 hover:text-brand hover:-translate-y-0.5"
            >
              Get Started
            </a>
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line transition-colors hover:border-brand/40 lg:hidden"
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            <span className="relative block h-3 w-5">
              <span
                className={`absolute left-0 top-0 h-0.5 w-5 bg-ink transition-transform duration-300 ${
                  open ? "translate-y-[5px] rotate-45" : ""
                }`}
              />
              <span
                className={`absolute bottom-0 left-0 h-0.5 w-5 bg-ink transition-transform duration-300 ${
                  open ? "-translate-y-[5px] -rotate-45" : ""
                }`}
              />
            </span>
          </button>
        </nav>
      </div>

      {/* Mobile drawer */}
      <div
        className={`overflow-hidden bg-white shadow-card transition-[max-height] duration-300 ease-smooth lg:hidden ${
          open ? "max-h-96" : "max-h-0"
        }`}
      >
        <ul className="shell flex flex-col gap-1 py-4">
          {NAV.map((item) => (
            <li key={item.label}>
              <a
                href={item.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-3 text-base font-medium text-ink transition-colors hover:bg-surface-alt"
              >
                {item.label}
              </a>
            </li>
          ))}
          <li className="mt-2 flex flex-col gap-2 px-1">
            <a href={LOGIN_URL} onClick={() => setOpen(false)} className="btn-ghost w-full">
              Login
            </a>
            <a href={GET_STARTED_URL} onClick={() => setOpen(false)} className="btn-primary w-full">
              Get Started
            </a>
          </li>
        </ul>
      </div>
    </header>
  );
}
