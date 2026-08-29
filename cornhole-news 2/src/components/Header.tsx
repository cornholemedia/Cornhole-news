import Link from "next/link";

const navItems = [
  { href: "/", label: "Top" },
  { href: "/new", label: "New" },
  { href: "/about", label: "About" },
  { href: "/jobs", label: "Jobs" },
  { href: "/advertise", label: "Advertise" },
];

export default function Header() {
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
              <Link
                href={item.href}
                className="text-[#3f679b] hover:underline"
              >
                {item.label}
              </Link>
            </span>
          ))}
        </nav>
      </div>
    </header>
  );
}
