"use client";

import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f6f6ef", color: "#000", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ maxWidth: 32 * 16, margin: "0 auto", padding: "2.5rem 1rem" }}>
          <div style={{ width: 64, height: 8, borderRadius: 4, background: "#ebb73f" }} />
          <p style={{ marginTop: 20, color: "#3f679b", fontSize: 14, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Error
          </p>
          <h1 style={{ marginTop: 8, fontSize: 24 }}>Something went wrong</h1>
          <p style={{ marginTop: 12, fontSize: 15, lineHeight: 1.5 }}>
            Cornhole News could not finish loading. Try again, or return to the front page.
          </p>
          <p style={{ marginTop: 20, fontSize: 15 }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{ color: "#3f679b", background: "transparent", border: 0, padding: 0, font: "inherit", cursor: "pointer" }}
            >
              Try again
            </button>
            <span aria-hidden="true"> · </span>
            <Link href="/" style={{ color: "#3f679b" }}>
              Top stories
            </Link>
          </p>
        </main>
      </body>
    </html>
  );
}
