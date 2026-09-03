"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/", label: "Top" },
  { href: "/new", label: "New" },
  { href: "/submit", label: "Submit" },
  { href: "/about", label: "About" },
  { href: "/jobs", label: "Jobs" },
  { href: "/advertise", label: "Advertise" },
];

export default function Header() {
  const supabase = createClient();
  const router = useRouter();
  const [username, setUsername] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let active = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        setUsername(null);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();

      if (active) setUsername(profile?.username ?? null);
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
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="w-full bg-[#ebb73f]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-bold text-white hover:no-underline">
          Cornhole News
        </Link>

        <nav className="flex items-center gap-1 text-sm font-medium sm:gap-2 sm:text-base">
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
            <span className="flex items-center gap-2">
              <Link href={`/user/${username}`} className="text-[#3f679b] hover:underline">
                {username}
              </Link>
              <button onClick={handleLogout} className="text-[#3f679b] hover:underline">
                logout
              </button>
            </span>
          ) : (
            <Link href="/login" className="text-[#3f679b] hover:underline">
              login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
