import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Plus Jakarta Sans is the Kitten Tracker brand typeface (style guide §04) —
// a humanist sans used for body, UI, and headings alike. Self-hosted at build
// time by next/font (downloaded + served from our own origin, no runtime
// hotlink to Google). Weights: 400 body/data, 500 headings/labels/interactive,
// 600 reserved for the wordmark only.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
