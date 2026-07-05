import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MAGI — Answers you can actually defend",
    template: "%s — MAGI",
  },
  description:
    "MAGI runs your request through four adversarial AI nodes — research, build, attack, synthesize — and delivers one cited, verified report. Built for the work where being wrong is expensive.",
  keywords: ["AI research", "verified AI answers", "cited AI reports", "AI fact-checking", "multi-model AI"],
  openGraph: {
    title: "MAGI — Answers you can actually defend",
    description:
      "Four adversarial AI nodes. Live sources. One cited verdict. Join the private beta.",
    siteName: "MAGI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MAGI — Answers you can actually defend",
    description:
      "Four adversarial AI nodes. Live sources. One cited verdict. Join the private beta.",
  },
};

export const viewport: Viewport = {
  themeColor: "#06070a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
