"use client";

import { useEffect, useState } from "react";

export const BACK_TO_TOP_AFTER = 400;

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > BACK_TO_TOP_AFTER);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      }}
      className="fixed bottom-4 left-1/2 z-30 min-h-11 -translate-x-1/2 rounded border border-[#c8c8c8] bg-white px-4 text-base font-medium text-[#1a1a1a] shadow-sm hover:bg-[#f6f6ef] sm:left-auto sm:right-4 sm:translate-x-0"
    >
      Back to top
    </button>
  );
}
