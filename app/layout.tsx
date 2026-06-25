import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAGI — Answers you can actually defend",
  description:
    "MAGI researches real sources, red-teams its own answer against them, and delivers a cited report — built for the work where being wrong is expensive.",
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
