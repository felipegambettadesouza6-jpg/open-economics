import type { Metadata } from "next";
import { DM_Mono, Inter } from "next/font/google";
import "./globals.css";
import "./signal.css";

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
  const origin = "https://open-economics-data.knbf982hkn.chatgpt.site";
  const title = "Open Economics — Official data, made to flow";
  const description =
    "Discover, understand, and use official economic and financial data through one consistent API.";

  return {
    metadataBase: new URL(origin),
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1774, height: 887, alt: "Open Economics — Official data, made to flow" }],
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
