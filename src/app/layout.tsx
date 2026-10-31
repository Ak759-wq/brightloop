import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Brightloop – Subscriptions, billing & revenue", template: "%s · Brightloop" },
  description: "Run plans, subscriptions, recurring billing, GST invoices, payments and revenue analytics in one place.",
};
export const viewport: Viewport = { themeColor: "#0b1226" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={inter.variable}>
      <body className="font-sans"><Providers>{children}</Providers></body>
    </html>
  );
}
