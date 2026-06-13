import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";

// Self-hosted at build time by next/font (downloaded + served from our own
// origin — no runtime hotlink to Google). Inter for UI/body, Source Serif 4
// for an academic/editorial heading note. Swap to next/font/local if licensed
// faces (e.g. Styrene/Tiempos) are ever supplied.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kitten Tracker",
  description: "Foster kitten tracking — weights, feedings, medical, adoption",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
