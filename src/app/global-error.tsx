"use client";

import Link from "next/link";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const errorCss = `
  body { margin: 0; background: #f6f6ef; color: #000; font-family: system-ui, sans-serif; }
  a, button { color: #3f679b; background: transparent; border: 0; padding: 0; font: inherit; cursor: pointer; }
  .mark { width: 64px; height: 8px; border-radius: 4px; background: #ebb73f; }
  .kicker { margin-top: 20px; color: #3f679b; font-size: 14px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
  h1 { margin-top: 8px; font-size: 24px; }
  p { margin-top: 12px; font-size: 15px; line-height: 1.5; }
  .actions { margin-top: 20px; }
  html.dark body { background: #1c1b17; color: #f3f0e6; }
  html.dark a, html.dark button, html.dark .kicker { color: #a9c4ee; }
`;

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script id="theme-init" dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: errorCss }} />
      </head>
      <body>
        <main style={{ maxWidth: 32 * 16, margin: "0 auto", padding: "2.5rem 1rem" }}>
          <div className="mark" />
          <p className="kicker">Error</p>
          <h1>Something went wrong</h1>
          <p>Cornhole News could not finish loading. Try again, or return to the front page.</p>
          <p className="actions">
            <button type="button" onClick={() => reset()}>
              Try again
            </button>
            <span aria-hidden="true"> · </span>
            <Link href="/">Top stories</Link>
          </p>
        </main>
      </body>
    </html>
  );
}
