import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Weaver: self-healing scrapers",
  description:
    "Point Weaver at a page, click what you want, and it becomes a real Bright Data Scraper Studio scraper. When the site changes, you review the repair before it goes live.",
  openGraph: {
    title: "Weaver: self-healing scrapers",
    description: "Click what matters. Weaver builds the scraper, and shows you every repair before it goes live.",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#0d0c0a", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${instrument.variable} h-full`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
