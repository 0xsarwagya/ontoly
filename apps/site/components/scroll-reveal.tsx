"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let io: IntersectionObserver | undefined;

    // Run after the new route's DOM has committed and laid out. Re-runs on every
    // navigation (pathname dep) so client-side route changes reveal their content.
    const raf = requestAnimationFrame(() => {
      const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal:not(.in)"));

      if (reduce || !("IntersectionObserver" in window)) {
        els.forEach((el) => el.classList.add("in"));
        return;
      }

      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("in");
              io?.unobserve(e.target);
            }
          });
        },
        { threshold: 0.05, rootMargin: "0px 0px -8% 0px" },
      );

      const vh = window.innerHeight || document.documentElement.clientHeight;
      els.forEach((el) => {
        // Reveal anything already in or near the viewport immediately; observe the rest.
        if (el.getBoundingClientRect().top < vh * 0.92) el.classList.add("in");
        else io?.observe(el);
      });

      // Safety net: never leave content hidden even if the observer misses it.
      window.setTimeout(() => {
        document.querySelectorAll<HTMLElement>(".reveal:not(.in)").forEach((el) => {
          if (el.getBoundingClientRect().top < (window.innerHeight || 0)) el.classList.add("in");
        });
      }, 1200);
    });

    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [pathname]);

  return null;
}
