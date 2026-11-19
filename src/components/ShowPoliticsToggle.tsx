"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { homeHref } from "@/lib/home-path";
import {
  SHOW_POLITICS_STORAGE_KEY,
  parseShowPolitics,
  readShowPoliticsCookie,
  writeShowPoliticsCookie,
} from "@/lib/show-politics";

const SYNC_ATTEMPT_KEY = "cornhole.showPolitics.syncAttempt";

type ShowPoliticsToggleProps = {
  showPolitics: boolean;
  page: number;
};

export default function ShowPoliticsToggle({ showPolitics, page }: ShowPoliticsToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, setPending] = useState<boolean | null>(null);
  const synced = useRef(false);

  if (pending !== null && pending === showPolitics) {
    setPending(null);
  }

  const show = pending ?? showPolitics;

  useEffect(() => {
    if (synced.current) return;
    synced.current = true;
    let active = true;

    function go(desired: boolean) {
      const destination = homeHref(page, desired);
      if (destination === pathname) {
        window.sessionStorage.removeItem(SYNC_ATTEMPT_KEY);
        return;
      }
      if (window.sessionStorage.getItem(SYNC_ATTEMPT_KEY) === destination) return;
      window.sessionStorage.setItem(SYNC_ATTEMPT_KEY, destination);
      router.replace(destination);
    }

    async function sync() {
      const fromCookie = readShowPoliticsCookie();
      if (fromCookie !== null) {
        if (fromCookie !== showPolitics) go(fromCookie);
        return;
      }

      const stored = parseShowPolitics(window.localStorage.getItem(SHOW_POLITICS_STORAGE_KEY));
      if (stored !== null) {
        writeShowPoliticsCookie(stored);
        if (stored !== showPolitics) go(stored);
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active || !user) return;

      const { data } = await supabase
        .from("profiles")
        .select("show_politics")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;

      const preferred = typeof data?.show_politics === "boolean" ? data.show_politics : showPolitics;
      window.localStorage.setItem(SHOW_POLITICS_STORAGE_KEY, preferred ? "1" : "0");
      writeShowPoliticsCookie(preferred);
      if (preferred !== showPolitics) go(preferred);
    }

    void sync();
    return () => {
      active = false;
    };
  }, [page, pathname, router, showPolitics]);

  async function handleChange(next: boolean) {
    setPending(next);
    window.localStorage.setItem(SHOW_POLITICS_STORAGE_KEY, next ? "1" : "0");
    writeShowPoliticsCookie(next);
    window.sessionStorage.removeItem(SYNC_ATTEMPT_KEY);
    router.push(homeHref(page, next));

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("profiles").update({ show_politics: next }).eq("id", user.id);
    if (error) {
      console.error("Could not save show politics preference:", error.message);
    }
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      <label className="inline-flex cursor-pointer items-center gap-2 py-1 text-[13px] font-medium text-[#1a1a1a]">
        <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
          <input
            type="checkbox"
            role="switch"
            aria-checked={show}
            checked={show}
            onChange={(event) => {
              void handleChange(event.target.checked);
            }}
            className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0"
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full border border-[#5c5c5c] bg-[#e7e4da] transition-colors peer-checked:border-[#3f679b] peer-checked:bg-[#3f679b] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-solid peer-focus-visible:outline-[#1a1a1a] motion-reduce:transition-none"
          />
          <span
            aria-hidden="true"
            className="absolute left-0.5 h-5 w-5 rounded-full bg-[#3a3a3a] transition-transform peer-checked:translate-x-5 peer-checked:bg-white motion-reduce:transition-none"
          />
        </span>
        Show politics
      </label>
      <p className="text-[13px] text-[#666]" aria-live="polite">
        {show ? "Showing all stories" : "Political stories are hidden"}
      </p>
    </div>
  );
}
