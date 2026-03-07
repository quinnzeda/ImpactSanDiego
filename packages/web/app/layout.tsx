import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PermitPal SD - San Diego Building Permit Navigator",
  description:
    "AI-powered tool to navigate San Diego's building permit process. Find what permits you need, check exemptions, and search 256K+ permit records.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <nav className="border-b border-border bg-white sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">PP</span>
                </div>
                <span className="font-bold text-lg text-foreground">
                  PermitPal <span className="text-primary">SD</span>
                </span>
              </Link>
              <div className="flex items-center gap-6">
                <Link
                  href="/"
                  className="text-sm text-muted hover:text-foreground transition-colors"
                >
                  Navigator
                </Link>
                <Link
                  href="/search"
                  className="text-sm text-muted hover:text-foreground transition-colors"
                >
                  Search Permits
                </Link>
                <Link
                  href="/code"
                  className="text-sm text-muted hover:text-foreground transition-colors"
                >
                  Municipal Code
                </Link>
              </div>
            </div>
          </div>
        </nav>
        <main>{children}</main>
        <footer className="border-t border-border py-8 mt-16">
          <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted">
            <p>
              PermitPal SD - Built for the Claude Community x City of San Diego
              Impact Lab Hackathon
            </p>
            <p className="mt-1">
              Data sourced from{" "}
              <a
                href="https://data.sandiego.gov"
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                City of San Diego Open Data Portal
              </a>{" "}
              &bull; Not official city guidance
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
