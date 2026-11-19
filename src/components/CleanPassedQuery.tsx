"use client";

import { useEffect } from "react";

/**
 * `/?p=2` and `/jobs?state=IA` redirect at the edge and keep the old query.
 * Drop those params in the address bar. This does not ask the server again.
 */
export default function CleanPassedQuery() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("p") && !url.searchParams.has("state")) return;
    url.searchParams.delete("p");
    url.searchParams.delete("state");
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(null, "", next);
  }, []);

  return null;
}
