import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

/** Brand type: geometric sans for everything, monospace for eyebrow labels, clocks and moves */
const sans = Plus_Jakarta_Sans({ variable: "--font-brand-sans", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-brand-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Kingdom of Chess · Tournaments",
  description: "Live chess tournaments for Kingdom of Chess students",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // Font variables live on <html> because the base layer applies font-sans to <html>
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
