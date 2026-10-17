"use client";

import { useEffect, useRef } from "react";
import { TURNSTILE_FIELD } from "@/lib/turnstile-shared";

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad";

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    onTurnstileLoad?: () => void;
  }
}

type TurnstileFieldProps = {
  resetKey?: string;
};

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);

  return new Promise((resolve, reject) => {
    const ready = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("Turnstile did not load."));
    };

    const previous = window.onTurnstileLoad;
    window.onTurnstileLoad = () => {
      previous?.();
      ready();
    };

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      if (window.turnstile) ready();
      else existing.addEventListener("load", ready, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Turnstile did not load."));
    document.head.appendChild(script);
  });
}

export default function TurnstileField({ resetKey = "" }: TurnstileFieldProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let active = true;
    const element = containerRef.current;

    loadTurnstile()
      .then((turnstile) => {
        if (!active || !element.isConnected) return;
        widgetId.current = turnstile.render(element, {
          sitekey: siteKey,
          theme: "light",
        });
      })
      .catch(() => {
        widgetId.current = null;
      });

    return () => {
      active = false;
      const turnstile = window.turnstile;
      if (turnstile && widgetId.current) {
        turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [resetKey, siteKey]);

  if (!siteKey) return null;

  return (
    <div className="space-y-1">
      <p className="text-sm text-[#3a3a3a]">Security check</p>
      <div ref={containerRef} data-turnstile-field={TURNSTILE_FIELD} />
    </div>
  );
}
