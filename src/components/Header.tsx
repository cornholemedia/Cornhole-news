"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/", label: "Top" },
  { href: "/new", label: "New" },
  { href: "/submit", label: "Submit" },
  { href: "/about", label: "About" },
  { href: "/jobs", label: "Jobs" },
  { href: "/advertise", label: "Advertise" },
];

function MenuIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export default function Header({ logoSrc }: { logoSrc: string | null }) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const [username, setUsername] = useState<string | null | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState(false);
  const [openPath, setOpenPath] = useState<string | null>(null);
  const menuOpen = openPath === pathname;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenPath(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        setUsername(null);
        setIsAdmin(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("username, is_admin")
        .eq("id", user.id)
        .single();

      if (active) {
        setUsername(profile?.username ?? null);
        setIsAdmin(Boolean(profile?.is_admin));
      }
    }

    load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleLogout() {
    setOpenPath(null);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  function closeMenu() {
    setOpenPath(null);
  }

  function toggleMenu() {
    setOpenPath(menuOpen ? null : pathname);
  }

  function renderAuthLinks() {
    if (username === undefined) return null;
    if (!username) {
      return (
        <Link href="/login" onClick={closeMenu} className="text-[#3f679b] hover:underline">
          login
        </Link>
      );
    }

    return (
      <>
        <Link
          href={`/user/${username}`}
          onClick={closeMenu}
          className="text-[#3f679b] hover:underline"
        >
          {username}
        </Link>
        {isAdmin && (
          <Link href="/admin" onClick={closeMenu} className="text-[#3f679b] hover:underline">
            admin
          </Link>
        )}
        <button onClick={handleLogout} className="text-left text-[#3f679b] hover:underline">
          logout
        </button>
      </>
    );
  }

  return (
    <header className="w-full bg-[#ebb73f]">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-2 text-xl font-bold text-white hover:no-underline">
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- aspect ratio is unknown until a logo file is added
              <img
                src={logoSrc}
                alt=""
                className="h-8 w-auto max-h-8 max-w-24 shrink-0 object-contain"
              />
            ) : null}
            <span className="truncate">Cornhole News</span>
          </Link>

          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-2 rounded border border-[#3f679b]/40 bg-white/50 px-3 py-1.5 text-sm font-medium text-[#3f679b] lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            onClick={toggleMenu}
          >
            <MenuIcon open={menuOpen} />
            {menuOpen ? "Close" : "Menu"}
          </button>

          <nav
            aria-label="Main"
            className="hidden items-center gap-1 text-sm font-medium lg:flex lg:gap-2 lg:text-base"
          >
            {navItems.map((item, index) => (
              <span key={item.href} className="flex items-center">
                {index > 0 && <span className="mx-1 text-[#3f679b]/50">|</span>}
                <Link href={item.href} className="text-[#3f679b] hover:underline">
                  {item.label}
                </Link>
              </span>
            ))}

            <span className="mx-1 text-[#3f679b]/50">|</span>
            {username === undefined ? null : username ? (
              <span className="flex items-center gap-2">{renderAuthLinks()}</span>
            ) : (
              renderAuthLinks()
            )}
          </nav>
        </div>

        <nav
          id="site-menu"
          aria-label="Main"
          className={`${menuOpen ? "flex" : "hidden"} mt-3 flex-col gap-1 border-t border-[#3f679b]/25 pt-2 text-base font-medium lg:hidden`}
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMenu}
              className="py-1.5 text-[#3f679b] hover:underline"
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-1 flex flex-col gap-1 border-t border-[#3f679b]/25 py-2">
            {username === undefined ? (
              <span className="py-1.5 text-sm text-[#3f679b]/70">Loading…</span>
            ) : username ? (
              <span className="flex flex-col items-start gap-1 py-1">{renderAuthLinks()}</span>
            ) : (
              <span className="py-1.5">{renderAuthLinks()}</span>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
