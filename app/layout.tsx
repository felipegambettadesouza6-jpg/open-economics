import type { Metadata } from "next";
import { DM_Mono, Inter } from "next/font/google";
import "./globals.css";
import "./signal.css";
import { Telemetry } from "@/app/components/Telemetry";
import { SITE_ORIGIN } from "@/lib/metadata";

const interfaceSans = Inter({
  variable: "--font-interface",
  subsets: ["latin"],
});

const dataMono = DM_Mono({
  variable: "--font-data",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export async function generateMetadata(): Promise<Metadata> {
  const title = "Open Economics — Official data, made to flow";
  const description =
    "Find and query official Brazilian economic data through one free API and a public MCP server with 19 read-only tools.";

  return {
    metadataBase: new URL(SITE_ORIGIN),
    applicationName: "Open Economics",
    icons: { icon: "/icon.svg" },
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Open Economics",
      images: [{ url: "/og.png", width: 1774, height: 887, alt: "Open Economics — Official data, made to flow" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${interfaceSans.variable} ${dataMono.variable}`}><Telemetry />{children}</body>
    </html>
  );
}
