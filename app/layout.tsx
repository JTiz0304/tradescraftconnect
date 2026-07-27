import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  metadataBase: new URL("https://www.tradescraftconnect.com"),
  title: {
    default: "TradesCraftConnect | Built for the Trades",
    template: "%s | TradesCraftConnect",
  },
  description:
    "Connect with builders, trade business owners, skilled professionals, and apprentices through a platform built for the trades.",
  openGraph: {
    title: "TradesCraftConnect | Built for the Trades",
    description:
      "Connect with builders, trade business owners, skilled professionals, and apprentices.",
    url: "https://www.tradescraftconnect.com",
    siteName: "TradesCraftConnect",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
