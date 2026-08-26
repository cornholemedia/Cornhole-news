import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import AdSidebar from "@/components/AdSidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cornhole News",
  description: "News, discussion, and community for the cornhole world",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#f6f6ef] font-sans text-black">
        <Header />

        <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-4">
          {/* Main content */}
          <main className="min-w-0 flex-1">{children}</main>

          {/* Right-hand ad column */}
          <AdSidebar />
        </div>

        <footer className="border-t border-[#e0e0e0] py-4 text-center text-sm text-[#666]">
          <div className="mx-auto max-w-6xl px-4">
            Cornhole News · Built for the community
          </div>
        </footer>
      </body>
    </html>
  );
}
