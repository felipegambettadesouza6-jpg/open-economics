import type { Metadata } from "next";
import { headers } from "next/headers";
import { DM_Mono, Manrope } from "next/font/google";
import "./globals.css";
import "./signal.css";

const interfaceSans = Manrope({
  variable: "--font-interface",
  subsets: ["latin"],
});

const dataMono = DM_Mono({
  variable: "--font-data",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "Open Economics — The economy, in focus";
  const description =
    "A free, open, developer-friendly API for authoritative Brazilian economic data.";

  return {
    metadataBase: new URL(origin),
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1774, height: 887, alt: "Open Economics — The economy, in focus" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${interfaceSans.variable} ${dataMono.variable}`}>{children}</body>
    </html>
  );
}
