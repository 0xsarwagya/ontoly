"use client";
import { useCallback, useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(true);

  const compute = useCallback(() => {
    const t = document.documentElement.getAttribute("data-theme");
    if (t) return t === "dark";
    return !window.matchMedia?.("(prefers-color-scheme: light)").matches;
  }, []);

  useEffect(() => {
    setDark(compute());
  }, [compute]);

  const toggle = () => {
    const next = !compute();
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    setDark(next);
    window.dispatchEvent(new CustomEvent("ontoly-theme"));
  };

  return (
    <button className="icon-btn" onClick={toggle} aria-label="Toggle color theme" title="Toggle theme">
      {dark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        </svg>
      )}
    </button>
  );
}
