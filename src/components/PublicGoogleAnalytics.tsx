"use client";

import { GoogleAnalytics, sendGAEvent } from "@next/third-parties/google";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  analyticsCollectTargetsAdmin,
  gaMeasurementId,
  isGoogleAnalyticsCollectUrl,
  isTrackedPath,
} from "@/lib/google-analytics";

function bodyText(body: BodyInit | null | undefined): string | null {
  if (typeof body === "string") return body;
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
    return body.toString();
  }
  return null;
}

function blocksCollect(url: string, body: BodyInit | null | undefined): boolean {
  try {
    return isGoogleAnalyticsCollectUrl(url) && analyticsCollectTargetsAdmin(url, bodyText(body));
  } catch {
    return false;
  }
}

function installAdminCollectBlock(): void {
  if (typeof window === "undefined") return;
  const flag = window as Window & { __cornholeGaAdminBlock?: boolean };
  if (flag.__cornholeGaAdminBlock) return;
  flag.__cornholeGaAdminBlock = true;

  const originalBeacon = navigator.sendBeacon?.bind(navigator);
  if (originalBeacon) {
    navigator.sendBeacon = (url, data) => {
      if (blocksCollect(String(url), data)) return true;
      return originalBeacon(url, data);
    };
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const href =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (blocksCollect(href, init?.body)) {
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    return originalFetch(input, init);
  };
}

export default function PublicGoogleAnalytics() {
  const pathname = usePathname() ?? "/";
  const gaId = gaMeasurementId();
  const tracked = Boolean(gaId) && isTrackedPath(pathname);
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    installAdminCollectBlock();
  }, []);

  useEffect(() => {
    if (!tracked || !gaId) return;
    const pagePath = `${window.location.pathname}${window.location.search}`;
    if (!isTrackedPath(window.location.pathname) || lastPath.current === pagePath) return;
    const previous = lastPath.current;
    lastPath.current = pagePath;
    // gtag('config') already records the first view. The loaded tag does not
    // emit page_view on history.pushState, which is how client navigations move.
    if (previous === null) return;
    sendGAEvent("event", "page_view", {
      page_path: pagePath,
      page_location: window.location.href,
      send_to: gaId,
    });
  }, [gaId, pathname, tracked]);

  if (!tracked || !gaId) return null;
  return <GoogleAnalytics gaId={gaId} />;
}
