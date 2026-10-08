import type { Metadata } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import Header from "@/components/Header";
import AdSidebar from "@/components/AdSidebar";
import NewsletterSignup from "@/components/NewsletterSignup";
import { DEFAULT_DESCRIPTION, SITE_NAME, getSiteUrl } from "@/lib/site";
import { getSiteLogoSrc } from "@/lib/site-logo";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    url: getSiteUrl(),
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Cornhole News — news, discussion, and community",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#f6f6ef] font-sans text-black">
        <Header logoSrc={getSiteLogoSrc()} />

        <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-4">
          {/* Main content */}
          <main className="min-w-0 flex-1">{children}</main>

          {/* Right-hand ad column */}
          <AdSidebar />
        </div>

        <footer className="border-t border-[#e0e0e0] py-6 text-center text-sm text-[#666]">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-4">
            <NewsletterSignup />
            <p>Cornhole News · Built for the community</p>
            <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <Link href="/contact" className="hover:underline">
                Contact
              </Link>
              <span aria-hidden="true">·</span>
              <Link href="/privacy" className="hover:underline">
                Privacy
              </Link>
              <span aria-hidden="true">·</span>
              <Link href="/terms" className="hover:underline">
                Terms
              </Link>
            </nav>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
