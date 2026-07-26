"use client";

import { useEffect, useRef } from "react";

/**
 * Wraps children with a scroll-triggered entrance animation.
 * Uses IntersectionObserver with a 0.3 threshold (per spec): the element
 * reveals once ~30% of it enters the viewport, then unobserves itself.
 *
 * `as`     — element/tag to render (default "div")
 * `delay`  — optional stagger delay in ms
 */
export default function AnimatedSection({
  as: Tag = "div",
  delay = 0,
  className = "",
  children,
  ...rest
}) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Respect users who prefer reduced motion — reveal immediately.
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) {
      node.classList.add("is-visible");
      return;
    }

    // Reveal once ~30% of the element is visible — but elements taller than
    // the viewport can never hit 30% on screen at once (e.g. the stacked hero
    // bento on mobile), so cap the threshold to a viewport-relative amount.
    const vh = window.innerHeight || 800;
    const threshold =
      node.offsetHeight > 0
        ? Math.min(0.3, (vh * 0.3) / node.offsetHeight)
        : 0.3;

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            node.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`reveal ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
