import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { Navbar } from "@/components/Navbar";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Showcase | Smallest AI",
    template: "%s | Smallest AI Showcase",
  },
  description:
    "Explore voice and audio experiences built with Smallest AI. Try live demos, discover community projects, and build your own.",
  keywords: [
    "Smallest AI",
    "voice AI",
    "speech to text",
    "text to speech",
    "voice agents",
    "STT",
    "TTS",
    "Atoms SDK",
    "Pulse STT",
    "Lightning TTS",
  ],
  openGraph: {
    title: "Showcase | Smallest AI",
    description:
      "Explore voice and audio experiences built with Smallest AI.",
    siteName: "Smallest AI Showcase",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@smallest_AI",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <ThemeProvider>
          <AnalyticsProvider>
            <Navbar />
            <main className="min-h-[calc(100vh-4rem)]">{children}</main>
            <Analytics />
          </AnalyticsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

