import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reckon — a ledger for your life",
  description: "Track what you say matters against where your time actually goes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-ink text-parchment">{children}</body>
    </html>
  );
}
