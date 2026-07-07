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
  title: "Mumbai Rail Pulse",
  description:
    "Crowdsourced Mumbai local-train disruption tracker — community reports layered over live monsoon weather. Not affiliated with Indian Railways or IMD.",
  icons: { icon: "/logo.png" },
  // Link-preview card for LinkedIn/WhatsApp shares. On Vercel, Next resolves
  // the relative image URL against the deployment's production URL.
  openGraph: {
    title: "Mumbai Rail Pulse",
    description:
      "Live crowdsourced map of Mumbai local-train disruptions during the monsoon.",
    images: [{ url: "/logo.png", width: 854, height: 1210, alt: "Mumbai Rail Pulse logo" }],
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
