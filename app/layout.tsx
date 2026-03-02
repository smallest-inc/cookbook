import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Image from "next/image";
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
            <Footer />
            <Analytics />
          </AnalyticsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

const UTM = "utm_source=showcase&utm_medium=footer&utm_campaign=showcase";

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2.5">
            <Image
              src="/smallest-icon.png"
              alt="Smallest AI"
              width={24}
              height={24}
              className="rounded-md"
            />
            <span className="text-sm font-medium text-muted-foreground">
              Smallest AI Showcase
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <a
              href={`https://smallest.ai?${UTM}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              smallest.ai
            </a>
            <a
              href={`https://app.smallest.ai?${UTM}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Atoms Platform
            </a>
            <a
              href={`https://docs.smallest.ai?${UTM}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Docs
            </a>
            <a
              href={`https://github.com/smallest-inc/cookbook?${UTM}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <a
              href={`https://discord.gg/5evETqguJs?${UTM}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors font-medium text-teal"
            >
              Join Discord
            </a>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={`https://app.smallest.ai/dashboard/settings/apikeys?${UTM}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-xs font-medium text-background transition-all hover:opacity-90"
          >
            Get API Key
          </a>
          <a
            href={`https://github.com/smallest-inc/cookbook?${UTM}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2 text-xs font-medium text-foreground transition-all hover:bg-muted"
          >
            Contribute on GitHub
          </a>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground/60">
          Built with Smallest AI APIs
        </p>
      </div>
    </footer>
  );
}
