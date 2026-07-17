"use client";
import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    const finish = () => {
      setDone(true);
      setTimeout(() => setDone(false), 1200);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(finish, finish);
    else finish();
  };
  return (
    <button className={`copy${done ? " done" : ""}`} onClick={copy} aria-label={`Copy: ${text}`}>
      {done ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
      )}
    </button>
  );
}
