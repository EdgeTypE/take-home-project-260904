import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteShell } from "@/components/site-shell";
import { isLang, LANGUAGE_COOKIE, type Lang } from "@/lib/i18n/dictionaries";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Clipboard: paid clipping campaigns",
  description:
    "Take-home demo of a clipping marketplace: campaigns, clip submissions, per-1k-views payouts and a hard budget ceiling.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolve the language from the cookie on the server so the server-rendered
  // HTML matches the client's first render (the client must never pick up a
  // language the server did not render, or hydration mismatches on every
  // translated string).
  const cookieStore = await cookies();
  const cookieLang = cookieStore.get(LANGUAGE_COOKIE)?.value;
  const initialLang: Lang = isLang(cookieLang) ? cookieLang : "en";

  return (
    <html lang={initialLang}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SiteShell initialLang={initialLang}>{children}</SiteShell>
      </body>
    </html>
  );
}
